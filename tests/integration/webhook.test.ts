import express, { type NextFunction, type Request, type Response } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { toAppError } from "@commitscibble/shared";
import { hmacSha256Hex } from "@commitscibble/shared/node";
import { createWebhookRouter } from "../../services/api/src/routes/webhooks.js";
import { sendError } from "../../services/api/src/lib/http.js";
import { createLogger } from "../../services/api/src/lib/logger.js";

const SECRET = "test-webhook-secret-value";

interface HandleInput {
  deliveryId: string;
  event: string;
  rawBody: string;
}

interface WebhookResult {
  status: "QUEUED" | "IGNORED" | "DUPLICATE" | "REJECTED";
  message: string;
  deliveryId: string;
}

function buildApp(
  handler: (input: HandleInput) => Promise<WebhookResult>,
  calls: HandleInput[] = [],
) {
  const app = express();
  app.use(
    "/api/v1/webhooks",
    createWebhookRouter({
      secret: SECRET,
      service: {
        handle: async (input) => {
          calls.push(input);
          return handler(input);
        },
      },
      logger: createLogger("error"),
    }),
  );
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    sendError(res, toAppError(error));
  });
  return app;
}

const BODY = JSON.stringify({
  ref: "refs/heads/main",
  before: "a".repeat(40),
  after: "b".repeat(40),
  repository: { id: 1, name: "repo", full_name: "org/repo" },
  commits: [{ id: "b", message: "feat: change", added: [], removed: [], modified: ["src/a.ts"] }],
});

function sign(body: string, secret = SECRET): string {
  return `sha256=${hmacSha256Hex(secret, body)}`;
}

describe("GitHub webhook endpoint", () => {
  it("rejects a request with an invalid signature", async () => {
    const app = buildApp(async () => ({ status: "QUEUED", message: "ok", deliveryId: "d" }));
    const response = await request(app)
      .post("/api/v1/webhooks/github")
      .set("Content-Type", "application/json")
      .set("X-GitHub-Event", "push")
      .set("X-GitHub-Delivery", "delivery-1")
      .set("X-Hub-Signature-256", sign(BODY, "wrong-secret"))
      .send(BODY);
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("WEBHOOK_SIGNATURE_INVALID");
    expect(response.body.requestId).toBeTruthy();
  });

  it("rejects a request with no signature", async () => {
    const app = buildApp(async () => ({ status: "QUEUED", message: "ok", deliveryId: "d" }));
    const response = await request(app)
      .post("/api/v1/webhooks/github")
      .set("Content-Type", "application/json")
      .set("X-GitHub-Event", "push")
      .set("X-GitHub-Delivery", "delivery-1")
      .send(BODY);
    expect(response.status).toBe(401);
  });

  it("accepts a valid signature and passes the raw body to the service", async () => {
    const calls: HandleInput[] = [];
    const app = buildApp(
      async () => ({ status: "QUEUED", message: "accepted", deliveryId: "delivery-2" }),
      calls,
    );
    const response = await request(app)
      .post("/api/v1/webhooks/github")
      .set("Content-Type", "application/json")
      .set("X-GitHub-Event", "push")
      .set("X-GitHub-Delivery", "delivery-2")
      .set("X-Hub-Signature-256", sign(BODY))
      .send(BODY);

    expect(response.status).toBe(202);
    expect(response.body.data.status).toBe("QUEUED");
    expect(calls).toHaveLength(1);
    expect(calls[0].deliveryId).toBe("delivery-2");
    expect(calls[0].event).toBe("push");
    expect(calls[0].rawBody).toBe(BODY);
  });

  it("returns a duplicate status without erroring", async () => {
    const app = buildApp(async () => ({
      status: "DUPLICATE",
      message: "already received",
      deliveryId: "delivery-3",
    }));
    const response = await request(app)
      .post("/api/v1/webhooks/github")
      .set("Content-Type", "application/json")
      .set("X-GitHub-Event", "push")
      .set("X-GitHub-Delivery", "delivery-3")
      .set("X-Hub-Signature-256", sign(BODY))
      .send(BODY);
    expect(response.status).toBe(202);
    expect(response.body.data.status).toBe("DUPLICATE");
  });

  it("requires a delivery id header", async () => {
    const app = buildApp(async () => ({ status: "QUEUED", message: "ok", deliveryId: "d" }));
    const response = await request(app)
      .post("/api/v1/webhooks/github")
      .set("Content-Type", "application/json")
      .set("X-GitHub-Event", "push")
      .set("X-Hub-Signature-256", sign(BODY))
      .send(BODY);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });
});
