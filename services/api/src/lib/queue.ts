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

const ENQUEUE_TIMEOUT_MS = 5_000;
const READY_TIMEOUT_MS = 3_000;

async function withTimeout<T>(operation: Promise<T>, timeoutMs = ENQUEUE_TIMEOUT_MS): Promise<T> {
  return await new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Timed out waiting for Redis to accept the job")),
      timeoutMs,
    );
    operation.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

export function queueJobId(prefix: "run" | "apply" | "webhook" | "outbox", id: string | number): string {
  return `${prefix}-${id}`;
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
        connectTimeout: 10_000,
        lazyConnect: false,
      });
      this.redis.on("error", () => undefined);
    }
    return this.redis;
  }

  private async waitForReady(connection: IORedis, timeoutMs: number): Promise<boolean> {
    if (connection.status === "ready") return true;
    if (connection.status === "end") return false;
    return await new Promise<boolean>((resolve) => {
      const onReady = (): void => {
        clearTimeout(timer);
        connection.off("ready", onReady);
        resolve(true);
      };
      const timer = setTimeout(() => {
        connection.off("ready", onReady);
        resolve(false);
      }, timeoutMs);
      connection.once("ready", onReady);
    });
  }

  private async ensureReady(timeoutMs = READY_TIMEOUT_MS): Promise<void> {
    if (await this.waitForReady(this.connection(), timeoutMs)) return;
    throw new Error(
      "Redis is not reachable; jobs cannot be queued. Check REDIS_URL and that Redis is running.",
    );
  }

  private docsQueue(): Queue<DocumentationJobData> {
    if (!this.documentation) {
      this.documentation = new Queue<DocumentationJobData>(QUEUE_NAMES.documentation, {
        connection: this.connection(),
        skipWaitingForReady: true,
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
        skipWaitingForReady: true,
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
        skipWaitingForReady: true,
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
    await this.ensureReady();
    const jobId = queueJobId("run", data.runId);
    await withTimeout(this.docsQueue().add(jobNameFor(data.operation), data, { jobId }));
    return jobId;
  }

  async enqueueApply(data: DocumentationJobData): Promise<string> {
    await this.ensureReady();
    const jobId = queueJobId("apply", data.proposalId ?? data.runId);
    await withTimeout(this.docsQueue().add(JOB_NAMES.PROPOSAL_APPLY, data, { jobId }));
    return jobId;
  }

  async cancelRun(jobId: string | null): Promise<void> {
    if (!jobId) return;
    await this.ensureReady();
    await withTimeout(
      (async () => {
        const job = await this.docsQueue().getJob(jobId);
        if (!job) return;
        const state = await job.getState();
        if (state !== "waiting" && state !== "delayed" && state !== "prioritized") return;
        await job.remove();
      })(),
    );
  }

  async enqueueWebhook(data: WebhookJobData): Promise<string> {
    await this.ensureReady();
    const jobId = queueJobId("webhook", data.deliveryId);
    await withTimeout(this.webhookQueue().add(JOB_NAMES.WEBHOOK_PUSH, data, { jobId }));
    return jobId;
  }

  async enqueueOutboxSweep(): Promise<void> {
    await this.ensureReady();
    await withTimeout(
      this.outboxQueue().add(JOB_NAMES.OUTBOX_DELIVER, {}, {
        jobId: queueJobId("outbox", Date.now()),
        removeOnComplete: true,
      }),
    );
  }

  async health(): Promise<boolean> {
    try {
      const connection = this.connection();
      if (connection.status !== "ready") return false;
      const pong = await connection.ping();
      return pong === "PONG";
    } catch {
      return false;
    }
  }

  async waitUntilReady(timeoutMs = 3_000): Promise<boolean> {
    return await this.waitForReady(this.connection(), timeoutMs);
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
