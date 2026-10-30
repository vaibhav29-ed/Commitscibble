import { Router, type RequestHandler } from "express";
import { serialize as serializeCookie, parse as parseCookie } from "cookie";
import { AppError, ERROR_CODES } from "@commitscibble/shared";
import { newId } from "@commitscibble/shared/node";
import { createOAuthState, verifyOAuthState } from "@commitscibble/github";
import { Repository } from "@commitscibble/persistence";
import { deriveRealtimeReadKey } from "@commitscibble/shared/node";
import type { Env } from "@commitscibble/config";
import { asyncHandler, sendOk } from "../lib/http.js";
import { CSRF_COOKIE, SESSION_COOKIE, type SessionService } from "../lib/session.js";
import type { GithubAccountService } from "../services/github-account.js";
import type { Logger } from "../lib/logger.js";

const OAUTH_STATE_COOKIE = "cs_oauth_state";

export function createPublicAuthRouter(deps: {
  env: Env;
  sessions: SessionService;
  github: GithubAccountService;
  logger: Logger;
}): Router {
  const router = Router();

  router.get("/github", (_req, res) => {
    const secret = deps.env.SESSION_SECRET as string;
    const state = createOAuthState(secret, newId(), Date.now());
    res.append(
      "Set-Cookie",
      serializeCookie(OAUTH_STATE_COOKIE, state, {
        httpOnly: true,
        secure: deps.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 600,
      }),
    );
    res.redirect(302, deps.github.authorizeUrl(state));
  });

  router.get(
    "/github/callback",
    asyncHandler(async (req, res) => {
      const appUrl = deps.env.APP_URL;
      const failure = (code: string): void => {
        res.redirect(302, `${appUrl}/signin?error=${encodeURIComponent(code)}`);
      };

      const error = typeof req.query.error === "string" ? req.query.error : null;
      if (error) {
        deps.logger.info("GitHub OAuth authorization denied", { error });
        failure(error === "access_denied" ? "oauth_denied" : "oauth_failed");
        return;
      }

      const code = typeof req.query.code === "string" ? req.query.code : null;
      const state = typeof req.query.state === "string" ? req.query.state : null;
      if (!code || !state) {
        failure("oauth_invalid_callback");
        return;
      }

      const cookieState = parseCookie(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE] ?? null;
      const secret = deps.env.SESSION_SECRET as string;
      const verification = verifyOAuthState(secret, state);
      if (!verification.valid || !cookieState || cookieState !== state) {
        deps.logger.warn("Rejected OAuth callback with invalid state");
        failure("oauth_state_invalid");
        return;
      }

      try {
        const { user, sessionUser } = await deps.github.completeAuthorization(code);
        const session = await deps.sessions.create(String(user._id), {
          userAgent: req.header("user-agent"),
          ip: req.ip,
        });
        deps.sessions.setSessionCookies(res, session.token, session.csrfToken);
        res.append(
          "Set-Cookie",
          serializeCookie(OAUTH_STATE_COOKIE, "", {
            httpOnly: true,
            secure: deps.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 0,
          }),
        );
        deps.logger.info("User signed in with GitHub", {
          userId: sessionUser.id,
          githubLogin: sessionUser.githubLogin,
        });
        res.redirect(302, `${appUrl}/dashboard?welcome=1`);
      } catch (caught) {
        deps.logger.error("GitHub OAuth completion failed", {
          error: caught instanceof Error ? caught.message : "unknown",
        });
        failure("oauth_exchange_failed");
      }
    }),
  );

  return router;
}

export function createSessionRouter(deps: {
  sessions: SessionService;
  requireAuth: RequestHandler;
  csrf: RequestHandler;
  github: GithubAccountService;
  realtimeSecret: string | null;
}): Router {
  const router = Router();

  router.get("/me", deps.requireAuth, (req, res) => {
    const userId = req.user!.id;
    sendOk(res, {
      user: req.user,
      realtimeKey: deps.realtimeSecret
        ? deriveRealtimeReadKey(deps.realtimeSecret, userId)
        : null,
    });
  });

  router.post(
    "/logout",
    deps.requireAuth,
    deps.csrf,
    asyncHandler(async (req, res) => {
      await deps.sessions.revoke(req.sessionToken);
      deps.sessions.clearCookies(res);
      const csrf = parseCookie(req.headers.cookie ?? "")[CSRF_COOKIE];
      void csrf;
      res.status(204).end();
    }),
  );

  router.get("/session", deps.requireAuth, (req, res) => {
    sendOk(res, { user: req.user, hasSession: true, cookieName: SESSION_COOKIE });
  });

  router.post(
    "/github/revoke",
    deps.requireAuth,
    deps.csrf,
    asyncHandler(async (req, res) => {
      const userId = req.user!.id;
      const revoked = await deps.github.revoke(userId);
      await Repository.updateMany(
        { userId, trackingStatus: { $ne: "DISCONNECTED" } },
        { $set: { trackingStatus: "DISCONNECTED", disconnectedAt: new Date() } },
      );
      await deps.sessions.revokeAllForUser(userId);
      deps.sessions.clearCookies(res);
      sendOk(res, { revoked });
    }),
  );

  return router;
}

export function assertSessionsConfigured(secret: string | undefined): asserts secret is string {
  if (!secret) {
    throw new AppError(ERROR_CODES.INTERNAL_ERROR, "SESSION_SECRET is not configured", {
      httpStatus: 503,
    });
  }
}
