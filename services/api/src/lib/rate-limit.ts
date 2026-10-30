import type { Request, RequestHandler } from "express";
import { AppError, ERROR_CODES } from "@commitscibble/shared";

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * In-process token bucket. Adequate for a single API instance; deployments with
 * multiple API replicas should front this with a shared Redis limiter.
 */
export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  keyPrefix?: string;
  key?: (req: Request) => string;
}): RequestHandler {
  const buckets = new Map<string, Bucket>();
  let lastSweep = Date.now();

  return (req, res, next) => {
    const now = Date.now();
    if (now - lastSweep > options.windowMs) {
      for (const [key, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(key);
      }
      lastSweep = now;
    }

    const identity = options.key
      ? options.key(req)
      : `${options.keyPrefix ?? "global"}:${req.ip ?? "unknown"}`;
    const bucket = buckets.get(identity);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(identity, { count: 1, resetAt: now + options.windowMs });
      res.setHeader("X-RateLimit-Remaining", String(options.max - 1));
      next();
      return;
    }

    bucket.count += 1;
    const remaining = Math.max(0, options.max - bucket.count);
    res.setHeader("X-RateLimit-Remaining", String(remaining));
    if (bucket.count > options.max) {
      res.setHeader("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
      next(
        new AppError(ERROR_CODES.RATE_LIMITED, "Too many requests. Slow down and retry shortly.", {
          httpStatus: 429,
        }),
      );
      return;
    }
    next();
  };
}
