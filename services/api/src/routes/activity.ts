import { Router, type RequestHandler } from "express";
import { activityQuerySchema, logIdParamSchema } from "@commitscibble/shared";
import { asyncHandler, parseWith, sendOk } from "../lib/http.js";
import type { ActivityService } from "../services/activity.js";

export function createActivityRouter(deps: {
  requireAuth: RequestHandler;
  activity: ActivityService;
}): Router {
  const router = Router();
  router.use(deps.requireAuth);

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const query = parseWith(activityQuerySchema, req.query);
      const result = await deps.activity.list({
        userId: req.user!.id,
        page: query.page,
        pageSize: query.pageSize,
        repositoryId: query.repositoryId,
        status: query.status && query.status !== "ALL" ? query.status : undefined,
        type: query.type,
        operation: query.operation,
      });
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
    "/:logId",
    asyncHandler(async (req, res) => {
      const { logId } = parseWith(logIdParamSchema, req.params);
      const event = await deps.activity.get(req.user!.id, logId);
      sendOk(res, { event });
    }),
  );

  return router;
}
