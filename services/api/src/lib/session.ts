import type { NextFunction, Request, RequestHandler, Response } from "express";
import { parse as parseCookie, serialize as serializeCookie, type SerializeOptions } from "cookie";
import { AppError, ERROR_CODES, type SessionUser } from "@commitscibble/shared";
import {
  hashToken,
  newId,
  randomToken,
  safeEqualString,
  sha256Hex,
} from "@commitscibble/shared/node";
import { Session, User, type UserDocument } from "@commitscibble/persistence";
import type { Env } from "@commitscibble/config";

export const SESSION_COOKIE = "cs_session";
export const CSRF_COOKIE = "cs_csrf";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function toSessionUser(user: UserDocument): SessionUser {
  return {
    id: String(user._id),
    githubLogin: user.githubLogin,
    githubId: user.githubId,
    displayName: user.displayName,
    email: user.email,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
  };
}

export class SessionService {
  constructor(private readonly env: Env) {}

  cookieOptions(): SerializeOptions {
    return {
      httpOnly: true,
      secure: this.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor(SESSION_TTL_MS / 1000),
    };
  }

  csrfCookieOptions(): SerializeOptions {
    return {
      httpOnly: false,
      secure: this.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor(SESSION_TTL_MS / 1000),
    };
  }

  async create(
    userId: string,
    meta: { userAgent?: string; ip?: string },
  ): Promise<{ token: string; csrfToken: string; expiresAt: Date }> {
    const token = randomToken(32);
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await Session.create({
      tokenHash: hashToken(token),
      userId,
      expiresAt,
      lastUsedAt: new Date(),
      userAgentHash: meta.userAgent ? sha256Hex(meta.userAgent).slice(0, 32) : null,
      ipHash: meta.ip ? sha256Hex(meta.ip).slice(0, 32) : null,
    });
    return { token, csrfToken: randomToken(24), expiresAt };
  }

  async resolve(token: string | undefined): Promise<SessionUser | null> {
    if (!token) return null;
    const session = await Session.findOne({
      tokenHash: hashToken(token),
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    });
    if (!session) return null;

    const user = await User.findById(session.userId);
    if (!user || user.status !== "ACTIVE") return null;

    void Session.updateOne({ _id: session._id }, { $set: { lastUsedAt: new Date() } }).catch(() => {});

    return toSessionUser(user);
  }

  async revoke(token: string | undefined): Promise<void> {
    if (!token) return;
    await Session.updateOne(
      { tokenHash: hashToken(token), revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await Session.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
  }

  setSessionCookies(res: Response, token: string, csrfToken: string): void {
    res.append("Set-Cookie", serializeCookie(SESSION_COOKIE, token, this.cookieOptions()));
    res.append("Set-Cookie", serializeCookie(CSRF_COOKIE, csrfToken, this.csrfCookieOptions()));
  }

  clearCookies(res: Response): void {
    res.append(
      "Set-Cookie",
      serializeCookie(SESSION_COOKIE, "", { ...this.cookieOptions(), maxAge: 0 }),
    );
    res.append(
      "Set-Cookie",
      serializeCookie(CSRF_COOKIE, "", { ...this.csrfCookieOptions(), maxAge: 0 }),
    );
  }

  ensureCsrfCookie(req: Request, res: Response): string {
    const cookies = parseCookie(req.headers.cookie ?? "");
    const existing = cookies[CSRF_COOKIE];
    if (existing && existing.length >= 16) return existing;
    const token = randomToken(24);
    res.append("Set-Cookie", serializeCookie(CSRF_COOKIE, token, this.csrfCookieOptions()));
    return token;
  }
}

export function readCookie(req: Request, name: string): string | null {
  const cookies = parseCookie(req.headers.cookie ?? "");
  return cookies[name] ?? null;
}

export function createRequireAuth(sessions: SessionService): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const token = readCookie(req, SESSION_COOKIE);
    sessions
      .resolve(token ?? undefined)
      .then((user) => {
        if (!user) {
          next(new AppError(ERROR_CODES.UNAUTHENTICATED, "Sign in with GitHub to continue"));
          return;
        }
        req.user = user;
        req.sessionToken = token ?? undefined;
        sessions.ensureCsrfCookie(req, res);
        next();
      })
      .catch(next);
  };
}

export function csrfProtection(req: Request, _res: Response, next: NextFunction): void {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    next();
    return;
  }
  const csrfCookie = readCookie(req, CSRF_COOKIE);
  const header = req.header("x-csrf-token");
  if (!csrfCookie || !header) {
    next(new AppError(ERROR_CODES.CSRF_FAILED, "Missing CSRF token", { httpStatus: 403 }));
    return;
  }
  if (!safeEqualString(csrfCookie, header)) {
    next(new AppError(ERROR_CODES.CSRF_FAILED, "Invalid CSRF token", { httpStatus: 403 }));
    return;
  }
  next();
}

export function createRequestId(): string {
  return newId();
}
