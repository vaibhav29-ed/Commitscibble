import express, { type NextFunction, type Request, type Response } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import {
  createRateLimiter,
  MemoryRateLimitStore,
  type RateLimitStore,
} from "./rate-limit.js";

function buildApp(limiter: express.RequestHandler) {
  const app = express();
  app.get("/limited", limiter, (_req, res) => {
    res.json({ ok: true });
  });
  app.use((error: { httpStatus?: number; code?: string; message?: string }, _req: Request, res: Response, _next: NextFunction) => {
    res.status(error.httpStatus ?? 500).json({
      error: { code: error.code ?? "INTERNAL_ERROR", message: error.message ?? "failed" },
    });
  });
  return app;
}

describe("rate limiter", () => {
  it("allows requests up to the limit and rejects the next one", async () => {
    const app = buildApp(
      createRateLimiter({
        windowMs: 60_000,
        max: 2,
        key: () => "user:octocat",
        store: new MemoryRateLimitStore(),
      }),
    );

    const first = await request(app).get("/limited");
    const second = await request(app).get("/limited");
    const third = await request(app).get("/limited");

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.headers["x-ratelimit-remaining"]).toBe("0");
    expect(third.status).toBe(429);
    expect(third.body.error.code).toBe("RATE_LIMITED");
    expect(Number(third.headers["retry-after"])).toBeGreaterThan(0);
  });

  it("counts per identity, not globally", async () => {
    const limiter = createRateLimiter({
      windowMs: 60_000,
      max: 1,
      key: (req) => `user:${req.header("x-user") ?? "anonymous"}`,
      store: new MemoryRateLimitStore(),
    });
    const app = buildApp(limiter);

    expect((await request(app).get("/limited").set("x-user", "a")).status).toBe(200);
    expect((await request(app).get("/limited").set("x-user", "a")).status).toBe(429);
    expect((await request(app).get("/limited").set("x-user", "b")).status).toBe(200);
  });

  it("falls back to in-process counting when the shared store fails", async () => {
    const broken: RateLimitStore = {
      increment: async () => {
        throw new Error("redis unavailable");
      },
    };
    const app = buildApp(createRateLimiter({ windowMs: 60_000, max: 1, store: broken }));

    expect((await request(app).get("/limited")).status).toBe(200);
    const blocked = await request(app).get("/limited");
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("RATE_LIMITED");
  });
});
