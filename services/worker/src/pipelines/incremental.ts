import { AppError, ERROR_CODES, type SectionKey } from "@commitscibble/shared";
import { GitHubError, type GitHubCompare } from "@commitscibble/github";
import { Repository, SectionMapping } from "@commitscibble/persistence";
import {
  applyIncrementalPatches,
  computeDocumentationImpact,
  extractCanonicalSections,
  selectEvidenceFiles,
  validateReadme,
} from "@commitscibble/documentation-engine";
import {
  emitRunEvent,
  failRun,
  prepareRun,
  succeedRun,
  type PreparedRun,
  type WorkerDeps,
} from "../lib/context.js";
import { knownPaths, loadRepositoryState } from "../lib/repository-state.js";
import { createProposal } from "./proposals.js";
import { applyProposal } from "./apply.js";
import { executeFullGeneration } from "./generate.js";

const TOTAL_STEPS = 7;

export async function runIncremental(
  deps: WorkerDeps,
  data: { runId: string },
): Promise<void> {
  const prepared = await prepareRun(deps, data.runId);
  if (!prepared) return;
  try {
    await executeIncremental(deps, prepared);
  } catch (error) {
    await failRun(deps, prepared.run, error);
    throw error;
  }
}

export async function executeIncremental(
  deps: WorkerDeps,
  prepared: PreparedRun,
): Promise<void> {
  const { run, repository, client, headSha } = prepared;

  await emitRunEvent(deps, prepared, "PROGRESS", "Fetching repository metadata", {
    progress: { step: 1, total: TOTAL_STEPS },
  });

  const state = await loadRepositoryState(client, repository, headSha);
  const analysis = state.analysis;

  const baseSha = repository.lastProcessedCommitSha ?? repository.lastAppliedCommitSha;
  if (!baseSha) {
    await emitRunEvent(
      deps,
      prepared,
      "PROGRESS",
      "No previously processed commit is recorded; performing a bounded full resynchronization",
      { progress: { step: 2, total: TOTAL_STEPS } },
    );
    await executeFullGeneration(deps, prepared, {
      advanceOnReview: false,
      reason: "Resynchronization (no processed commit)",
      summaryPrefix: "Full resynchronization of the README because no previous processed commit was recorded.",
    });
    return;
  }

  let comparison: GitHubCompare;
  try {
    comparison = await client.compareCommits(repository.owner, repository.name, baseSha, headSha);
  } catch (error) {
    if (error instanceof GitHubError && error.code === ERROR_CODES.GITHUB_NOT_FOUND) {
      await emitRunEvent(
        deps,
        prepared,
        "PROGRESS",
        "The previously processed commit is unavailable (force push or history rewrite); resynchronizing",
        { progress: { step: 2, total: TOTAL_STEPS } },
      );
      await executeFullGeneration(deps, prepared, {
        advanceOnReview: false,
        reason: "Resynchronization after unreadable base commit",
        summaryPrefix: "Full resynchronization because the previously processed commit is no longer reachable.",
      });
      return;
    }
    throw error;
  }

  const changedFiles = comparison.files.filter(
    (file) => !repository.settings.ignoredPaths.some((pattern) => matchSimple(file.filename, pattern)),
  );
  await emitRunEvent(
    deps,
    prepared,
    "PROGRESS",
    `Comparing ${changedFiles.length} changed file(s) since ${baseSha.slice(0, 7)}`,
    {
      progress: { step: 2, total: TOTAL_STEPS },
      metadata: { changedFiles: changedFiles.length },
    },
  );

  if (changedFiles.length === 0) {
    await Repository.updateOne(
      { _id: repository._id },
      {
        $set: {
          lastProcessedCommitSha: headSha,
          lastAnalysis: analysis,
          documentationStatus: repository.lastAppliedCommitSha ? "CURRENT" : "NONE",
        },
      },
    );
    await succeedRun(deps, prepared, "No file changes detected; documentation is unchanged", {
      metadata: { changedFiles: 0 },
    });
    return;
  }

  const mappings = await SectionMapping.find({ repositoryId: repository._id }).lean();
  const sectionSources = Object.fromEntries(
    mappings.map((mapping) => [mapping.sectionKey, mapping.evidencePaths]),
  );

  const impact = computeDocumentationImpact({
    previous: repository.lastAnalysis,
    current: analysis,
    changedPaths: changedFiles.map((file) => ({ path: file.filename, status: file.status })),
    maintainedSections: repository.settings.maintainedSections,
    sectionSources,
  });

  await emitRunEvent(
    deps,
    prepared,
    "PROGRESS",
    impact.summary,
    {
      progress: { step: 3, total: TOTAL_STEPS },
      metadata: { affectedSections: impact.sections.map((section) => section.key).join(",") },
    },
  );

  if (impact.noImpact) {
    await Repository.updateOne(
      { _id: repository._id },
      {
        $set: {
          lastProcessedCommitSha: headSha,
          lastAnalysis: analysis,
          documentationStatus: repository.lastAppliedCommitSha ? "CURRENT" : "NONE",
        },
      },
    );
    await succeedRun(deps, prepared, "No documentation impact detected; existing README sections preserved", {
      metadata: { affectedSections: 0 },
    });
    return;
  }

  if (!state.readme) {
    await emitRunEvent(
      deps,
      prepared,
      "PROGRESS",
      "No README exists yet; generating a complete one instead of patching",
      { progress: { step: 3, total: TOTAL_STEPS } },
    );
    await executeFullGeneration(deps, prepared, {
      advanceOnReview: false,
      reason: "Initial README generation during incremental update",
      summaryPrefix: "README generated because the repository has no existing documentation.",
    });
    return;
  }

  const canonical = extractCanonicalSections(state.readme.content);
  const readableSections = impact.sections
    .map((section) => {
      const match = canonical.find((entry) => entry.key === section.key);
      if (!match) return null;
      const body = match.section.body.replace(/^#{1,6}\s+.*\n/, "");
      return {
        key: section.key,
        heading: match.section.heading,
        body: body.trim(),
        reason: section.reason,
        level: match.section.level,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  if (readableSections.length === 0) {
    await emitRunEvent(
      deps,
      prepared,
      "PROGRESS",
      "Affected sections are not present in the README; regenerating documentation instead",
      { progress: { step: 3, total: TOTAL_STEPS } },
    );
    await executeFullGeneration(deps, prepared, {
      advanceOnReview: false,
      reason: "Affected sections missing from README",
      summaryPrefix: "README regenerated because affected sections were missing.",
    });
    return;
  }

  await emitRunEvent(deps, prepared, "PROGRESS", "Building targeted documentation patches", {
    progress: { step: 4, total: TOTAL_STEPS },
  });

  const patchResult = await deps.ai.generateIncrementalPatch({
    analysis,
    files: selectEvidenceFiles(state.snapshot, analysis, 18),
    existingReadme: state.readme.content,
    changedFiles: changedFiles.slice(0, 40).map((file) => ({
      path: file.filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      patch: file.patch ?? null,
    })),
    affectedSections: readableSections.map(({ key, heading, body, reason }) => ({
      key,
      heading,
      body,
      reason,
    })),
    maxContextChars: deps.env.AI_MAX_CONTEXT_CHARS,
  });

  if (patchResult.data.patches.length === 0) {
    await Repository.updateOne(
      { _id: repository._id },
      {
        $set: {
          lastProcessedCommitSha: headSha,
          lastAnalysis: analysis,
        },
      },
    );
    await succeedRun(
      deps,
      prepared,
      "The AI reviewed the changes and found no documentation updates were necessary",
      { metadata: { changedFiles: changedFiles.length } },
    );
    return;
  }

  const applied = applyIncrementalPatches(
    state.readme.content,
    patchResult.data.patches,
    impact,
  );

  const warnings = [...patchResult.warnings, ...patchResult.data.warnings];
  for (const rejected of applied.rejected) {
    warnings.push(`Rejected patch for ${rejected.key}: ${rejected.reason}`);
  }

  if (!applied.changed) {
    await Repository.updateOne(
      { _id: repository._id },
      { $set: { lastProcessedCommitSha: headSha, lastAnalysis: analysis } },
    );
    await succeedRun(deps, prepared, "Proposed documentation matched the current README; no changes applied");
    return;
  }

  const validation = validateReadme(applied.markdown, {
    analysis,
    knownPaths: knownPaths(state),
    inventoryTruncated: state.snapshot.inventory.truncated,
    readmePath: repository.settings.readmePath,
  });
  if (validation.hasBlockingErrors) {
    throw new AppError(
      ERROR_CODES.README_VALIDATION_FAILED,
      `Updated README failed validation: ${validation.issues
        .filter((issue) => issue.severity === "error")
        .map((issue) => issue.message)
        .join("; ")}`,
      { httpStatus: 422, details: validation.issues },
    );
  }
  warnings.push(
    ...validation.issues
      .filter((issue) => issue.severity === "warning")
      .map((issue) => issue.message),
  );

  await emitRunEvent(deps, prepared, "PROGRESS", "Validating README changes", {
    progress: { step: 5, total: TOTAL_STEPS },
  });

  const proposal = await createProposal({
    deps,
    run,
    repository,
    state,
    analysis,
    original: state.readme.content,
    proposed: applied.markdown,
    summary: impact.summary,
    sections: impact.sections.map((section) => section.key as SectionKey),
    warnings,
    explanations: applied.applied.map((patch) => ({
      summary: patch.key,
      explanation: patch.explanation,
    })),
    validationIssues: validation.issues.length
      ? validation.issues
      : warnings.map((message) => ({
          severity: "warning" as const,
          code: "warning",
          message,
        })),
    provider: patchResult.provider,
    model: patchResult.model,
  });

  const shouldApply =
    repository.settings.updateMode === "AUTOMATIC" && repository.settings.automationEnabled;

  if (shouldApply) {
    await emitRunEvent(deps, prepared, "PROGRESS", "Applying changes to GitHub", {
      progress: { step: 6, total: TOTAL_STEPS },
    });
    const result = await applyProposal({
      deps,
      prepared,
      client,
      branch: prepared.branch,
      proposal,
    });
    if (result.committed || result.noChange) {
      await Repository.updateOne(
        { _id: repository._id },
        { $set: { lastProcessedCommitSha: headSha, lastAnalysis: analysis } },
      );
    }
    await succeedRun(
      deps,
      prepared,
      result.noChange
        ? "Documentation was already up to date for this change"
        : "Documentation updated incrementally and committed",
      { metadata: result.commitSha ? { commitSha: result.commitSha } : null },
    );
    return;
  }

  await succeedRun(deps, prepared, "Targeted documentation update ready for review", {
    metadata: {
      proposalId: String(proposal._id),
      affectedSections: impact.sections.map((section) => section.key).join(","),
    },
  });
}

function matchSimple(path: string, pattern: string): boolean {
  const normalized = pattern.replace(/^\/+/, "").trim();
  if (!normalized) return false;
  if (normalized.endsWith("/")) return path.startsWith(normalized);
  if (normalized.includes("*")) {
    const regex = new RegExp(
      `^${normalized
        .split("*")
        .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join(".*")}$`,
    );
    return regex.test(path);
  }
  return path === normalized || path.startsWith(`${normalized}/`);
}
