import express, { Router, type Request } from "express";
import { AppError, ERROR_CODES } from "@commitscibble/shared";
import { getDeliveryId, verifyWebhookSignature } from "@commitscibble/github";
import type { Logger } from "../lib/logger.js";
import type { WebhookService } from "../services/webhooks.js";
import { sendError, sendOk } from "../lib/http.js";
import { createRateLimiter } from "../lib/rate-limit.js";

export function createWebhookRouter(deps: {
  secret: string;
  service: Pick<WebhookService, "handle">;
  logger: Logger;
}): Router {
  const router = Router();

  router.post(
    "/github",
    createRateLimiter({ windowMs: 60_000, max: 240, keyPrefix: "webhook" }),
    express.raw({ type: "*/*", limit: "2mb" }),
    async (req, res, next) => {
      try {
        const rawBody = rawRequestBody(req);
        const signature = req.header("x-hub-signature-256") ?? undefined;

        if (!verifyWebhookSignature(deps.secret, rawBody, signature)) {
          deps.logger.warn("Rejected webhook with invalid signature", {
            deliveryId: getDeliveryId(req.headers as Record<string, string | string[] | undefined>),
          });
          throw new AppError(
            ERROR_CODES.WEBHOOK_SIGNATURE_INVALID,
            "Webhook signature verification failed",
            { httpStatus: 401 },
          );
        }

        const deliveryId = getDeliveryId(
          req.headers as Record<string, string | string[] | undefined>,
        );
        if (!deliveryId) {
          throw new AppError(ERROR_CODES.VALIDATION_ERROR, "Missing X-GitHub-Delivery header", {
            httpStatus: 400,
          });
        }
        const event = req.header("x-github-event") ?? "unknown";

        const result = await deps.service.handle({
          deliveryId,
          event,
          rawBody: typeof rawBody === "string" ? rawBody : rawBody.toString("utf8"),
        });

        res.status(202);
        sendOk(res, result, 202);
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}

function rawRequestBody(req: Request): Buffer | string {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") return req.body;
  if (req.body && typeof req.body === "object") {
    // A JSON parser ran before the raw handler: signature cannot be trusted.
    throw new AppError(
      ERROR_CODES.INTERNAL_ERROR,
      "Webhook body was parsed before signature verification",
      { httpStatus: 500 },
    );
  }
  throw new AppError(ERROR_CODES.VALIDATION_ERROR, "Empty webhook body", { httpStatus: 400 });
}

export function sendWebhookError(res: Parameters<typeof sendError>[0], error: AppError): void {
  sendError(res, error);
}
