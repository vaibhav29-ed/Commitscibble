import { Worker } from "bullmq";
import {
  aiConfig,
  assertServiceEnv,
  convexPublisherConfig,
  emailConfig,
  loadEnv,
} from "@commitscibble/config";
import { createEmailSender } from "@commitscibble/email";
import {
  connectDatabase,
  disconnectDatabase,
  drainOutbox,
  initializeIndexes,
  createActivityPublisher,
} from "@commitscibble/persistence";
import { createOrchestrator, DocumentationAi } from "@commitscibble/ai-engine";
import { QUEUE_NAMES } from "@commitscibble/shared";
import { Queue } from "bullmq";
import { createLogger } from "./lib/logger.js";
import { createRedisConnection, WorkerQueueProducer } from "./queue.js";
import { processDocumentationJob, processWebhookJob } from "./processors.js";
import { recoverStaleRuns } from "./recovery.js";
import { describeError } from "./lib/errors.js";
import type { WorkerDeps } from "./lib/context.js";

const STARTUP_VARS = [
  "MONGO_URI",
  "REDIS_URL",
  "TOKEN_ENCRYPTION_KEY",
  "GITHUB_WEBHOOK_SECRET",
  "GEMINI_API_KEY",
  "GEMINI_MODEL",
  "GROQ_API_KEY",
  "GROQ_MODEL",
  "AI_PROVIDER_PRIMARY",
  "AI_PROVIDER_FALLBACK",
] as const;

async function main(): Promise<void> {
  process.stdout.write(
    `Worker environment: ${STARTUP_VARS.map((key) => `${key}=${process.env[key] ? "set" : "missing"}`).join(", ")}\n`,
  );

  const env = loadEnv();
  assertServiceEnv(env, { role: "worker" });
  const logger = createLogger(env.LOG_LEVEL);

  logger.info("AI configuration", {
    primaryProvider: env.AI_PROVIDER_PRIMARY,
    fallbackProvider: env.AI_PROVIDER_FALLBACK ?? null,
    geminiModel: env.GEMINI_MODEL,
    geminiKeyConfigured: Boolean(env.GEMINI_API_KEY),
    groqModel: env.GROQ_MODEL,
    groqKeyConfigured: Boolean(env.GROQ_API_KEY),
    maxRetries: env.AI_MAX_RETRIES,
    timeoutMs: env.AI_TIMEOUT_MS,
  });

  await connectDatabase({ uri: env.MONGO_URI as string });
  await initializeIndexes({
    auditRetentionDays: env.AUDIT_RETENTION_DAYS,
    webhookRetentionDays: env.WEBHOOK_RETENTION_DAYS,
  });
  logger.info("Worker connected to MongoDB");

  await recoverStaleRuns(env, logger);

  const publisher = createActivityPublisher(convexPublisherConfig(env));
  if (!convexPublisherConfig(env)) {
    logger.warn("Convex realtime is not configured; activity events will be marked SKIPPED");
  }

  const orchestrator = createOrchestrator(aiConfig(env), {
    onUsage: (record) => {
      logger.debug("AI usage", {
        provider: record.provider,
        model: record.model,
        operation: record.operation,
        attempt: record.attempt,
        latencyMs: record.latencyMs,
        outcome: record.outcome,
        errorCode: record.errorCode,
      });
    },
  });
  if (orchestrator.providers.length === 0) {
    logger.warn("No AI providers configured; documentation jobs will fail until keys are set");
  }
  logger.info("AI provider chain", {
    chain: orchestrator.providers.map((provider) => `${provider.name}:${provider.model}`),
  });
  const ai = new DocumentationAi(orchestrator);

  const email = createEmailSender(emailConfig(env), {
    onError: (message) => logger.warn("Email delivery failed", { error: message }),
  });
  if (!email.enabled) {
    logger.info("Transactional email is not configured; notifications are disabled");
  }

  const redisUrl = env.REDIS_URL as string;
  const docsConnection = createRedisConnection(redisUrl);
  const webhookConnection = createRedisConnection(redisUrl);
  const outboxConnection = createRedisConnection(redisUrl);
  const producer = new WorkerQueueProducer(outboxConnection);

  const deps: WorkerDeps = {
    env,
    logger,
    ai,
    email,
    nudgeOutbox: () => producer.nudgeOutbox(),
  };

  const docsWorker = new Worker<import("./queue.js").DocumentationJobData>(
    QUEUE_NAMES.documentation,
    (job) => processDocumentationJob(deps, job),
    {
      connection: docsConnection,
      concurrency: env.NODE_ENV === "test" ? 1 : 2,
      lockDuration: 300_000,
      autorun: false,
    },
  );

  const webhookWorker = new Worker<import("./queue.js").WebhookJobData>(
    QUEUE_NAMES.webhooks,
    (job) => processWebhookJob(deps, job),
    {
      connection: webhookConnection,
      concurrency: 2,
      lockDuration: 300_000,
      autorun: false,
    },
  );

  const outboxQueue = new Queue(QUEUE_NAMES.outbox, { connection: outboxConnection });
  const outboxWorker = new Worker(
    QUEUE_NAMES.outbox,
    async () => {
      const result = await drainOutbox(publisher, { limit: 100 });
      if (result.published + result.skipped + result.failed > 0) {
        logger.debug("Outbox delivery sweep", { ...result });
      }
    },
    {
      connection: outboxConnection,
      concurrency: 1,
      autorun: false,
    },
  );

  for (const worker of [docsWorker, webhookWorker, outboxWorker]) {
    worker.on("failed", (job, error) => {
      const diagnostics = describeError(error);
      logger.error("Job failed", {
        queue: worker.name,
        jobId: job?.id ?? null,
        runId: (job?.data as { runId?: string } | undefined)?.runId ?? null,
        attemptsMade: job?.attemptsMade ?? null,
        maxAttempts: job?.opts?.attempts ?? null,
        unrecoverable: error.name === "UnrecoverableError",
        ...diagnostics,
      });
    });
    worker.on("error", (error) => {
      const diagnostics = describeError(error);
      logger.error("Worker connection error", { queue: worker.name, ...diagnostics });
    });
  }

  await Promise.all([docsWorker.run(), webhookWorker.run(), outboxWorker.run()]);
  logger.info("CommitScibble workers started", { queues: Object.values(QUEUE_NAMES) });

  await producer.nudgeOutbox();
  const sweep = setInterval(() => {
    producer.nudgeOutbox().catch((error: unknown) => {
      logger.warn("Outbox sweep enqueue failed", {
        error: error instanceof Error ? error.message : "unknown",
      });
    });
  }, 5000);
  sweep.unref();

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    clearInterval(sweep);
    logger.info("Shutting down worker; waiting for active jobs", { signal });
    await Promise.all([
      docsWorker.close(),
      webhookWorker.close(),
      outboxWorker.close(),
    ]).catch(() => undefined);
    await outboxQueue.close().catch(() => undefined);
    await producer.close().catch(() => undefined);
    docsConnection.disconnect();
    webhookConnection.disconnect();
    outboxConnection.disconnect();
    await disconnectDatabase().catch(() => undefined);
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled rejection in worker", { ...describeError(reason) });
  });
  process.on("uncaughtException", (error) => {
    logger.error("Uncaught exception in worker", { ...describeError(error) });
    void shutdown("uncaughtException");
  });
}

main().catch((error: unknown) => {
  const detail = error instanceof Error ? (error.stack ?? error.message) : String(error);
  process.stderr.write(`Worker failed to start: ${detail}\n`);
  process.exit(1);
});
