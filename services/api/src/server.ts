import {
  aiConfig,
  assertServiceEnv,
  isAiConfigured,
  loadEnv,
} from "@commitscibble/config";
import { connectDatabase, disconnectDatabase, initializeIndexes } from "@commitscibble/persistence";
import { createApp } from "./app.js";
import { createLogger } from "./lib/logger.js";
import { JobQueue } from "./lib/queue.js";
import { createRedisRateLimitStore, setRateLimitStore } from "./lib/rate-limit.js";
import { createServices } from "./services/index.js";

async function main(): Promise<void> {
  const env = loadEnv();
  assertServiceEnv(env, { role: "api" });
  const logger = createLogger(env.LOG_LEVEL);

  await connectDatabase({ uri: env.MONGO_URI as string });
  await initializeIndexes({
    auditRetentionDays: env.AUDIT_RETENTION_DAYS,
    webhookRetentionDays: env.WEBHOOK_RETENTION_DAYS,
  });
  logger.info("MongoDB connected and indexes initialized");

  const queue = new JobQueue(env.REDIS_URL as string);
  const rateLimiter = createRedisRateLimitStore(env.REDIS_URL as string);
  setRateLimitStore(rateLimiter.store);
  const services = createServices(env, logger, queue);
  const settings = aiConfig(env);
  const aiProviders = [settings.primary, settings.fallback]
    .filter((provider): provider is NonNullable<typeof provider> => Boolean(provider))
    .filter((provider, index, list) => list.indexOf(provider) === index);
  if (!isAiConfigured(env)) {
    logger.warn("No AI provider is configured; documentation runs will fail until a key is set", {
      primary: settings.primary,
    });
  }

  const missingRealtimeKeys = [
    env.CONVEX_URL ? null : "CONVEX_URL",
    env.COMMITSCIBBLE_PUBLISH_TOKEN ? null : "COMMITSCIBBLE_PUBLISH_TOKEN",
  ].filter((key): key is string => key !== null);
  if (missingRealtimeKeys.length > 0) {
    logger.warn(
      "Convex realtime is not fully configured; the dashboard will poll for activity updates",
      { missing: missingRealtimeKeys },
    );
  }

  const app = createApp({
    env,
    logger,
    services,
    queue: {
      health: () => queue.health(),
      enqueueOutboxSweep: () => queue.enqueueOutboxSweep(),
    },
    aiProviders: aiProviders.filter((provider) => provider !== "mock" || env.AI_ALLOW_MOCK),
  });

  const server = app.listen(env.PORT, () => {
    logger.info("CommitScibble API listening", {
      port: env.PORT,
      environment: env.NODE_ENV,
      appUrl: env.APP_URL,
    });
  });

  const queueReady = await queue.waitUntilReady();
  if (queueReady) {
    logger.info("Redis queue connection ready");
  } else {
    logger.error(
      "Redis is unreachable; documentation runs cannot be queued until it is available",
      { hint: "Start Redis (docker compose up -d redis) or point REDIS_URL at a reachable instance" },
    );
  }

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info("Shutting down API", { signal });
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rateLimiter.close().catch(() => undefined);
    await queue.close().catch(() => undefined);
    await disconnectDatabase().catch(() => undefined);
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled promise rejection", {
      error: reason instanceof Error ? reason.message : String(reason),
    });
  });
  process.on("uncaughtException", (error) => {
    logger.error("Uncaught exception", { error: error.message });
    void shutdown("uncaughtException");
  });
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${JSON.stringify({
      level: "error",
      message: "API failed to start",
      error: error instanceof Error ? error.message : String(error),
    })}\n`,
  );
  process.exit(1);
});
