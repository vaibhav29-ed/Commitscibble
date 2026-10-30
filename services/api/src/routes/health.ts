import { Router } from "express";
import { databaseState, pingDatabase } from "@commitscibble/persistence";
import type { Env } from "@commitscibble/config";
import type { JobQueue } from "../lib/queue.js";

export interface HealthDependencies {
  env: Env;
  queue: Pick<JobQueue, "health">;
  startedAt: number;
  aiProviders: string[];
}

export function createHealthRouter(deps: HealthDependencies): Router {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      uptimeSeconds: Math.round((Date.now() - deps.startedAt) / 1000),
      environment: deps.env.NODE_ENV,
    });
  });

  router.get("/ready", async (_req, res) => {
    const [mongoHealthy, redisHealthy] = await Promise.all([
      pingDatabase().catch(() => false),
      deps.queue.health().catch(() => false),
    ]);

    const ready = mongoHealthy && redisHealthy;
    res.status(ready ? 200 : 503).json({
      status: ready ? "ready" : "not_ready",
      checks: {
        mongodb: mongoHealthy ? "ok" : `unavailable (${databaseState()})`,
        redis: redisHealthy ? "ok" : "unavailable",
      },
      ai: {
        configuredProviders: deps.aiProviders,
        configured: deps.aiProviders.length > 0,
      },
    });
  });

  return router;
}
