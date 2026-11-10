import type { Request, RequestHandler } from "express";
import IORedis from "ioredis";
import { AppError, ERROR_CODES } from "@commitscibble/shared";

export interface RateLimitWindow {
  count: number;
  resetAt: number;
}

export interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<RateLimitWindow>;
}

const INCREMENT_SCRIPT = `
local count = redis.call("INCR", KEYS[1])
if count == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("PTTL", KEYS[1])
return { count, ttl }
`;

export class MemoryRateLimitStore implements RateLimitStore {
  private buckets = new Map<string, RateLimitWindow>();
  private lastSweep = Date.now();

  async increment(key: string, windowMs: number): Promise<RateLimitWindow> {
    const now = Date.now();
    if (now - this.lastSweep > 60_000) {
      for (const [entry, bucket] of this.buckets) {
        if (bucket.resetAt <= now) this.buckets.delete(entry);
      }
      this.lastSweep = now;
    }

    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      const fresh = { count: 1, resetAt: now + windowMs };
      this.buckets.set(key, fresh);
      return fresh;
    }
    bucket.count += 1;
    return { count: bucket.count, resetAt: bucket.resetAt };
  }
}

export class RedisRateLimitStore implements RateLimitStore {
  constructor(private readonly redis: Pick<IORedis, "eval">) {}

  async increment(key: string, windowMs: number): Promise<RateLimitWindow> {
    const raw = (await this.redis.eval(INCREMENT_SCRIPT, 1, key, String(windowMs))) as [
      number,
      number,
    ];
    const count = Number(raw?.[0] ?? 0);
    const ttl = Number(raw?.[1] ?? windowMs);
    return { count, resetAt: Date.now() + Math.max(ttl, 0) };
  }
}

export function createRedisRateLimitStore(redisUrl: string): {
  store: RateLimitStore;
  close: () => Promise<void>;
} {
  const redis = new IORedis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
  });
  redis.on("error", () => undefined);
  return {
    store: new RedisRateLimitStore(redis),
    close: async () => {
      redis.disconnect();
    },
  };
}

let sharedStore: RateLimitStore | null = null;

export function setRateLimitStore(store: RateLimitStore | null): void {
  sharedStore = store;
}

export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  keyPrefix?: string;
  key?: (req: Request) => string;
  store?: RateLimitStore;
}): RequestHandler {
  const fallback = new MemoryRateLimitStore();
  const store = options.store ?? sharedStore ?? fallback;

  return (req, res, next) => {
    void (async () => {
      const identity = options.key
        ? options.key(req)
        : `${options.keyPrefix ?? "global"}:${req.ip ?? "unknown"}`;
      const key = `ratelimit:${identity}`;

      let window: RateLimitWindow;
      try {
        window = await store.increment(key, options.windowMs);
      } catch {
        window = await fallback.increment(key, options.windowMs);
      }

      const remaining = Math.max(0, options.max - window.count);
      res.setHeader("X-RateLimit-Remaining", String(remaining));
      if (window.count > options.max) {
        res.setHeader(
          "Retry-After",
          String(Math.max(1, Math.ceil((window.resetAt - Date.now()) / 1000))),
        );
        next(
          new AppError(ERROR_CODES.RATE_LIMITED, "Too many requests. Slow down and retry shortly.", {
            httpStatus: 429,
          }),
        );
        return;
      }
      next();
    })();
  };
}
