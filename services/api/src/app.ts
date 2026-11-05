import express, { type Express, type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import { ZodError } from "zod";
import {
  AppError,
  ERROR_CODES,
  isAppError,
  openApiDocument,
  redactSecrets,
  toAppError,
} from "@commitscibble/shared";
import { newId } from "@commitscibble/shared/node";
import type { Env } from "@commitscibble/config";
import { convexPublisherConfig, corsOrigins, githubAppConfig } from "@commitscibble/config";
import type { Logger } from "./lib/logger.js";
import { sendError, sendOk } from "./lib/http.js";
import {
  SessionService,
  csrfProtection,
  createRequireAuth,
} from "./lib/session.js";
import { createRateLimiter } from "./lib/rate-limit.js";
import type { JobQueue } from "./lib/queue.js";
import type { ServiceContainer } from "./services/index.js";
import { createPublicAuthRouter, createSessionRouter } from "./routes/auth.js";
import { createRepositoryRouter } from "./routes/repositories.js";
import { createDocumentationRouter } from "./routes/documentation.js";
import { createActivityRouter } from "./routes/activity.js";
import { createWebhookRouter } from "./routes/webhooks.js";
import { createHealthRouter } from "./routes/health.js";

export interface AppDependencies {
  env: Env;
  logger: Logger;
  services: ServiceContainer;
  /** Injectable for tests; defaults to the Mongo-backed implementation. */
  sessions?: SessionService;
  queue?: Pick<JobQueue, "health" | "enqueueOutboxSweep">;
  aiProviders?: string[];
}

export function createApp(deps: AppDependencies): Express {
  const { env, logger, services } = deps;
  const sessions = deps.sessions ?? new SessionService(env);
  const startedAt = Date.now();
  const app = express();

  app.disable("x-powered-by");
  if (env.NODE_ENV === "production") app.set("trust proxy", 1);

  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(corsMiddleware(env));
  app.use(requestContext(logger));
  app.use(accessLog(logger));

  // Webhook must be registered before express.json so the raw body is intact.
  app.use(
    "/api/v1/webhooks",
    createWebhookRouter({
      secret: env.GITHUB_WEBHOOK_SECRET as string,
      service: services.webhooks,
      logger,
    }),
  );

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false, limit: "256kb" }));

  app.get("/", (_req, res) => {
    sendOk(res, {
      name: "CommitScibble API",
      version: "1.0.0",
      docs: "/api/v1/openapi.json",
    });
  });

  app.get("/api/v1/openapi.json", (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=300");
    res.status(200).json(openApiDocument);
  });

  app.use(
    createHealthRouter({
      env,
      queue: deps.queue ?? { health: async () => false },
      startedAt,
      aiProviders: deps.aiProviders ?? [],
    }),
  );

  app.use(
    "/auth",
    createRateLimiter({ windowMs: 60_000, max: 30, keyPrefix: "auth" }),
    createPublicAuthRouter({ env, sessions, github: services.github, logger }),
  );

  const requireAuth = createRequireAuth(sessions);
  const realtimeConfigured = Boolean(convexPublisherConfig(env));
  const githubApp = githubAppConfig(env);
  const realtimeSecret = realtimeConfigured
    ? (env.COMMITSCIBBLE_PUBLISH_TOKEN as string)
    : null;

  app.use(
    "/api/v1/auth",
    createRateLimiter({
      windowMs: 60_000,
      max: 60,
      key: (req) => `auth-api:${req.ip ?? "unknown"}`,
    }),
    createSessionRouter({
      sessions,
      requireAuth,
      csrf: csrfProtection,
      github: services.github,
      realtimeSecret,
    }),
  );

  app.get("/api/v1/meta", requireAuth, (_req, res) => {
    sendOk(res, {
      readmeFileName: env.README_FILE_NAME,
      defaultUpdateMode: env.DOC_UPDATE_MODE,
      aiProviders: deps.aiProviders ?? [],
      realtime: { convex: realtimeConfigured },
      githubApp: githubApp
        ? {
            configured: true,
            slug: githubApp.slug,
            installUrl: `https://github.com/apps/${encodeURIComponent(githubApp.slug)}/installations/new`,
          }
        : { configured: false, slug: null, installUrl: null },
      billingEnabled: env.BILLING_ENABLED,
      retention: {
        auditDays: env.AUDIT_RETENTION_DAYS,
        webhookDays: env.WEBHOOK_RETENTION_DAYS,
      },
    });
  });

  app.use(
    "/api/v1/repositories",
    createRepositoryRouter({
      requireAuth,
      csrf: csrfProtection,
      repositories: services.repositories,
      runs: services.runs,
    }),
  );

  app.use(
    "/api/v1/activity",
    createActivityRouter({ requireAuth, activity: services.activity }),
  );

  app.use(
    "/api/v1",
    createDocumentationRouter({
      requireAuth,
      csrf: csrfProtection,
      runs: services.runs,
      activity: services.activity,
    }),
  );

  app.use((req, res) => {
    sendError(
      res,
      new AppError(ERROR_CODES.NOT_FOUND, `No route matches ${req.method} ${req.path}`, {
        httpStatus: 404,
      }),
    );
  });

  app.use(errorHandler(logger));
  return app;
}

