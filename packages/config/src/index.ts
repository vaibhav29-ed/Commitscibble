import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

const boolFromString = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  if (["true", "1", "yes", "on"].includes(value.toLowerCase())) return true;
  if (["false", "0", "no", "off", ""].includes(value.toLowerCase())) return false;
  return value;
}, z.boolean());

const optional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => (value === "" || value === undefined ? undefined : value), schema.optional());

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().max(65535).default(4000),
  API_URL: z.string().url().default("http://localhost:4000"),
  APP_URL: z.string().url().default("http://localhost:5173"),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  MONGO_URI: optional(z.string().min(1)),
  REDIS_URL: optional(z.string().min(1)),

  SESSION_SECRET: optional(z.string().min(32, "SESSION_SECRET must be at least 32 characters")),
  TOKEN_ENCRYPTION_KEY: optional(
    z.string().refine((value) => {
      try {
        return Buffer.from(value, "base64").length === 32;
      } catch {
        return false;
      }
    }, "TOKEN_ENCRYPTION_KEY must be a base64 encoded 32 byte key"),
  ),

  GITHUB_CLIENT_ID: optional(z.string().min(1)),
  GITHUB_CLIENT_SECRET: optional(z.string().min(1)),
  GITHUB_CALLBACK_URL: optional(z.string().url()),
  GITHUB_WEBHOOK_SECRET: optional(z.string().min(16)),
  GITHUB_API_BASE_URL: z.string().url().default("https://api.github.com"),
  GITHUB_REPOSITORY_LIMIT: z.coerce.number().int().min(1).max(5000).default(500),
  GITHUB_APP_ID: optional(z.string().regex(/^\d+$/, "GITHUB_APP_ID must be numeric")),
  GITHUB_APP_SLUG: optional(z.string().min(1)),
  GITHUB_APP_PRIVATE_KEY: optional(z.string().min(1)),

  AI_PROVIDER_PRIMARY: z.enum(["gemini", "groq", "mock"]).default("gemini"),
  AI_PROVIDER_FALLBACK: optional(z.enum(["gemini", "groq", "mock"])),
  AI_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
  AI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(300000).default(60000),
  AI_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(256).max(65536).default(8192),
  AI_MAX_CONCURRENCY: z.coerce.number().int().min(1).max(10).default(2),
  AI_MAX_CONTEXT_CHARS: z.coerce.number().int().min(5000).max(1_000_000).default(90000),
  AI_ALLOW_MOCK: boolFromString.default(false),

  GEMINI_API_KEY: optional(z.string().min(1)),
  GEMINI_MODEL: z.string().min(1).default("gemini-2.5-flash"),
  GROQ_API_KEY: optional(z.string().min(1)),
  GROQ_MODEL: z.string().min(1).default("openai/gpt-oss-120b"),

  CONVEX_URL: optional(z.string().url()),
  COMMITSCIBBLE_PUBLISH_TOKEN: optional(z.string().min(16)),

  README_FILE_NAME: z.string().min(1).default("README.md"),
  DOC_UPDATE_MODE: z.enum(["AUTOMATIC", "REVIEW"]).default("REVIEW"),
  STALE_RUN_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),
  WEBHOOK_RETENTION_DAYS: z.coerce.number().int().min(1).max(3650).default(30),
  AUDIT_RETENTION_DAYS: z.coerce.number().int().min(1).max(3650).default(90),

  BILLING_ENABLED: boolFromString.default(false),
  RAZORPAY_KEY_ID: optional(z.string().min(1)),
  RAZORPAY_KEY_SECRET: optional(z.string().min(1)),
  RAZORPAY_WEBHOOK_SECRET: optional(z.string().min(1)),

  RESEND_API_KEY: optional(z.string().min(1)),
  EMAIL_FROM: optional(z.string().min(1)),

  VITE_API_URL: optional(z.string().url()),
  VITE_CONVEX_URL: optional(z.string().url()),
});

export type Env = z.infer<typeof envSchema>;

const localUrlPattern = /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/i;

/**
 * Public URL of the web app. `APP_URL` is authoritative, but a production
 * deployment still carrying the localhost default would send users and email
 * links to their own machine. In that case fall back to the origin of the
 * configured OAuth callback, which always lives on the web host.
 */
export function publicAppUrl(env: Env): string {
  if (!localUrlPattern.test(env.APP_URL)) return env.APP_URL;
  if (env.NODE_ENV !== "production" || !env.GITHUB_CALLBACK_URL) return env.APP_URL;
  try {
    return new URL(env.GITHUB_CALLBACK_URL).origin;
  } catch {
    return env.APP_URL;
  }
}

let envFileLoaded = false;

/**
 * Load the repository `.env` once for local development. Deployed services keep
 * using their platform environment; real environment variables always win over
 * values in the file. Commands run from the repo root or from a workspace.
 */
