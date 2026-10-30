import request from "supertest";
import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadEnv } from "@commitscibble/config";
import type { SessionUser } from "@commitscibble/shared";
import { createApp } from "../../services/api/src/app.js";
import { createLogger } from "../../services/api/src/lib/logger.js";
import type { SessionService } from "../../services/api/src/lib/session.js";
import { CSRF_COOKIE, SESSION_COOKIE } from "../../services/api/src/lib/session.js";
import type { ServiceContainer } from "../../services/api/src/services/index.js";

const CSRF_TOKEN = "csrf-token-value-1234567890";
const RUN_ID = "64b000000000000000000001";
const REPOSITORY_ID = "64b000000000000000000002";
const PROPOSAL_ID = "64b000000000000000000003";

const user: SessionUser = {
  id: "64b0000000000000000000aa",
  githubId: 42,
  githubLogin: "octocat",
  displayName: "Octo Cat",
  email: "octo@example.com",
  avatarUrl: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
};

const run = {
  id: RUN_ID,
  operation: "GENERATE",
  status: "SUCCEEDED",
  repositoryId: REPOSITORY_ID,
  repositoryFullName: "octo/example",
  createdAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
};

const repository = {
  id: REPOSITORY_ID,
  fullName: "octo/example",
  trackingStatus: "CONNECTED",
};

function createFakeServices() {
  return {
    github: { revoke: vi.fn(async () => true) },
    repositories: {
      list: vi.fn(async () => ({ connected: [repository], available: [] })),
      connect: vi.fn(async () => repository),
      get: vi.fn(async () => ({ repository, runs: [] })),
      updateSettings: vi.fn(async () => repository),
      setTracking: vi.fn(async (_userId: string, _id: string, status: string) => ({
        ...repository,
        trackingStatus: status,
      })),
      disconnect: vi.fn(async () => ({ repository, deletedRuns: 0, deletedProposals: 0 })),
    },
    runs: {
      start: vi.fn(async () => run),
      get: vi.fn(async () => ({ run, proposal: null })),
      listForRepository: vi.fn(async () => ({ items: [run], total: 1 })),
      proposalForRun: vi.fn(async () => ({ proposal: null })),
      approve: vi.fn(async () => ({ ...run, status: "QUEUED" })),
      reject: vi.fn(async () => ({ proposal: { id: PROPOSAL_ID }, run })),
      retry: vi.fn(async () => ({ ...run, status: "QUEUED" })),
    },
    activity: {
      list: vi.fn(async () => ({ items: [], total: 0 })),
      get: vi.fn(async () => ({ id: "event-1", message: "Queued" })),
      forRun: vi.fn(async () => []),
    },
    webhooks: {},
  } as unknown as ServiceContainer;
}

function createFakeSessions() {
  return {
    resolve: vi.fn(async (token?: string) => (token === "session-token" ? user : null)),
    ensureCsrfCookie: (req: Request, res: Response) => {
      const existing = req.headers.cookie?.match(new RegExp(`${CSRF_COOKIE}=([^;]+)`))?.[1];
      if (existing) return existing;
      res.append("Set-Cookie", `${CSRF_COOKIE}=${CSRF_TOKEN}; Path=/; HttpOnly; SameSite=Lax`);
      return CSRF_TOKEN;
    },
    revoke: vi.fn(async () => undefined),
    revokeAllForUser: vi.fn(async () => undefined),
    clearCookies: vi.fn(),
  } as unknown as SessionService;
}

function buildApp() {
  const services = createFakeServices();
  const sessions = createFakeSessions();
  const env = loadEnv({
    NODE_ENV: "test",
    GITHUB_WEBHOOK_SECRET: "test-webhook-secret-value",
  } as NodeJS.ProcessEnv);
  const app = createApp({
    env,
    logger: createLogger("error"),
    services,
    sessions,
    queue: { health: async () => true, enqueueOutboxSweep: async () => undefined },
    aiProviders: [],
  });
  return { app, services, sessions };
}

function authed(req: request.Test) {
  return req.set("Cookie", `${SESSION_COOKIE}=session-token; ${CSRF_COOKIE}=${CSRF_TOKEN}`);
}

function withCsrf(req: request.Test) {
  return authed(req).set("X-CSRF-Token", CSRF_TOKEN);
}

