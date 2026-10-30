import express, { type NextFunction, type Request, type Response } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { loadEnv } from "@commitscibble/config";
import { toAppError } from "@commitscibble/shared";
import {
  csrfProtection,
  createRequireAuth,
  type SessionService,
} from "../../services/api/src/lib/session.js";
import { sendError } from "../../services/api/src/lib/http.js";
import { createLogger } from "../../services/api/src/lib/logger.js";
import { createApp } from "../../services/api/src/app.js";
import { createServices } from "../../services/api/src/services/index.js";
import { JobQueue } from "../../services/api/src/lib/queue.js";

function withErrorHandler(app: express.Express) {
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    sendError(res, toAppError(error));
  });
  return app;
}

describe("authentication middleware", () => {
  it("rejects requests without a session", async () => {
    const sessions = {
      resolve: async () => null,
      ensureCsrfCookie: () => "csrf",
    } as unknown as SessionService;

    const app = express();
    app.get("/protected", createRequireAuth(sessions), (_req, res) => res.json({ ok: true }));
    withErrorHandler(app);

    const response = await request(app).get("/protected");
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("allows requests with a resolved session", async () => {
    const sessions = {
      resolve: async () => ({
        id: "user-1",
        githubId: 1,
        githubLogin: "octocat",
        displayName: "Octo",
        email: null,
        avatarUrl: null,
        createdAt: new Date().toISOString(),
      }),
      ensureCsrfCookie: () => "csrf",
    } as unknown as SessionService;

    const app = express();
    app.get("/protected", createRequireAuth(sessions), (req, res) =>
      res.json({ user: req.user?.githubLogin }),
    );
    withErrorHandler(app);
    const response = await request(app).get("/protected");
    expect(response.status).toBe(200);
    expect(response.body.user).toBe("octocat");
  });
});

describe("CSRF protection", () => {
  function app() {
    const instance = express();
    instance.use(express.json());
    instance.post("/mutate", csrfProtection, (_req, res) => res.json({ ok: true }));
    return withErrorHandler(instance);
  }

  it("rejects a mutation with no CSRF header", async () => {
    const response = await request(app()).post("/mutate").set("Cookie", "cs_csrf=token-value-123");
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("CSRF_FAILED");
  });

  it("rejects a mismatched CSRF token", async () => {
    const response = await request(app())
      .post("/mutate")
      .set("Cookie", "cs_csrf=token-value-123")
      .set("X-CSRF-Token", "different-token-456");
    expect(response.status).toBe(403);
  });

  it("accepts a matching double-submit token", async () => {
    const response = await request(app())
      .post("/mutate")
      .set("Cookie", "cs_csrf=token-value-123")
      .set("X-CSRF-Token", "token-value-123");
    expect(response.status).toBe(200);
  });
});

describe("HTTP surface", () => {
  const env = loadEnv({ NODE_ENV: "test" } as NodeJS.ProcessEnv);
  const logger = createLogger("error");
  const queue = new JobQueue("redis://127.0.0.1:6399");
  const services = createServices(env, logger, queue);
  const app = createApp({
    env,
    logger,
    services,
    queue: { health: async () => false, enqueueOutboxSweep: async () => undefined },
    aiProviders: [],
  });

  it("serves the liveness probe", async () => {
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
  });

  it("reports not ready when MongoDB and Redis are unavailable", async () => {
    const response = await request(app).get("/ready");
    expect(response.status).toBe(503);
    expect(response.body.status).toBe("not_ready");
    expect(response.body.checks.redis).toBe("unavailable");
  });

  it("publishes the OpenAPI document", async () => {
    const response = await request(app).get("/api/v1/openapi.json");
    expect(response.status).toBe(200);
    expect(response.body.openapi).toBe("3.1.0");
    expect(response.body.paths["/api/v1/webhooks/github"]).toBeTruthy();
  });

  it("returns a structured 404", async () => {
    const response = await request(app).get("/api/v1/does-not-exist");
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
    expect(response.body.requestId).toBeTruthy();
    expect(response.headers["x-request-id"]).toBeTruthy();
  });
});
