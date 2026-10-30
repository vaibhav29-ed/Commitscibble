import { Router, type RequestHandler } from "express";
import { proposalIdParamSchema, runIdParamSchema } from "@commitscibble/shared";
import { asyncHandler, parseWith, sendOk } from "../lib/http.js";
import type { RunService } from "../services/runs.js";
import type { ActivityService } from "../services/activity.js";
import { createRateLimiter } from "../lib/rate-limit.js";

export function createDocumentationRouter(deps: {
  requireAuth: RequestHandler;
  csrf: RequestHandler;
  runs: RunService;
  activity: ActivityService;
}): Router {
  const router = Router();
  router.use(
    createRateLimiter({
      windowMs: 60_000,
      max: 90,
      key: (req) => `docs:${req.user?.id ?? req.ip}`,
    }),
  );

  router.get(
    "/runs/:runId",
    deps.requireAuth,
    asyncHandler(async (req, res) => {
      const { runId } = parseWith(runIdParamSchema, req.params);
      const [detail, events] = await Promise.all([
        deps.runs.get(req.user!.id, runId),
        deps.activity.forRun(req.user!.id, runId),
      ]);
      sendOk(res, { ...detail, events });
    }),
  );

  router.get(
    "/runs/:runId/proposal",
    deps.requireAuth,
    asyncHandler(async (req, res) => {
      const { runId } = parseWith(runIdParamSchema, req.params);
      const proposal = await deps.runs.proposalForRun(req.user!.id, runId);
      sendOk(res, { proposal });
    }),
  );

  router.post(
    "/runs/:runId/retry",
    deps.requireAuth,
    deps.csrf,
    asyncHandler(async (req, res) => {
      const { runId } = parseWith(runIdParamSchema, req.params);
      const run = await deps.runs.retry(req.user!.id, runId);
      sendOk(res, { run }, 202);
    }),
  );

  router.post(
    "/proposals/:proposalId/approve",
    deps.requireAuth,
    deps.csrf,
    asyncHandler(async (req, res) => {
      const { proposalId } = parseWith(proposalIdParamSchema, req.params);
      const run = await deps.runs.approve(req.user!.id, proposalId);
      sendOk(res, { run }, 202);
    }),
  );

  router.post(
    "/proposals/:proposalId/reject",
    deps.requireAuth,
    deps.csrf,
    asyncHandler(async (req, res) => {
      const { proposalId } = parseWith(proposalIdParamSchema, req.params);
      const proposal = await deps.runs.reject(req.user!.id, proposalId);
      sendOk(res, { proposal });
    }),
  );

  return router;
}
