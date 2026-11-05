import {
  AppError,
  ERROR_CODES,
  type OperationType,
  type ProposalSummary,
  type RunStatus,
  type RunSummary,
} from "@commitscibble/shared";
import { newId } from "@commitscibble/shared/node";
import {
  DocumentationProposal,
  DocumentationRun,
  Repository,
  recordActivity,
  type DocumentationProposalDocument,
  type DocumentationRunDocument,
} from "@commitscibble/persistence";
import type { JobQueue } from "../lib/queue.js";

const OPERATION_LABELS: Record<OperationType, string> = {
  GENERATE: "README generation",
  INCREMENTAL_UPDATE: "Incremental documentation update",
  CLEANUP: "README cleanup",
  RESYNC: "Repository resynchronization",
  PROPOSAL_APPLY: "Applying documentation proposal",
};

const QUEUE_UNAVAILABLE_MESSAGE =
  "The job queue is unavailable, so this run could not be scheduled. Check REDIS_URL and that Redis is reachable, then retry.";

export function toRunSummary(doc: DocumentationRunDocument): RunSummary {
  return {
    id: String(doc._id),
    repositoryId: String(doc.repositoryId),
    operation: doc.operation,
    status: doc.status,
    baseCommitSha: doc.baseCommitSha,
    targetCommitSha: doc.targetCommitSha,
    provider: (doc.provider as RunSummary["provider"]) ?? null,
    model: doc.model,
    startedAt: doc.startedAt ? doc.startedAt.toISOString() : null,
    completedAt: doc.completedAt ? doc.completedAt.toISOString() : null,
    errorCode: doc.errorCode,
    errorMessage: doc.errorMessage,
    proposalId: doc.proposalId ? String(doc.proposalId) : null,
    appliedCommitSha: doc.appliedCommitSha,
    correlationId: doc.correlationId,
    attempt: doc.attempt,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function toProposalSummary(doc: DocumentationProposalDocument): ProposalSummary {
  return {
    id: String(doc._id),
    runId: String(doc.runId),
    repositoryId: String(doc.repositoryId),
    summary: doc.summary,
    sections: [...doc.sections],
    warnings: [...doc.warnings],
    validationIssues: doc.validationIssues,
    status: doc.status,
    baseCommitSha: doc.baseCommitSha,
    baseReadmeHash: doc.baseReadmeHash,
    additions: doc.additions,
    deletions: doc.deletions,
    createdAt: doc.createdAt.toISOString(),
    reviewedAt: doc.reviewedAt ? doc.reviewedAt.toISOString() : null,
  };
}

export function proposalDetail(doc: DocumentationProposalDocument): ProposalSummary & {
  originalContent: string;
  proposedContent: string;
  diff: string;
  explanations: { summary: string; explanation: string }[];
  provider: string | null;
  model: string | null;
  appliedCommitSha: string | null;
} {
  return {
    ...toProposalSummary(doc),
    originalContent: doc.originalContent,
    proposedContent: doc.proposedContent,
    diff: doc.diff,
    explanations: doc.explanations,
    provider: doc.provider,
    model: doc.model,
    appliedCommitSha: doc.appliedCommitSha,
  };
}

export class RunService {
  constructor(private readonly queue: JobQueue) {}

  /**
   * Schedules a queued run and stores its BullMQ job id. If the queue cannot be
   * reached the run is marked FAILED with an actionable error code instead of
   * being left in QUEUED forever, and the caller gets a 503 rather than a hang
   * or an opaque 500.
   */
  private async scheduleRun(
    run: DocumentationRunDocument,
    repositoryFullName: string | null,
    schedule: () => Promise<string>,
  ): Promise<void> {
    try {
      const jobId = await schedule();
      await DocumentationRun.updateOne({ _id: run._id }, { $set: { jobId } });
    } catch (error) {
      await DocumentationRun.updateOne(
        { _id: run._id, status: "QUEUED" },
        {
          $set: {
            status: "FAILED",
            completedAt: new Date(),
            errorCode: ERROR_CODES.NOT_READY,
            errorMessage: QUEUE_UNAVAILABLE_MESSAGE,
          },
        },
      ).catch(() => undefined);

      await recordActivity({
        userId: String(run.userId),
        repositoryId: run.repositoryId,
        repositoryFullName,
        runId: run._id,
        type: "FAILED",
        message: "Run could not be queued because the job queue is unavailable",
        logId: run.correlationId,
        metadata: { operation: run.operation, reason: ERROR_CODES.NOT_READY },
      }).catch(() => undefined);

      throw new AppError(ERROR_CODES.NOT_READY, QUEUE_UNAVAILABLE_MESSAGE, {
        httpStatus: 503,
        retryable: true,
        cause: error,
      });
    }
  }

  async start(
    userId: string,
    repositoryId: string,
    operation: Exclude<OperationType, "PROPOSAL_APPLY">,
  ): Promise<RunSummary> {
    const repository = await Repository.findOne({ _id: repositoryId, userId });
    if (!repository) {
      throw new AppError(ERROR_CODES.NOT_FOUND, "Repository not found", { httpStatus: 404 });
    }
    if (repository.trackingStatus === "DISCONNECTED") {
      throw new AppError(
        ERROR_CODES.REPOSITORY_DISCONNECTED,
        "This repository is disconnected. Reconnect it before running documentation jobs.",
        { httpStatus: 409 },
      );
    }

    const active = await DocumentationRun.findOne({
      repositoryId: repository._id,
      operation,
      status: { $in: ["QUEUED", "RUNNING", "RETRYING"] },
    });
    if (active) {
      throw new AppError(
        ERROR_CODES.CONFLICT,
        `A ${OPERATION_LABELS[operation].toLowerCase()} run is already in progress for this repository.`,
        { httpStatus: 409, details: { runId: String(active._id) } },
      );
    }

    const correlationId = `log_${newId()}`;
    const run = await DocumentationRun.create({
      userId,
      repositoryId: repository._id,
      operation,
      status: "QUEUED",
      correlationId,
      attempt: 1,
    });

    await recordActivity({
      userId,
      repositoryId: repository._id,
      repositoryFullName: repository.fullName,
      runId: run._id,
      type: "STARTED",
      message: `${OPERATION_LABELS[operation]} queued`,
      logId: correlationId,
      metadata: { operation },
    });

    await this.scheduleRun(run, repository.fullName, () =>
      this.queue.enqueueRun({
        runId: String(run._id),
        repositoryId: String(repository._id),
        userId,
        operation,
        correlationId,
        attempt: 1,
      }),
    );

    return toRunSummary(run);
  }

  async listForRepository(
    userId: string,
    repositoryId: string,
    options: { page: number; pageSize: number; operation?: OperationType; status?: RunStatus },
  ): Promise<{ items: RunSummary[]; total: number }> {
    const repository = await Repository.findOne({ _id: repositoryId, userId });
    if (!repository) {
      throw new AppError(ERROR_CODES.NOT_FOUND, "Repository not found", { httpStatus: 404 });
    }
    const filter: Record<string, unknown> = { repositoryId: repository._id };
    if (options.operation) filter.operation = options.operation;
    if (options.status) filter.status = options.status;
    const [docs, total] = await Promise.all([
      DocumentationRun.find(filter)
        .sort({ createdAt: -1 })
        .skip((options.page - 1) * options.pageSize)
        .limit(options.pageSize),
      DocumentationRun.countDocuments(filter),
    ]);
    return { items: docs.map(toRunSummary), total };
  }

  async get(userId: string, runId: string): Promise<{
    run: RunSummary;
    repositoryFullName: string | null;
    proposal: ProposalSummary | null;
    usage: DocumentationRunDocument["usage"];
    warnings: string[];
    analysisUnsupported: string[];
  }> {
    const run = await DocumentationRun.findOne({ _id: runId, userId });
    if (!run) throw new AppError(ERROR_CODES.NOT_FOUND, "Run not found", { httpStatus: 404 });
    const [repository, proposal] = await Promise.all([
      Repository.findById(run.repositoryId),
      DocumentationProposal.findOne({ runId: run._id }),
    ]);
    return {
      run: toRunSummary(run),
      repositoryFullName: repository?.fullName ?? null,
      proposal: proposal ? toProposalSummary(proposal) : null,
      usage: run.usage,
      warnings: run.warnings,
      analysisUnsupported: run.analysis?.unsupported ?? [],
    };
  }

  async proposalForRun(
    userId: string,
    runId: string,
  ): Promise<ReturnType<typeof proposalDetail>> {
    const proposal = await DocumentationProposal.findOne({ runId, userId });
    if (!proposal) {
      throw new AppError(ERROR_CODES.NOT_FOUND, "No proposal exists for this run", { httpStatus: 404 });
    }
    return proposalDetail(proposal);
  }

  async approve(userId: string, proposalId: string): Promise<RunSummary> {
    const proposal = await DocumentationProposal.findOne({ _id: proposalId, userId });
    if (!proposal) {
      throw new AppError(ERROR_CODES.NOT_FOUND, "Proposal not found", { httpStatus: 404 });
    }
    if (proposal.status !== "PENDING") {
      throw new AppError(
        ERROR_CODES.PROPOSAL_NOT_PENDING,
        `Proposal is ${proposal.status.toLowerCase()} and can no longer be approved.`,
        { httpStatus: 409 },
      );
    }

    const repository = await Repository.findOne({ _id: proposal.repositoryId, userId });
    if (!repository || repository.trackingStatus === "DISCONNECTED") {
      throw new AppError(
        ERROR_CODES.REPOSITORY_DISCONNECTED,
        "Repository is disconnected; reconnect it before applying documentation changes.",
        { httpStatus: 409 },
      );
    }

    const claimed = await DocumentationProposal.findOneAndUpdate(
      { _id: proposal._id, status: "PENDING" },
      { $set: { status: "APPROVED", reviewedAt: new Date(), reviewedBy: userId } },
      { new: true },
    );
    if (!claimed) {
      throw new AppError(ERROR_CODES.PROPOSAL_NOT_PENDING, "Proposal was already reviewed", {
        httpStatus: 409,
      });
    }

    const correlationId = `log_${newId()}`;
    const run = await DocumentationRun.create({
      userId,
      repositoryId: repository._id,
      operation: "PROPOSAL_APPLY",
      status: "QUEUED",
      correlationId,
      proposalId: claimed._id,
      baseCommitSha: claimed.baseCommitSha,
      baseReadmeHash: claimed.baseReadmeHash,
      attempt: 1,
      metadata: { proposalId: String(claimed._id) },
    });

    await recordActivity({
      userId,
      repositoryId: repository._id,
      repositoryFullName: repository.fullName,
      runId: run._id,
      type: "PROGRESS",
      message: "Proposal approved; applying documentation changes",
      logId: correlationId,
      metadata: { proposalId: String(claimed._id) },
    });

    try {
      await this.scheduleRun(run, repository.fullName, () =>
        this.queue.enqueueApply({
          runId: String(run._id),
          repositoryId: String(repository._id),
          userId,
          operation: "PROPOSAL_APPLY",
          correlationId,
          attempt: 1,
          proposalId: String(claimed._id),
        }),
      );
    } catch (error) {
      // The proposal was claimed above; put it back so the user can approve it
      // again once the queue is reachable.
      await DocumentationProposal.updateOne(
        { _id: claimed._id, status: "APPROVED" },
        { $set: { status: "PENDING", reviewedAt: null, reviewedBy: null } },
      ).catch(() => undefined);
      throw error;
    }

    return toRunSummary(run);
  }

  async reject(userId: string, proposalId: string): Promise<ProposalSummary> {
    const proposal = await DocumentationProposal.findOneAndUpdate(
      { _id: proposalId, userId, status: "PENDING" },
      { $set: { status: "REJECTED", reviewedAt: new Date(), reviewedBy: userId } },
      { new: true },
    );
    if (!proposal) {
      const existing = await DocumentationProposal.findOne({ _id: proposalId, userId });
      if (!existing) throw new AppError(ERROR_CODES.NOT_FOUND, "Proposal not found", { httpStatus: 404 });
      throw new AppError(
        ERROR_CODES.PROPOSAL_NOT_PENDING,
        `Proposal is ${existing.status.toLowerCase()} and cannot be rejected.`,
        { httpStatus: 409 },
      );
    }
    const repository = await Repository.findById(proposal.repositoryId);
    await recordActivity({
      userId,
      repositoryId: proposal.repositoryId,
      repositoryFullName: repository?.fullName ?? null,
      type: "CANCELLED",
      message: "Proposal rejected; the README was not modified",
      metadata: { proposalId: String(proposal._id) },
    });
    await Repository.updateOne(
      { _id: proposal.repositoryId },
      { $set: { documentationStatus: "STALE" } },
    );
    return toProposalSummary(proposal);
  }

  async cancel(userId: string, runId: string): Promise<RunSummary> {
    const run = await DocumentationRun.findOne({ _id: runId, userId });
    if (!run) throw new AppError(ERROR_CODES.NOT_FOUND, "Run not found", { httpStatus: 404 });
    if (!["QUEUED", "RUNNING", "RETRYING"].includes(run.status)) {
      throw new AppError(
        ERROR_CODES.CONFLICT,
        `Run is ${run.status.toLowerCase()} and can no longer be cancelled.`,
        { httpStatus: 409 },
      );
    }

    const cancelled = await DocumentationRun.findOneAndUpdate(
      { _id: run._id, status: { $in: ["QUEUED", "RUNNING", "RETRYING"] } },
      {
        $set: {
          status: "CANCELLED",
          completedAt: new Date(),
          errorCode: "CANCELLED_BY_USER",
          errorMessage: "Cancelled by the user before completion.",
        },
      },
      { new: true },
    );
    if (!cancelled) {
      throw new AppError(ERROR_CODES.CONFLICT, "Run changed state before it could be cancelled.", {
        httpStatus: 409,
      });
    }

    // Best effort: an active job is stopped by the worker's cancellation checks.
    await this.queue.cancelRun(run.jobId).catch(() => undefined);

    const repository = await Repository.findById(run.repositoryId);
    await recordActivity({
      userId,
      repositoryId: run.repositoryId,
      repositoryFullName: repository?.fullName ?? null,
      runId: run._id,
      jobId: run.jobId,
      type: "CANCELLED",
      message: "Documentation run cancelled by the user",
      metadata: { operation: run.operation },
    });
    return toRunSummary(cancelled);
  }

  async retry(userId: string, runId: string): Promise<RunSummary> {
    const run = await DocumentationRun.findOne({ _id: runId, userId });
    if (!run) throw new AppError(ERROR_CODES.NOT_FOUND, "Run not found", { httpStatus: 404 });
    if (!["FAILED", "CANCELLED", "SUCCEEDED"].includes(run.status)) {
      throw new AppError(
        ERROR_CODES.CONFLICT,
        "Only completed or failed runs can be retried or regenerated.",
        { httpStatus: 409 },
      );
    }
    if (run.operation === "PROPOSAL_APPLY") {
      const proposal = run.proposalId
        ? await DocumentationProposal.findById(run.proposalId)
        : null;
      if (proposal && proposal.status === "APPLIED") {
        throw new AppError(ERROR_CODES.CONFLICT, "This proposal was already applied.", {
          httpStatus: 409,
        });
      }
      throw new AppError(
        ERROR_CODES.UNSUPPORTED_OPERATION,
        "Retry the originating run instead of the apply step.",
        { httpStatus: 409 },
      );
    }

    const repository = await Repository.findOne({ _id: run.repositoryId, userId });
    if (!repository) throw new AppError(ERROR_CODES.NOT_FOUND, "Repository not found", { httpStatus: 404 });
    if (repository.trackingStatus === "DISCONNECTED") {
      throw new AppError(ERROR_CODES.REPOSITORY_DISCONNECTED, "Repository is disconnected.", {
        httpStatus: 409,
      });
    }

    const active = await DocumentationRun.findOne({
      repositoryId: repository._id,
      operation: run.operation,
      status: { $in: ["QUEUED", "RUNNING", "RETRYING"] },
    });
    if (active) {
      throw new AppError(ERROR_CODES.CONFLICT, "A run is already in progress for this operation.", {
        httpStatus: 409,
        details: { runId: String(active._id) },
      });
    }

    const correlationId = `log_${newId()}`;
    const newRun = await DocumentationRun.create({
      userId,
      repositoryId: repository._id,
      operation: run.operation,
      status: "QUEUED",
      correlationId,
      attempt: run.attempt + 1,
      metadata: { retriedFrom: String(run._id) },
    });
    await recordActivity({
      userId,
      repositoryId: repository._id,
      repositoryFullName: repository.fullName,
      runId: newRun._id,
      type: "RETRYING",
      message: `${OPERATION_LABELS[run.operation]} re-queued from a previous run`,
      logId: correlationId,
      metadata: { retriedFrom: String(run._id) },
    });
    await this.scheduleRun(newRun, repository.fullName, () =>
      this.queue.enqueueRun({
        runId: String(newRun._id),
        repositoryId: String(repository._id),
        userId,
        operation: run.operation,
        correlationId,
        attempt: run.attempt + 1,
      }),
    );
    return toRunSummary(newRun);
  }
}
