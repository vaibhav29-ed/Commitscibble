import { AppError, ERROR_CODES } from "@commitscibble/shared";
import { Repository } from "@commitscibble/persistence";
import {
  guardCleanup,
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
  type WorkerDeps,
} from "../lib/context.js";
import { knownPaths, loadRepositoryState } from "../lib/repository-state.js";
import { createProposal } from "./proposals.js";
import { applyProposal } from "./apply.js";

const TOTAL_STEPS = 6;

export async function runCleanup(
  deps: WorkerDeps,
  data: { runId: string },
): Promise<void> {
  const prepared = await prepareRun(deps, data.runId);
  if (!prepared) return;

  try {
    const { run, repository, client, headSha } = prepared;

    await emitRunEvent(deps, prepared, "PROGRESS", "Fetching repository metadata", {
      progress: { step: 1, total: TOTAL_STEPS },
    });
    const state = await loadRepositoryState(client, repository, headSha);

    if (!state.readme) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        `No README exists at ${repository.settings.readmePath}; generate documentation first.`,
        { httpStatus: 422 },
      );
    }

    await emitRunEvent(deps, prepared, "PROGRESS", "Analysing README and verifying repository facts", {
      progress: { step: 2, total: TOTAL_STEPS },
    });

    await assertRunActive(String(run._id));
    const cleanup = await deps.ai.cleanupDocumentation({
      analysis: state.analysis,
      files: selectEvidenceFiles(state.snapshot, state.analysis, 12),
      readme: state.readme.content,
      maxContextChars: deps.env.AI_MAX_CONTEXT_CHARS,
    });

    await emitRunEvent(deps, prepared, "PROGRESS", "Checking that cleanup preserves verified instructions", {
      progress: { step: 3, total: TOTAL_STEPS },
    });

    const guard = guardCleanup(state.readme.content, cleanup.data.markdown, state.analysis);
    if (guard.blockers.length > 0) {
      throw new AppError(
        ERROR_CODES.README_VALIDATION_FAILED,
        `Cleanup would remove verified documentation: ${guard.blockers
          .map((issue) => issue.message)
          .slice(0, 3)
          .join("; ")}`,
        { httpStatus: 422, details: guard.blockers },
      );
    }

    if (!guard.changed) {
      await succeedRun(deps, prepared, "README is already clean; no changes were required");
      return;
    }

    const validation = validateReadme(cleanup.data.markdown, {
      analysis: state.analysis,
      knownPaths: knownPaths(state),
      inventoryTruncated: state.snapshot.inventory.truncated,
      readmePath: repository.settings.readmePath,
    });
    if (validation.hasBlockingErrors) {
      throw new AppError(
        ERROR_CODES.README_VALIDATION_FAILED,
        `Cleaned README failed validation: ${validation.issues
          .filter((issue) => issue.severity === "error")
          .map((issue) => issue.message)
          .join("; ")}`,
        { httpStatus: 422, details: validation.issues },
      );
    }

    const warnings = [
      ...cleanup.warnings,
      ...cleanup.data.warnings,
      ...guard.warnings.map((issue) => issue.message),
      ...validation.issues.filter((issue) => issue.severity === "warning").map((issue) => issue.message),
    ];

    await emitRunEvent(deps, prepared, "PROGRESS", "Preparing cleanup proposal", {
      progress: { step: 4, total: TOTAL_STEPS },
    });

    const proposal = await createProposal({
      deps,
      run,
      repository,
      state,
      analysis: state.analysis,
      original: state.readme.content,
      proposed: cleanup.data.markdown,
      summary: `README cleanup: ${cleanup.data.changes.length} change(s) proposed`,
      sections: [],
      warnings,
      explanations: cleanup.data.changes,
      validationIssues: validation.issues.length
        ? validation.issues
        : warnings.map((message) => ({
            severity: "warning" as const,
            code: "warning",
            message,
          })),
      provider: cleanup.provider,
      model: cleanup.model,
    });

    const shouldApply =
      repository.settings.updateMode === "AUTOMATIC" && repository.settings.automationEnabled;

    if (shouldApply) {
      await emitRunEvent(deps, prepared, "PROGRESS", "Applying cleanup to GitHub", {
        progress: { step: 5, total: TOTAL_STEPS },
      });
      const result = await applyProposal({
        deps,
        prepared,
        client,
        branch: prepared.branch,
        proposal,
      });
      await Repository.updateOne(
        { _id: repository._id },
        { $set: { lastAnalysis: state.analysis } },
      );
      await succeedRun(
        deps,
        prepared,
        result.noChange
          ? "README was already clean; nothing to commit"
          : "README cleanup applied and committed",
        { metadata: result.commitSha ? { commitSha: result.commitSha } : null },
      );
      return;
    }

    await Repository.updateOne(
      { _id: repository._id },
      { $set: { lastAnalysis: state.analysis } },
    );
    await succeedRun(deps, prepared, "Cleanup proposal ready for review", {
      metadata: { proposalId: String(proposal._id) },
    });
  } catch (error) {
    if (error instanceof RunCancelledError) return;
    await failRun(deps, prepared.run, error);
    throw error;
  }
}