function corsMiddleware(env: Env) {
  const allowed = new Set(corsOrigins(env));
  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.header("origin");
    if (origin) {
      if (allowed.has(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Vary", "Origin");
        res.setHeader("Access-Control-Allow-Credentials", "true");
        res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
        res.setHeader(
          "Access-Control-Allow-Headers",
          "Content-Type, X-CSRF-Token, X-Request-Id, X-GitHub-Event, X-GitHub-Delivery, X-Hub-Signature-256",
        );
        res.setHeader("Access-Control-Max-Age", "600");
      } else if (req.method === "OPTIONS") {
        res.status(403).end();
        return;
      }
    }
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  };
}

function requestContext(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const incoming = req.header("x-request-id");
    const requestId = incoming && /^[\w-]{8,64}$/.test(incoming) ? incoming : newId();
    req.requestId = requestId;
    res.locals.requestId = requestId;
    res.setHeader("X-Request-Id", requestId);
    (req as Request & { log?: Logger }).log = logger.child({ requestId });
    next();
  };
}

function accessLog(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const started = Date.now();
    res.on("finish", () => {
      logger.info("request", {
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Date.now() - started,
        userId: req.user?.id ?? null,
      });
    });
    next();
  };
}

function errorHandler(logger: Logger) {
  return (error: unknown, req: Request, res: Response, _next: NextFunction): void => {
    if (res.headersSent) return;

    if (error instanceof ZodError) {
      sendError(
        res,
        new AppError(ERROR_CODES.VALIDATION_ERROR, "Request validation failed", {
          httpStatus: 422,
          details: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        }),
      );
      return;
    }

    const appError = toAppError(error as Error);
    const isServerError = appError.httpStatus >= 500;
    // Only errors the API did not author get their message hidden. AppError
    // messages are written for clients (e.g. NOT_READY -> "the job queue is
    // unavailable, check REDIS_URL"), so replacing them with a generic 500
    // would make an actionable failure impossible to diagnose from the UI.
    const shouldScrub = !isAppError(error);

    if (isServerError) {
      logger.error("request failed", {
        requestId: req.requestId,
        code: appError.code,
        message: redactSecrets(appError.message),
        path: req.path,
        ...(shouldScrub ? {} : { cause: redactSecrets(String(appError.cause ?? "")) }),
      });
    } else {
      logger.info("request rejected", {
        requestId: req.requestId,
        code: appError.code,
        path: req.path,
      });
    }

    sendError(
      res,
      isServerError && shouldScrub
        ? new AppError(ERROR_CODES.INTERNAL_ERROR, "An unexpected error occurred. Check server logs with the request id.", {
            httpStatus: 500,
            details: { safeCode: appError.code },
          })
        : appError,
    );
  };
}
