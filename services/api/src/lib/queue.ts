import { Queue } from "bullmq";
import IORedis from "ioredis";
import {
  JOB_NAMES,
  QUEUE_NAMES,
  type OperationType,
} from "@commitscibble/shared";

export interface DocumentationJobData {
  runId: string;
  repositoryId: string;
  userId: string;
  operation: OperationType;
  correlationId: string;
  attempt: number;
  proposalId?: string;
}

export interface WebhookJobData {
  deliveryId: string;
}

function jobNameFor(operation: OperationType): string {
  switch (operation) {
    case "GENERATE":
      return JOB_NAMES.GENERATE;
    case "INCREMENTAL_UPDATE":
      return JOB_NAMES.INCREMENTAL_UPDATE;
    case "CLEANUP":
      return JOB_NAMES.CLEANUP;
    case "RESYNC":
      return JOB_NAMES.RESYNC;
    case "PROPOSAL_APPLY":
      return JOB_NAMES.PROPOSAL_APPLY;
    default:
      return JOB_NAMES.GENERATE;
  }
}

/**
 * BullMQ producer. Connections are created lazily so importing the API (for
 * tests or tooling) does not require a running Redis.
 */
export class JobQueue {
  private redis: IORedis | null = null;
  private documentation: Queue<DocumentationJobData> | null = null;
  private webhooks: Queue<WebhookJobData> | null = null;
  private outbox: Queue | null = null;

  constructor(private readonly redisUrl: string) {}

  private connection(): IORedis {
    if (!this.redis) {
      this.redis = new IORedis(this.redisUrl, {
        maxRetriesPerRequest: null,
        enableReadyCheck: true,
        lazyConnect: false,
      });
    }
    return this.redis;
  }

  private docsQueue(): Queue<DocumentationJobData> {
    if (!this.documentation) {
      this.documentation = new Queue<DocumentationJobData>(QUEUE_NAMES.documentation, {
        connection: this.connection(),
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "exponential", delay: 5000 },
          removeOnComplete: { count: 1000 },
          removeOnFail: { count: 5000 },
        },
      });
    }
    return this.documentation;
  }

  private webhookQueue(): Queue<WebhookJobData> {
    if (!this.webhooks) {
      this.webhooks = new Queue<WebhookJobData>(QUEUE_NAMES.webhooks, {
        connection: this.connection(),
        defaultJobOptions: {
          attempts: 4,
          backoff: { type: "exponential", delay: 3000 },
          removeOnComplete: { count: 2000 },
          removeOnFail: { count: 5000 },
        },
      });
    }
    return this.webhooks;
  }

  private outboxQueue(): Queue {
    if (!this.outbox) {
      this.outbox = new Queue(QUEUE_NAMES.outbox, {
        connection: this.connection(),
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: "exponential", delay: 2000 },
          removeOnComplete: { count: 500 },
          removeOnFail: { count: 1000 },
        },
      });
    }
    return this.outbox;
  }

  async enqueueRun(data: DocumentationJobData): Promise<string> {
    const jobId = `run:${data.runId}`;
    await this.docsQueue().add(jobNameFor(data.operation), data, { jobId });
    return jobId;
  }

  async enqueueApply(data: DocumentationJobData): Promise<string> {
    const jobId = `apply:${data.proposalId ?? data.runId}`;
    await this.docsQueue().add(JOB_NAMES.PROPOSAL_APPLY, data, { jobId });
    return jobId;
  }

  async enqueueWebhook(data: WebhookJobData): Promise<string> {
    const jobId = `webhook:${data.deliveryId}`;
    await this.webhookQueue().add(JOB_NAMES.WEBHOOK_PUSH, data, { jobId });
    return jobId;
  }

  async enqueueOutboxSweep(): Promise<void> {
    await this.outboxQueue().add(
      JOB_NAMES.OUTBOX_DELIVER,
      {},
      { jobId: `outbox:${Date.now()}`, removeOnComplete: true },
    );
  }

  async health(): Promise<boolean> {
    try {
      const connection = this.connection();
      if (connection.status === "ready") return true;
      await connection.connect();
      await connection.ping();
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    await Promise.all([
      this.documentation?.close(),
      this.webhooks?.close(),
      this.outbox?.close(),
    ]);
    if (this.redis) this.redis.disconnect();
    this.documentation = null;
    this.webhooks = null;
    this.outbox = null;
    this.redis = null;
  }
}