function loadLocalEnvFile(): void {
  if (envFileLoaded) return;
  envFileLoaded = true;
  if (process.env.NODE_ENV === "test") return;
  const candidates = [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "..", "..", ".env"),
  ];
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    try {
      process.loadEnvFile(path);
    } catch {
      // A malformed or unreadable .env is surfaced by schema validation below.
    }
    return;
  }
}

export interface ServiceRequirements {
  role: "api" | "worker";
}

/** Validate environment variables and fail loudly with every missing key listed. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (source === process.env) loadLocalEnvFile();
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

export function assertServiceEnv(env: Env, requirements: ServiceRequirements): void {
  const missing: string[] = [];
  if (!env.MONGO_URI) missing.push("MONGO_URI");
  if (!env.REDIS_URL) missing.push("REDIS_URL");
  if (requirements.role === "api") {
    if (!env.SESSION_SECRET) missing.push("SESSION_SECRET");
    if (!env.TOKEN_ENCRYPTION_KEY) missing.push("TOKEN_ENCRYPTION_KEY");
    if (!env.GITHUB_CLIENT_ID) missing.push("GITHUB_CLIENT_ID");
    if (!env.GITHUB_CLIENT_SECRET) missing.push("GITHUB_CLIENT_SECRET");
    if (!env.GITHUB_CALLBACK_URL) missing.push("GITHUB_CALLBACK_URL");
    if (!env.GITHUB_WEBHOOK_SECRET) missing.push("GITHUB_WEBHOOK_SECRET");
  }
  if (requirements.role === "worker") {
    if (!env.TOKEN_ENCRYPTION_KEY) missing.push("TOKEN_ENCRYPTION_KEY");
    if (!env.GITHUB_WEBHOOK_SECRET) missing.push("GITHUB_WEBHOOK_SECRET");
  }
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables for the ${requirements.role} service:\n` +
        missing.map((key) => `  - ${key}`).join("\n") +
        "\nSee .env.example for the complete list.",
    );
  }
}

export interface GitHubAppEnvConfig {
  appId: string;
  slug: string;
  privateKey: string;
}

/** Installation-scoped GitHub access is enabled only when all three values exist. */
export function githubAppConfig(env: Env): GitHubAppEnvConfig | null {
  if (!env.GITHUB_APP_ID || !env.GITHUB_APP_SLUG || !env.GITHUB_APP_PRIVATE_KEY) return null;
  const privateKey = env.GITHUB_APP_PRIVATE_KEY.includes("\\n")
    ? env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, "\n")
    : env.GITHUB_APP_PRIVATE_KEY;
  return { appId: env.GITHUB_APP_ID, slug: env.GITHUB_APP_SLUG, privateKey };
}

export function corsOrigins(env: Env): string[] {
  return env.CORS_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

export interface AiConfig {
  primary: "gemini" | "groq" | "mock";
  fallback: "gemini" | "groq" | "mock" | null;
  providers: {
    gemini: { apiKey: string | null; model: string };
    groq: { apiKey: string | null; model: string };
    mock: { enabled: boolean };
  };
  maxRetries: number;
  timeoutMs: number;
  maxOutputTokens: number;
  maxConcurrency: number;
  maxContextChars: number;
}

export function aiConfig(env: Env): AiConfig {
  return {
    primary: env.AI_PROVIDER_PRIMARY,
    fallback: env.AI_PROVIDER_FALLBACK ?? null,
    providers: {
      gemini: { apiKey: env.GEMINI_API_KEY ?? null, model: env.GEMINI_MODEL },
      groq: { apiKey: env.GROQ_API_KEY ?? null, model: env.GROQ_MODEL },
      mock: { enabled: env.AI_ALLOW_MOCK && env.NODE_ENV !== "production" },
    },
    maxRetries: env.AI_MAX_RETRIES,
    timeoutMs: env.AI_TIMEOUT_MS,
    maxOutputTokens: env.AI_MAX_OUTPUT_TOKENS,
    maxConcurrency: env.AI_MAX_CONCURRENCY,
    maxContextChars: env.AI_MAX_CONTEXT_CHARS,
  };
}

export function isAiConfigured(env: Env): boolean {
  if (env.AI_PROVIDER_PRIMARY === "mock") return env.AI_ALLOW_MOCK;
  return env.AI_PROVIDER_PRIMARY === "gemini"
    ? Boolean(env.GEMINI_API_KEY)
    : Boolean(env.GROQ_API_KEY);
}

export function convexPublisherConfig(env: Env): { url: string; token: string } | null {
  if (!env.CONVEX_URL || !env.COMMITSCIBBLE_PUBLISH_TOKEN) return null;
  return { url: env.CONVEX_URL, token: env.COMMITSCIBBLE_PUBLISH_TOKEN };
}

export interface EmailConfig {
  apiKey: string;
  from: string;
}

/**
 * Transactional email is optional. It is only enabled when both a provider key
 * and a sender address are configured; otherwise every notification is a no-op.
 */
export function emailConfig(env: Env): EmailConfig | null {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return null;
  return { apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM };
}
