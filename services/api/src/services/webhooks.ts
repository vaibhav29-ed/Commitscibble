import { AppError, ERROR_CODES } from "@commitscibble/shared";
import {
  branchFromRef,
  isPushEvent,
  isSelfAuthoredPush,
  parsePushPayload,
} from "@commitscibble/github";
import { Repository, WebhookDelivery } from "@commitscibble/persistence";
import type { JobQueue } from "../lib/queue.js";
import type { Logger } from "../lib/logger.js";
import type { RepositoryService } from "./repositories.js";

export interface WebhookHandleResult {
  status: "QUEUED" | "IGNORED" | "DUPLICATE" | "REJECTED";
  message: string;
  deliveryId: string;
}

export class WebhookService {
  constructor(
    private readonly repositories: RepositoryService,
    private readonly queue: JobQueue,
    private readonly logger: Logger,
  ) {}

  /**
   * Persist delivery state, deduplicate by GitHub delivery id, filter irrelevant
   * pushes, then enqueue. The HTTP request never waits on documentation work.
   */
  async handle(input: {
    deliveryId: string;
    event: string;
    rawBody: string;
  }): Promise<WebhookHandleResult> {
    const receivedAt = new Date();

    if (!isPushEvent(input.event)) {
      await this.safeRecord(input.deliveryId, input.event, 0, "IGNORED");
      return {
        status: "IGNORED",
        message: `Event "${input.event}" is not handled`,
        deliveryId: input.deliveryId,
      };
    }

    let payload;
    try {
      payload = parsePushPayload(input.rawBody);
    } catch (error) {
      await this.safeRecord(input.deliveryId, input.event, 0, "IGNORED");
      this.logger.warn("Rejected malformed push payload", {
        deliveryId: input.deliveryId,
        error: error instanceof Error ? error.message : "invalid payload",
      });
      return {
        status: "REJECTED",
        message: "Push payload did not match the expected GitHub schema",
        deliveryId: input.deliveryId,
      };
    }

    try {
      await WebhookDelivery.create({
        deliveryId: input.deliveryId,
        event: input.event,
        repositoryGithubId: payload.repository.id,
        processingStatus: "RECEIVED",
        payloadSummary: {
          ref: payload.ref,
          before: payload.before,
          after: payload.after,
          commitCount: payload.commits.length,
          forced: Boolean(payload.forced),
          deleted: Boolean(payload.deleted),
        },
        receivedAt,
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        return {
          status: "DUPLICATE",
          message: "This webhook delivery was already received",
          deliveryId: input.deliveryId,
        };
      }
      throw error;
    }

    const repository = await this.repositories.findConnectedByGithubId(payload.repository.id);
    if (!repository) {
      await this.complete(input.deliveryId, "IGNORED", "REPOSITORY_NOT_CONNECTED");
      return {
        status: "IGNORED",
        message: "Repository is not connected or tracking is disabled",
        deliveryId: input.deliveryId,
      };
    }

    if (payload.installation?.id && repository.githubInstallationId !== payload.installation.id) {
      await Repository.updateOne(
        { _id: repository._id },
        { $set: { githubInstallationId: payload.installation.id } },
      );
    }

    const targetBranch = repository.settings.targetBranch ?? repository.defaultBranch;
    const branch = branchFromRef(payload.ref);
    if (branch !== targetBranch) {
      await this.complete(input.deliveryId, "IGNORED", "BRANCH_NOT_TRACKED");
      return {
        status: "IGNORED",
        message: `Branch "${branch}" is not the tracked documentation branch`,
        deliveryId: input.deliveryId,
      };
    }

    if (payload.deleted) {
      await this.complete(input.deliveryId, "IGNORED", "BRANCH_DELETED");
      return { status: "IGNORED", message: "Branch deletion ignored", deliveryId: input.deliveryId };
    }

    if (isSelfAuthoredPush(payload)) {
      await this.complete(input.deliveryId, "IGNORED", "SELF_AUTHORED_PUSH");
      return {
        status: "IGNORED",
        message: "Push only contains CommitScibble documentation commits",
        deliveryId: input.deliveryId,
      };
    }

    await WebhookDelivery.updateOne(
      { deliveryId: input.deliveryId },
      { $set: { repositoryId: repository._id, processingStatus: "QUEUED" } },
    );

    const jobId = await this.queue.enqueueWebhook({ deliveryId: input.deliveryId });
    await WebhookDelivery.updateOne({ deliveryId: input.deliveryId }, { $set: { jobId } });

    return {
      status: "QUEUED",
      message: "Push accepted for incremental documentation processing",
      deliveryId: input.deliveryId,
    };
  }

  private async safeRecord(
    deliveryId: string,
    event: string,
    repositoryGithubId: number,
    status: "IGNORED",
  ): Promise<void> {
    try {
      await WebhookDelivery.updateOne(
        { deliveryId },
        {
          $setOnInsert: {
            deliveryId,
            event,
            repositoryGithubId,
            processingStatus: status,
            receivedAt: new Date(),
            completedAt: new Date(),
          },
        },
        { upsert: true },
      );
    } catch (error) {
      this.logger.warn("Failed to record ignored webhook delivery", {
        deliveryId,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  private async complete(
    deliveryId: string,
    status: "IGNORED" | "FAILED",
    errorCode: string,
  ): Promise<void> {
    await WebhookDelivery.updateOne(
      { deliveryId },
      { $set: { processingStatus: status, errorCode, completedAt: new Date() } },
    );
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11000
  );
}

export function assertWebhookConfigured(secret: string | undefined): asserts secret is string {
  if (!secret) {
    throw new AppError(
      ERROR_CODES.INTERNAL_ERROR,
      "GitHub webhook secret is not configured",
      { httpStatus: 503 },
    );
  }
}