describe("HTTP surface", () => {
  let app: ReturnType<typeof buildApp>["app"];
  let services: ReturnType<typeof buildApp>["services"];

  beforeEach(() => {
    ({ app, services } = buildApp());
  });

  it("rejects unauthenticated access to protected routes", async () => {
    const response = await request(app).get("/api/v1/repositories");
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns the current user and CSRF cookie", async () => {
    const response = await request(app)
      .get("/api/v1/auth/me")
      .set("Cookie", `${SESSION_COOKIE}=session-token`);
    expect(response.status).toBe(200);
    expect(response.body.data.user.githubLogin).toBe("octocat");
    expect(response.body.data.realtimeKey).toBeNull();
    expect(String(response.headers["set-cookie"] ?? "")).toContain(CSRF_COOKIE);
  });

  it("lists connected and available repositories", async () => {
    const response = await authed(request(app).get("/api/v1/repositories"));
    expect(response.status).toBe(200);
    expect(response.body.data.connected[0].fullName).toBe("octo/example");
    expect(response.body.data.available).toEqual([]);
    expect(services.repositories.list).toHaveBeenCalledWith(user.id);
  });

  it("connects a repository through GitHub id", async () => {
    const response = await withCsrf(
      request(app).post("/api/v1/repositories/12345/connect").send({}),
    );
    expect(response.status).toBe(201);
    expect(
      (services.repositories.connect as ReturnType<typeof vi.fn>).mock.calls[0][2],
    ).toEqual({});
    expect(response.body.data.repository.fullName).toBe("octo/example");
  });

  it("requires a CSRF token for mutations", async () => {
    const response = await authed(
      request(app).post(`/api/v1/repositories/${REPOSITORY_ID}/generate`),
    );
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("CSRF_FAILED");
    expect(services.runs.start).not.toHaveBeenCalled();
  });

  it("starts a generation run and responds 202", async () => {
    const response = await withCsrf(
      request(app).post(`/api/v1/repositories/${REPOSITORY_ID}/generate`),
    );
    expect(response.status).toBe(202);
    expect(response.body.data.run.id).toBe(RUN_ID);
    expect(services.runs.start).toHaveBeenCalledWith(user.id, REPOSITORY_ID, "GENERATE");
  });

  it("updates repository tracking", async () => {
    const response = await withCsrf(
      request(app)
        .post(`/api/v1/repositories/${REPOSITORY_ID}/tracking`)
        .send({ status: "PAUSED" }),
    );
    expect(response.status).toBe(200);
    expect(response.body.data.repository.trackingStatus).toBe("PAUSED");
  });

  it("returns run detail together with its audit events", async () => {
    const response = await authed(request(app).get(`/api/v1/runs/${RUN_ID}`));
    expect(response.status).toBe(200);
    expect(response.body.data.run.id).toBe(RUN_ID);
    expect(response.body.data.events).toEqual([]);
    expect(services.runs.get).toHaveBeenCalledWith(user.id, RUN_ID);
  });

  it("validates run identifiers before hitting the service", async () => {
    const response = await authed(request(app).get("/api/v1/runs/not-an-object-id"));
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(services.runs.get).not.toHaveBeenCalled();
  });

  it("approves a proposal and responds 202", async () => {
    const response = await withCsrf(
      request(app).post(`/api/v1/proposals/${PROPOSAL_ID}/approve`),
    );
    expect(response.status).toBe(202);
    expect(response.body.data.run.status).toBe("QUEUED");
    expect(services.runs.approve).toHaveBeenCalledWith(user.id, PROPOSAL_ID);
  });

  it("rejects a proposal", async () => {
    const response = await withCsrf(
      request(app).post(`/api/v1/proposals/${PROPOSAL_ID}/reject`),
    );
    expect(response.status).toBe(200);
    expect(services.runs.reject).toHaveBeenCalledWith(user.id, PROPOSAL_ID);
  });

  it("lists activity with pagination metadata", async () => {
    const response = await authed(request(app).get("/api/v1/activity?page=2&pageSize=10"));
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ page: 2, pageSize: 10, total: 0, hasMore: false });
  });

  it("returns a structured 404 for unknown routes", async () => {
    const response = await request(app).get("/api/v1/nope");
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });
});
