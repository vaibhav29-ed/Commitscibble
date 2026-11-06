import { AppError, ERROR_CODES, JOB_NAMES } from "@commitscibble/shared";
import type { Job } from "bullmq";
import type { DocumentationJobData, WebhookJobData } from "./queue.js";
import { RunCancelledError, type WorkerDeps } from "./lib/context.js";
import { runGenerate, executeFullGeneration } from "./pipelines/generate.js";
import { runIncremental } from "./pipelines/incremental.js";
import { runCleanup } from "./pipelines/cleanup.js";
import { runWebhookPush } from "./pipelines/webhook.js";
import { prepareRun, failRun } from "./lib/context.js";
import { applyProposal } from "./pipelines/apply.js";
import { DocumentationProposal } from "@commitscibble/persistence";
import { toQueueError } from "./lib/errors.js";

const JOB_TIMEOUT_MS = 20 * 60 * 1000;

export async function processDocumentationJob(
  deps: WorkerDeps,
  job: Job<DocumentationJobData>,
): Promise<void> {
  try {
    await runDocumentationJob(deps, job);
  } catch (error) {
    // Permanent failures (missing key, rejected model, invalid request) fail
    // the same way on every BullMQ attempt, so mark them unrecoverable instead
    // of replaying them and burning provider quota.
    throw toQueueError(error);
  }
}

async function runDocumentationJob(
  deps: WorkerDeps,
  job: Job<DocumentationJobData>,
): Promise<void> {
  switch (job.name) {
    case JOB_NAMES.GENERATE:
      await withTimeout(runGenerate(deps, job.data), JOB_TIMEOUT_MS, job.data.runId);
      return;
    case JOB_NAMES.INCREMENTAL_UPDATE:
      await withTimeout(runIncremental(deps, job.data), JOB_TIMEOUT_MS, job.data.runId);
      return;
    case JOB_NAMES.CLEANUP:
      await withTimeout(runCleanup(deps, job.data), JOB_TIMEOUT_MS, job.data.runId);
      return;
    case JOB_NAMES.RESYNC:
      await withTimeout(runResync(deps, job.data), JOB_TIMEOUT_MS, job.data.runId);
      return;
    case JOB_NAMES.PROPOSAL_APPLY:
      await withTimeout(runApply(deps, job.data), JOB_TIMEOUT_MS, job.data.runId);
      return;
    default:
      throw new AppError(ERROR_CODES.UNSUPPORTED_OPERATION, `Unsupported job name: ${job.name}`);
  }
}

async function runResync(deps: WorkerDeps, data: DocumentationJobData): Promise<void> {
  const prepared = await prepareRun(deps, data.runId);
  if (!prepared) return;
  try {
    await executeFullGeneration(deps, prepared, {
      advanceOnReview: false,
      reason: "Repository resynchronization",
      summaryPrefix: "README resynchronized with the current repository state.",
    });
  } catch (error) {
    if (error instanceof RunCancelledError) return;
    await failRun(deps, prepared.run, error);
    throw error;
  }
}

async function runApply(deps: WorkerDeps, data: DocumentationJobData): Promise<void> {
  const prepared = await prepareRun(deps, data.runId);
  if (!prepared) return;
  try {
    // The proposal belongs to the originating run, not to this apply run, so it
    // is resolved by id and ownership, then checked against the repository.
    const proposal = await DocumentationProposal.findOne({
      _id: data.proposalId,
      userId: prepared.run.userId,
    });
    if (!proposal || String(proposal.repositoryId) !== String(prepared.repository._id)) {
      throw new AppError(ERROR_CODES.NOT_FOUND, "Proposal for this apply job no longer exists");
    }
    if (proposal.status === "APPLIED") {
      return;
    }
    await applyProposal({
      deps,
      prepared,
      client: prepared.client,
      branch: prepared.branch,
      proposal,
    });
  } catch (error) {
    if (error instanceof RunCancelledError) return;
    await failRun(deps, prepared.run, error);
    throw error;
  }
}

export async function processWebhookJob(
  deps: WorkerDeps,
  job: Job<WebhookJobData>,
): Promise<void> {
  await withTimeout(runWebhookPush(deps, job.data), JOB_TIMEOUT_MS, null);
}

function withTimeout<T>(promise: Promise<T>, ms: number, runId: string | null): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new AppError(
          ERROR_CODES.INTERNAL_ERROR,
          `Job exceeded the ${Math.round(ms / 60000)} minute time limit.`,
          { retryable: true, details: { runId } },
        ),
      );
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
