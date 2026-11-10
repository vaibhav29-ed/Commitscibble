import { Queue } from "bullmq";
import IORedis from "ioredis";
import { JOB_NAMES, QUEUE_NAMES, type OperationType } from "@commitscibble/shared";

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

export function createRedisConnection(url: string): IORedis {
  return new IORedis(url, { maxRetriesPerRequest: null, enableReadyCheck: true });
}

export class WorkerQueueProducer {
  private queue: Queue | null = null;

  constructor(private readonly connection: IORedis) {}

  private outboxQueue(): Queue {
    if (!this.queue) {
      this.queue = new Queue(QUEUE_NAMES.outbox, {
        connection: this.connection,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "exponential", delay: 2000 },
          removeOnComplete: { count: 200 },
          removeOnFail: { count: 500 },
        },
      });
    }
    return this.queue;
  }

  async nudgeOutbox(): Promise<void> {
    const bucket = Math.floor(Date.now() / 2000);
    await this.outboxQueue().add(JOB_NAMES.OUTBOX_DELIVER, {}, { jobId: `outbox-${bucket}` });
  }

  async close(): Promise<void> {
    await this.queue?.close();
    this.queue = null;
  }
}
