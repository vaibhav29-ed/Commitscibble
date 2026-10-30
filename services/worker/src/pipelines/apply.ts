import { AppError, DOC_COMMIT_MARKER, ERROR_CODES } from "@commitscibble/shared";
import { evaluateProposalFreshness } from "@commitscibble/documentation-engine";
import { GitHubError, type GitHubClient } from "@commitscibble/github";
import {
  DocumentationProposal,
  DocumentationRun,
  Repository,
  type DocumentationProposalDocument,
  type DocumentationRunDocument,
  type RepositoryDocument,
} from "@commitscibble/persistence";
import { emitRunEvent, type WorkerDeps } from "../lib/context.js";
import { notifyApplied } from "../lib/notifications.js";

export interface ApplyResult {
  committed: boolean;
  commitSha: string | null;
  noChange: boolean;
}

/**
 * Apply an approved proposal with optimistic concurrency:
 *  1. re-fetch the README at the configured target branch,
 *  2. refuse to write when it changed since analysis (stale proposal),
 *  3. skip empty commits,
 *  4. mark the proposal applied only after GitHub confirms the commit.
 */
export async function applyProposal(args: {
  deps: WorkerDeps;
  prepared: { run: DocumentationRunDocument; repository: RepositoryDocument };
  client: GitHubClient;
  branch: string;
  proposal: DocumentationProposalDocument;
}): Promise<ApplyResult> {
  const { deps, prepared, client, branch, proposal } = args;
  const repository = prepared.repository;
  const readmePath = repository.settings.readmePath;

  if (proposal.status === "APPLIED") {
    return { committed: false, commitSha: proposal.appliedCommitSha, noChange: false };
  }
  if (proposal.status === "REJECTED") {
    throw new AppError(ERROR_CODES.PROPOSAL_NOT_PENDING, "Proposal was rejected", {
      httpStatus: 409,
    });
  }
  if (branch !== (repository.settings.targetBranch ?? repository.defaultBranch)) {
    throw new AppError(
      ERROR_CODES.VALIDATION_ERROR,
      "Refusing to write to a branch other than the configured target branch",
    );
  }

  const current = await client.getFile(repository.owner, repository.name, readmePath, branch);
  const currentContent = current?.content ?? "";

  const freshness = evaluateProposalFreshness({
    baseReadmeHash: proposal.baseReadmeHash,
    currentContent,
    proposedContent: proposal.proposedContent,
  });

  if (freshness.decision === "STALE") {
    await DocumentationProposal.updateOne(
      { _id: proposal._id },
      { $set: { status: "STALE" } },
    );
    await Repository.updateOne(
      { _id: repository._id },
      { $set: { documentationStatus: "STALE" } },
    );
    throw new AppError(
      ERROR_CODES.STALE_PROPOSAL,
      `${freshness.reason} (branch ${branch})`,
      { httpStatus: 409 },
    );
  }

  if (freshness.decision === "NO_CHANGE") {
    await DocumentationProposal.updateOne(
      { _id: proposal._id },
      { $set: { status: "APPLIED", appliedAt: new Date() } },
    );
    await Repository.updateOne(
      { _id: repository._id },
      {
        $set: {
          documentationStatus: "CURRENT",
          lastSuccessfulRunAt: new Date(),
        },
      },
    );
    await emitRunEvent(deps, prepared, "PROGRESS", "The repository README already matches the generated content; nothing to commit");
    return { committed: false, commitSha: null, noChange: true };
  }

  const message = buildCommitMessage(repository.settings.commitMessageTemplate, readmePath);

  let result;
  try {
    result = await client.createOrUpdateFile({
      owner: repository.owner,
      repo: repository.name,
      path: readmePath,
      branch,
      message,
      content: proposal.proposedContent,
      sha: current?.sha ?? null,
    });
  } catch (error) {
    if (error instanceof GitHubError && error.code === ERROR_CODES.CONFLICT) {
      await DocumentationProposal.updateOne({ _id: proposal._id }, { $set: { status: "STALE" } });
      throw new AppError(
        ERROR_CODES.STALE_PROPOSAL,
        "GitHub reported a conflict while writing the README. The file changed after analysis; regenerate the proposal.",
        { httpStatus: 409 },
      );
    }
    throw error;
  }

  await DocumentationProposal.updateOne(
    { _id: proposal._id },
    {
      $set: {
        status: "APPLIED",
        appliedCommitSha: result.commitSha,
        appliedAt: new Date(),
      },
    },
  );
  await DocumentationRun.updateOne(
    { _id: prepared.run._id },
    { $set: { appliedCommitSha: result.commitSha } },
  );
  prepared.run.appliedCommitSha = result.commitSha;

  await Repository.updateOne(
    { _id: repository._id },
    {
      $set: {
        lastAppliedCommitSha: result.commitSha,
        lastSuccessfulRunAt: new Date(),
        documentationStatus: "CURRENT",
      },
    },
  );

  await emitRunEvent(deps, prepared, "APPLIED", `Documentation committed to ${branch}`, {
    metadata: { commitSha: result.commitSha, readmePath },
  });

  void notifyApplied(deps, {
    run: prepared.run,
    repository,
    branch,
    commitSha: result.commitSha,
  });

  return { committed: true, commitSha: result.commitSha, noChange: false };
}

export function buildCommitMessage(template: string, readmePath: string): string {
  const rendered = (template || "docs: update {readmePath} [commitscibble]").replace(
    /\{readmePath\}/g,
    readmePath,
  );
  const withMarker = rendered.includes(DOC_COMMIT_MARKER)
    ? rendered
    : `${rendered} ${DOC_COMMIT_MARKER}`;
  return `${withMarker}\n\nGenerated by CommitScibble. This commit only modifies documentation and is excluded from automatic re-analysis.`;
}
