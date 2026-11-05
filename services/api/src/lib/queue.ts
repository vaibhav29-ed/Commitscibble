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

/**
 * Bounds every queue write so an unresponsive Redis can never hang an HTTP
 * request. The underlying command keeps a rejection handler attached, so a late
 * failure cannot surface as an unhandled rejection.
 */
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

/**
 * BullMQ rejects custom job ids containing ":" because the id is embedded in
 * the Redis key (`bull:<queue>:<id>`). Build every id through this helper so a
 * caller cannot reintroduce the "Custom Id cannot contain :" failure.
 */
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
        // Keep ioredis' offline queue enabled. BullMQ sends INFO while it
        // constructs a Queue, which happens before the socket is ready;
        // disabling the queue makes that constructor throw ("Stream isn't
        // writeable"). Enqueue calls are bounded by withTimeout() instead.
        connectTimeout: 10_000,
        lazyConnect: false,
      });
      // Connection failures are surfaced by health()/ensureReady() and end up in
      // the API log; without a listener ioredis would print every retry to stderr.
      this.redis.on("error", () => undefined);
    }
    return this.redis;
  }

  /**
   * Resolves true once the client is usable, or false if that does not happen
   * within `timeoutMs`. Never rejects.
   */
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

  /**
   * Fails fast (and with a clear message) when Redis cannot be reached, instead
   * of letting a queue command sit in the offline queue until withTimeout fires.
   */
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
    // BullMQ rejects custom ids containing ":" (they are used as Redis key
    // segments), so use a dash-delimited prefix instead.
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

  /**
   * Removes a queued job before it starts. Active jobs are left alone: the
   * worker observes the persisted CANCELLED status at its next checkpoint.
   */
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

  /**
   * Waits up to `timeoutMs` for the connection to become usable. Used at boot so
   * an unreachable Redis is reported once, in the startup log, instead of only
   * when the first run is requested.
   */
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
