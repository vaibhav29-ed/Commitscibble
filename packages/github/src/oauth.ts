import { z } from "zod";
import { AppError, ERROR_CODES } from "@commitscibble/shared";
import { hmacSha256Hex, safeEqualString } from "@commitscibble/shared/node";

const tokenResponseSchema = z.object({
  access_token: z.string().optional(),
  token_type: z.string().optional(),
  scope: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

export interface OAuthAuthorizeOptions {
  clientId: string;
  redirectUri: string;
  state: string;
  scopes?: string[];
}

export const DEFAULT_OAUTH_SCOPES = ["read:user", "user:email", "repo"];

export function buildAuthorizeUrl(options: OAuthAuthorizeOptions): string {
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", options.clientId);
  url.searchParams.set("redirect_uri", options.redirectUri);
  url.searchParams.set("state", options.state);
  url.searchParams.set("scope", (options.scopes ?? DEFAULT_OAUTH_SCOPES).join(" "));
  url.searchParams.set("allow_signup", "true");
  return url.toString();
}

export interface OAuthTokenResult {
  accessToken: string;
  scope: string;
}

export async function exchangeCodeForToken(options: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
  fetchImpl?: typeof fetch;
}): Promise<OAuthTokenResult> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const response = await fetchImpl("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: options.clientId,
      client_secret: options.clientSecret,
      code: options.code,
      redirect_uri: options.redirectUri,
    }),
  });

  if (!response.ok) {
    throw new AppError(ERROR_CODES.GITHUB_ERROR, "GitHub rejected the OAuth token exchange", {
      httpStatus: 502,
      details: { status: response.status },
    });
  }

  const parsed = tokenResponseSchema.parse(await response.json());
  if (!parsed.access_token) {
    throw new AppError(
      ERROR_CODES.OAUTH_DENIED,
      parsed.error_description ?? parsed.error ?? "GitHub did not return an access token",
      { httpStatus: 422 },
    );
  }
  return { accessToken: parsed.access_token, scope: parsed.scope ?? "" };
}

export function createOAuthState(secret: string, nonce: string, issuedAt: number): string {
  const payload = `${nonce}.${issuedAt}`;
  return `${payload}.${hmacSha256Hex(secret, payload)}`;
}

export function verifyOAuthState(
  secret: string,
  state: string | undefined,
  options: { maxAgeMs?: number; now?: number } = {},
): { valid: boolean; nonce: string | null } {
  if (!state) return { valid: false, nonce: null };
  const parts = state.split(".");
  if (parts.length !== 3) return { valid: false, nonce: null };
  const [nonce, issuedAtRaw, signature] = parts;
  if (!nonce || !issuedAtRaw || !signature) return { valid: false, nonce: null };
  const issuedAt = Number(issuedAtRaw);
  if (!Number.isFinite(issuedAt)) return { valid: false, nonce: null };
  const age = (options.now ?? Date.now()) - issuedAt;
  if (age < 0 || age > (options.maxAgeMs ?? 10 * 60 * 1000)) return { valid: false, nonce: null };
  const expected = hmacSha256Hex(secret, `${nonce}.${issuedAtRaw}`);
  return { valid: safeEqualString(expected, signature), nonce };
}
