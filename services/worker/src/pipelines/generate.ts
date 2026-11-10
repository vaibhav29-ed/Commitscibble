import { AppError, ERROR_CODES, type ReadmeDraft, type SectionKey } from "@commitscibble/shared";
import { Repository, DocumentationRun } from "@commitscibble/persistence";
import {
  assembleReadme,
  auditEvidenceGrounding,
  selectEvidenceFiles,
  validateReadme,
} from "@commitscibble/documentation-engine";
import {
  assertRunActive,
  emitRunEvent,
  failRun,
  prepareRun,
  RunCancelledError,
  succeedRun,
  type PreparedRun,
  type WorkerDeps,
} from "../lib/context.js";
import { knownPaths, loadRepositoryState } from "../lib/repository-state.js";
import { createProposal } from "./proposals.js";
import { applyProposal } from "./apply.js";

const TOTAL_STEPS = 6;

export async function runGenerate(
  deps: WorkerDeps,
  data: { runId: string },
): Promise<void> {
  const prepared = await prepareRun(deps, data.runId);
  if (!prepared) return;
  try {
    await executeFullGeneration(deps, prepared, {
      advanceOnReview: true,
      reason: "Full README generation",
    });
  } catch (error) {
    if (error instanceof RunCancelledError) return;
    await failRun(deps, prepared.run, error);
    throw error;
  }
}

export interface FullGenerationOptions {
  advanceOnReview: boolean;
  reason: string;
  summaryPrefix?: string;
}

export async function executeFullGeneration(
  deps: WorkerDeps,
  prepared: PreparedRun,
  options: FullGenerationOptions,
): Promise<void> {
  const { run, repository, client, headSha } = prepared;

  await emitRunEvent(deps, prepared, "PROGRESS", "Fetching repository metadata", {
    progress: { step: 1, total: TOTAL_STEPS },
  });

  const state = await loadRepositoryState(client, repository, headSha);
  const analysis = state.analysis;
  const existing = state.readme?.content ?? "";
  const evidence = selectEvidenceFiles(state.snapshot, analysis, 25);

  await DocumentationRun.updateOne({ _id: run._id }, { $set: { analysis } });
  await emitRunEvent(deps, prepared, "PROGRESS", "Analysing repository files and deriving documentation facts", {
    progress: { step: 2, total: TOTAL_STEPS },
    metadata: {
      filesInspected: state.snapshot.files.length,
      filesConsidered: state.snapshot.inventory.totalFiles,
    },
  });

  const generate = async (feedback?: string[]) =>
    deps.ai.generateDocumentation({
      analysis,
      files: evidence,
      existingReadme: state.readme?.content ?? null,
      maintainedSections: repository.settings.maintainedSections,
      maxContextChars: deps.env.AI_MAX_CONTEXT_CHARS,
      validationFeedback: feedback,
    });

  await emitRunEvent(deps, prepared, "PROGRESS", "Generating documentation with the configured AI provider", {
    progress: { step: 3, total: TOTAL_STEPS },
  });
  await assertRunActive(String(run._id));
  const first = await generate();
  let draft: ReadmeDraft = first.data;
  let provider = first.provider;
  let model = first.model;
  let markdown = assembleReadme(draft);
  const validate = (value: string) =>
    validateReadme(value, {
      analysis,
      knownPaths: knownPaths(state),
      inventoryTruncated: state.snapshot.inventory.truncated,
      readmePath: repository.settings.readmePath,
    });
  const audit = (value: ReadmeDraft) =>
    auditEvidenceGrounding(value.sections, {
      knownPaths: knownPaths(state),
      inventoryTruncated: state.snapshot.inventory.truncated,
    });
  let validation = validate(markdown);
  let grounding = audit(draft);
  const warnings = [...first.warnings, ...first.data.warnings];

  if (validation.hasBlockingErrors || grounding.needsRepair) {
    const feedback = [
      ...validation.issues
        .filter((issue) => issue.severity === "error")
        .map((issue) => issue.message),
      ...grounding.feedback,
    ];
    await emitRunEvent(
      deps,
      prepared,
      "PROGRESS",
      validation.hasBlockingErrors
        ? "Generated README failed validation; requesting one repair pass"
        : "Generated README cited repository files that do not exist; requesting one repair pass",
      { progress: { step: 3, total: TOTAL_STEPS } },
    );
    const repair = await generate(feedback.slice(0, 16));
    draft = repair.data;
    provider = repair.provider;
    model = repair.model;
    markdown = assembleReadme(draft);
    warnings.push(...repair.warnings, ...repair.data.warnings);
    validation = validate(markdown);
    grounding = audit(draft);
  }
  warnings.push(
    ...validation.issues
      .filter((issue) => issue.severity === "warning")
      .map((issue) => issue.message),
    ...grounding.warnings,
  );
  if (validation.hasBlockingErrors) {
    throw new AppError(
      ERROR_CODES.README_VALIDATION_FAILED,
      `Generated README failed validation: ${validation.issues
        .filter((issue) => issue.severity === "error")
        .map((issue) => issue.message)
        .join("; ")}`,
      {
        httpStatus: 422,
        details: validation.issues,
      },
    );
  }

  await emitRunEvent(deps, prepared, "PROGRESS", `Preparing documentation proposal. ${grounding.summary}`, {
    progress: { step: 4, total: TOTAL_STEPS },
    metadata: {
      groundedSections: grounding.sections.filter((entry) => entry.grounded).length,
      totalSections: grounding.sections.length,
      unsupportedEvidencePaths: grounding.unsupportedPaths.length,
    },
  });
  const proposal = await createProposal({
    deps,
    run,
    repository,
    state,
    analysis,
    original: existing,
    proposed: markdown,
    summary:
      options.summaryPrefix ??
      `README generated from ${state.snapshot.files.length} inspected files across ${analysis.languages.length} detected language(s).`,
    sections: draft.sections.map((section) => section.key as SectionKey),
    warnings,
    explanations: draft.sections
      .filter((section) => section.warnings.length > 0)
      .map((section) => ({
        summary: section.heading,
        explanation: section.warnings.join(" "),
      })),
    validationIssues: validation.issues.length
      ? validation.issues
      : warnings.map((message) => ({
          severity: "warning" as const,
          code: "warning",
          message,
        })),
    provider,
    model,
  });

  const shouldApply =
    repository.settings.updateMode === "AUTOMATIC" && repository.settings.automationEnabled;

  if (shouldApply) {
    await emitRunEvent(deps, prepared, "PROGRESS", "Applying changes to GitHub", {
      progress: { step: 5, total: TOTAL_STEPS },
    });
    const applied = await applyProposal({ deps, prepared, client, branch: prepared.branch, proposal });
    if (applied.commitSha || applied.noChange) {
      await Repository.updateOne(
        { _id: repository._id },
        {
          $set: {
            lastProcessedCommitSha: headSha,
            documentationStatus: "CURRENT",
          },
        },
      );
    }
    await succeedRun(
      deps,
      prepared,
      applied.noChange
        ? "Documentation generation completed; README already up to date"
        : `Documentation generated and committed to ${prepared.branch}`,
      { metadata: applied.commitSha ? { commitSha: applied.commitSha } : null },
    );
    return;
  }

  if (options.advanceOnReview) {
    await Repository.updateOne(
      { _id: repository._id },
      { $set: { lastProcessedCommitSha: headSha, documentationStatus: "PENDING_REVIEW" } },
    );
  }
  await succeedRun(
    deps,
    prepared,
    "Documentation proposal generated and awaiting review",
    { metadata: { proposalId: String(proposal._id) } },
  );
}
