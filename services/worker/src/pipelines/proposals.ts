import {
  createUnifiedDiff,
  diffStats,
  type RepositoryAnalysis,
  type SectionKey,
} from "@commitscibble/shared";
import { hashContent } from "@commitscibble/shared/node";
import {
  DocumentationProposal,
  DocumentationRun,
  Repository,
  SectionMapping,
  type DocumentationProposalDocument,
  type DocumentationRunDocument,
  type RepositoryDocument,
} from "@commitscibble/persistence";
import { mapSectionsToSources } from "@commitscibble/documentation-engine";
import { assertRunActive, emitRunEvent, type WorkerDeps } from "../lib/context.js";
import { notifyReviewRequired } from "../lib/notifications.js";
import type { RepositoryState } from "../lib/repository-state.js";

export interface CreateProposalInput {
  deps: WorkerDeps;
  run: DocumentationRunDocument;
  repository: RepositoryDocument;
  state: RepositoryState;
  analysis: RepositoryAnalysis;
  original: string;
  proposed: string;
  summary: string;
  sections: SectionKey[];
  warnings: string[];
  explanations: { summary: string; explanation: string }[];
  validationIssues: { severity: "error" | "warning"; code: string; message: string; path?: string }[];
  provider: string | null;
  model: string | null;
}

export async function createProposal(
  input: CreateProposalInput,
): Promise<DocumentationProposalDocument> {
  const { deps, run, repository, state, analysis, original, proposed } = input;
  await assertRunActive(String(run._id));
  const diff = createUnifiedDiff(original, proposed, {
    path: repository.settings.readmePath,
  });
  const stats = diffStats(original, proposed);

  const proposal = await DocumentationProposal.create({
    runId: run._id,
    repositoryId: repository._id,
    userId: run.userId,
    status: "PENDING",
    summary: input.summary,
    sections: input.sections,
    warnings: input.warnings,
    explanations: input.explanations,
    baseCommitSha: state.snapshot.ref || repository.lastProcessedCommitSha || "",
    baseReadmeHash: hashContent(original),
    originalContent: original,
    proposedContent: proposed,
    diff,
    validationIssues: input.validationIssues,
    additions: stats.additions,
    deletions: stats.deletions,
    provider: input.provider,
    model: input.model,
  });

  await DocumentationRun.updateOne(
    { _id: run._id },
    {
      $set: {
        proposalId: proposal._id,
        provider: input.provider,
        model: input.model,
        analysis,
        baseReadmeHash: hashContent(original),
        baseCommitSha: state.snapshot.ref || null,
        warnings: input.warnings,
      },
    },
  );
  run.proposalId = proposal._id;

  const mappings = mapSectionsToSources(proposed, analysis, state.snapshot.files);
  if (mappings.length > 0) {
    await SectionMapping.bulkWrite(
      mappings.map((mapping) => ({
        updateOne: {
          filter: { repositoryId: repository._id, sectionKey: mapping.sectionKey },
          update: {
            $set: {
              userId: run.userId,
              heading: mapping.heading,
              evidencePaths: mapping.evidencePaths,
              sourceHashes: mapping.sourceHashes,
              lastVerifiedCommitSha: state.snapshot.ref || null,
            },
          },
          upsert: true,
        },
      })),
    );
  }

  await Repository.updateOne(
    { _id: repository._id },
    {
      $set: {
        lastAnalysis: analysis,
        documentationStatus: "PENDING_REVIEW",
      },
    },
  );

  await emitRunEvent(deps, { run, repository }, "APPROVAL_REQUIRED", "Proposal ready for review", {
    metadata: {
      proposalId: String(proposal._id),
      additions: stats.additions,
      deletions: stats.deletions,
    },
  });

  if (repository.settings.updateMode === "REVIEW") {
    void notifyReviewRequired(deps, {
      run,
      repository,
      summary: input.summary,
      additions: stats.additions,
      deletions: stats.deletions,
      provider: input.provider,
      model: input.model,
    });
  }

  return proposal;
}
