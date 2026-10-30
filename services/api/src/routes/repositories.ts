import { Router, type RequestHandler } from "express";
import { z } from "zod";
import {
  connectRepositorySchema,
  disconnectRepositorySchema,
  githubRepoIdSchema,
  objectIdSchema,
  repoSettingsUpdateSchema,
  runQuerySchema,
  type RepoSettings,
} from "@commitscibble/shared";
import { asyncHandler, parseWith, sendOk } from "../lib/http.js";
import type { RepositoryService } from "../services/repositories.js";
import type { RunService } from "../services/runs.js";
import { createRateLimiter } from "../lib/rate-limit.js";

export function createRepositoryRouter(deps: {
  requireAuth: RequestHandler;
  csrf: RequestHandler;
  repositories: RepositoryService;
  runs: RunService;
}): Router {
  const router = Router();
  router.use(deps.requireAuth);
  router.use(
    createRateLimiter({
      windowMs: 60_000,
      max: 120,
      key: (req) => `repos:${req.user?.id ?? req.ip}`,
    }),
  );

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const result = await deps.repositories.list(req.user!.id);
      sendOk(res, result);
    }),
  );

  router.post(
    "/:id/connect",
    deps.csrf,
    asyncHandler(async (req, res) => {
      const { id } = parseWith(z.object({ id: githubRepoIdSchema }), req.params);
      const body = parseWith(connectRepositorySchema, req.body ?? {});
      const repository = await deps.repositories.connect(req.user!.id, id, body);
      sendOk(res, { repository }, 201);
    }),
  );

  router.get(
    "/:id/runs",
    asyncHandler(async (req, res) => {
      const { id } = parseWith(z.object({ id: objectIdSchema }), req.params);
      const query = parseWith(runQuerySchema, req.query);
      const result = await deps.runs.listForRepository(req.user!.id, id, query);
      sendOk(res, {
        items: result.items,
        page: query.page,
        pageSize: query.pageSize,
        total: result.total,
        hasMore: query.page * query.pageSize < result.total,
      });
    }),
  );

  router.get(
    "/:id",
    asyncHandler(async (req, res) => {
      const { id } = parseWith(z.object({ id: objectIdSchema }), req.params);
      const detail = await deps.repositories.get(req.user!.id, id);
      sendOk(res, detail);
    }),
  );

  router.patch(
    "/:id/settings",
    deps.csrf,
    asyncHandler(async (req, res) => {
      const { id } = parseWith(z.object({ id: objectIdSchema }), req.params);
      const patch = parseWith(repoSettingsUpdateSchema, req.body ?? {});
      const repository = await deps.repositories.updateSettings(
        req.user!.id,
        id,
        patch as Partial<RepoSettings>,
      );
      sendOk(res, { repository });
    }),
  );

  router.post(
    "/:id/tracking",
    deps.csrf,
    asyncHandler(async (req, res) => {
      const { id } = parseWith(z.object({ id: objectIdSchema }), req.params);
      const { status } = parseWith(
        z.object({ status: z.enum(["CONNECTED", "PAUSED"]) }).strict(),
        req.body ?? {},
      );
      const repository = await deps.repositories.setTracking(req.user!.id, id, status);
      sendOk(res, { repository });
    }),
  );

  router.post(
    "/:id/disconnect",
    deps.csrf,
    asyncHandler(async (req, res) => {
      const { id } = parseWith(z.object({ id: objectIdSchema }), req.params);
      const body = parseWith(disconnectRepositorySchema, req.body ?? {});
      const result = await deps.repositories.disconnect(req.user!.id, id, body);
      sendOk(res, result);
    }),
  );

  router.post(
    "/:id/generate",
    deps.csrf,
    asyncHandler(async (req, res) => {
      const { id } = parseWith(z.object({ id: objectIdSchema }), req.params);
      const run = await deps.runs.start(req.user!.id, id, "GENERATE");
      sendOk(res, { run }, 202);
    }),
  );

  router.post(
    "/:id/update",
    deps.csrf,
    asyncHandler(async (req, res) => {
      const { id } = parseWith(z.object({ id: objectIdSchema }), req.params);
      const run = await deps.runs.start(req.user!.id, id, "INCREMENTAL_UPDATE");
      sendOk(res, { run }, 202);
    }),
  );

  router.post(
    "/:id/cleanup",
    deps.csrf,
    asyncHandler(async (req, res) => {
      const { id } = parseWith(z.object({ id: objectIdSchema }), req.params);
      const run = await deps.runs.start(req.user!.id, id, "CLEANUP");
      sendOk(res, { run }, 202);
    }),
  );

  return router;
}
