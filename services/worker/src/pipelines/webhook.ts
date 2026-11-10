import { AppError, ERROR_CODES, redactSecrets } from "@commitscibble/shared";
import { newId } from "@commitscibble/shared/node";
import {
  DocumentationRun,
  Repository,
  WebhookDelivery,
  recordActivity,
} from "@commitscibble/persistence";
import { prepareRun, type WorkerDeps } from "../lib/context.js";
import { executeIncremental } from "./incremental.js";

export async function runWebhookPush(
  deps: WorkerDeps,
  data: { deliveryId: string },
): Promise<void> {
  const delivery = await WebhookDelivery.findOne({ deliveryId: data.deliveryId });
  if (!delivery) {
    deps.logger.warn("Webhook delivery record is missing", { deliveryId: data.deliveryId });
    return;
  }
  if (["PROCESSED", "IGNORED", "DUPLICATE"].includes(delivery.processingStatus)) {
    return;
  }

  const repository = delivery.repositoryId
    ? await Repository.findById(delivery.repositoryId)
    : await Repository.findOne({ githubRepoId: delivery.repositoryGithubId });

  if (!repository || repository.trackingStatus !== "CONNECTED") {
    await WebhookDelivery.updateOne(
      { _id: delivery._id },
      {
        $set: {
          processingStatus: "IGNORED",
          errorCode: "REPOSITORY_NOT_CONNECTED",
          completedAt: new Date(),
        },
      },
    );
    return;
  }

  const headSha = delivery.payloadSummary?.after ?? null;
  if (!headSha) {
    await WebhookDelivery.updateOne(
      { _id: delivery._id },
      { $set: { processingStatus: "IGNORED", errorCode: "MISSING_AFTER_SHA", completedAt: new Date() } },
    );
    return;
  }

  if (repository.lastProcessedCommitSha === headSha) {
    await WebhookDelivery.updateOne(
      { _id: delivery._id },
      { $set: { processingStatus: "IGNORED", errorCode: "ALREADY_PROCESSED", completedAt: new Date() } },
    );
    return;
  }

  let run = delivery.runId ? await DocumentationRun.findById(delivery.runId) : null;
  if (!run) {
    const correlationId = `log_${newId()}`;
    run = await DocumentationRun.create({
      userId: repository.userId,
      repositoryId: repository._id,
      operation: "INCREMENTAL_UPDATE",
      status: "QUEUED",
      correlationId,
      jobId: `webhook-${data.deliveryId}`,
      attempt: 1,
      metadata: { source: "webhook", deliveryId: data.deliveryId },
    });
    await WebhookDelivery.updateOne(
      { _id: delivery._id },
      { $set: { runId: run._id, repositoryId: repository._id } },
    );
    await recordActivity({
      userId: repository.userId,
      repositoryId: repository._id,
      repositoryFullName: repository.fullName,
      runId: run._id,
      jobId: `webhook-${data.deliveryId}`,
      type: "STARTED",
      message: `Push received on ${repository.defaultBranch}; queued incremental documentation analysis`,
      logId: correlationId,
      metadata: { deliveryId: data.deliveryId },
    });
    void deps.nudgeOutbox().catch(() => undefined);
  }

  try {
    const prepared = await prepareRun(deps, String(run._id));
    if (prepared) {
      await executeIncremental(deps, prepared);
    }
    await WebhookDelivery.updateOne(
      { _id: delivery._id },
      { $set: { processingStatus: "PROCESSED", completedAt: new Date() } },
    );
  } catch (error) {
    await WebhookDelivery.updateOne(
      { _id: delivery._id },
      {
        $set: {
          processingStatus: "FAILED",
          errorCode: error instanceof AppError ? error.code : ERROR_CODES.INTERNAL_ERROR,
          errorMessage: redactSecrets(error instanceof Error ? error.message : "webhook processing failed").slice(0, 300),
          completedAt: new Date(),
        },
      },
    );
    throw error;
  }
}

export async function markDeliveryFailed(runId: string, error: unknown): Promise<void> {
  const run = await DocumentationRun.findById(runId);
  if (!run) return;
  await WebhookDelivery.updateOne(
    { runId: run._id },
    {
      $set: {
        processingStatus: "FAILED",
        errorCode: error instanceof AppError ? error.code : ERROR_CODES.INTERNAL_ERROR,
        completedAt: new Date(),
      },
    },
  );
}

export async function completeDeliveryForRun(runId: string): Promise<void> {
  await WebhookDelivery.updateOne(
    { runId },
    { $set: { processingStatus: "PROCESSED", completedAt: new Date() } },
  );
}
