import { createSign } from "node:crypto";
import { z } from "zod";
import { ERROR_CODES } from "@commitscibble/shared";
import { GitHubError } from "./client.js";

export interface GitHubAppCredentials {
  appId: string;
  privateKey: string;
}

export function normalizePrivateKey(value: string): string {
  const trimmed = value.trim();
  return trimmed.includes("\\n") ? trimmed.replace(/\\n/g, "\n") : trimmed;
}

export function appInstallUrl(slug: string): string {
  return `https://github.com/apps/${encodeURIComponent(slug)}/installations/new`;
}

function base64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

export function createAppJwt(credentials: GitHubAppCredentials, nowMs = Date.now()): string {
  const issuedAt = Math.floor(nowMs / 1000) - 60;
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(
    JSON.stringify({ iat: issuedAt, exp: issuedAt + 540, iss: credentials.appId }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  signer.end();
  const signature = signer
    .sign(normalizePrivateKey(credentials.privateKey))
    .toString("base64url");
  return `${header}.${payload}.${signature}`;
}

const installationTokenSchema = z
  .object({ token: z.string().min(1), expires_at: z.string() })
  .passthrough();

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

export function clearInstallationTokenCache(): void {
  tokenCache.clear();
}

export async function getInstallationToken(options: {
  appId: string;
  privateKey: string;
  installationId: number;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
}): Promise<string> {
  const now = options.now ?? (() => Date.now());
  const cacheKey = `${options.appId}:${options.installationId}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt - 60_000 > now()) return cached.token;

  const baseUrl = (options.baseUrl ?? "https://api.github.com").replace(/\/$/, "");
  const jwt = createAppJwt({ appId: options.appId, privateKey: options.privateKey }, now());
  const response = await (options.fetchImpl ?? fetch)(
    `${baseUrl}/app/installations/${options.installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        Authorization: `Bearer ${jwt}`,
        "User-Agent": "CommitScibble/0.1",
      },
    },
  );

  if (!response.ok) {
    throw new GitHubError(
      ERROR_CODES.GITHUB_UNAUTHORIZED,
      response.status,
      "GitHub App installation token could not be created. Reinstall the app or check its permissions.",
      { retryable: response.status >= 500 },
    );
  }

  const parsed = installationTokenSchema.parse(await response.json());
  const expiresAt = Date.parse(parsed.expires_at);
  tokenCache.set(cacheKey, {
    token: parsed.token,
    expiresAt: Number.isFinite(expiresAt) ? expiresAt : now() + 50 * 60_000,
  });
  return parsed.token;
}
