import { redactSecrets, type AiProviderName } from "@commitscibble/shared";
import { AiProviderError } from "../types.js";

export interface FetchProviderOptions {
  apiKey: string;
  model: string;
  timeoutMs: number;
  name: AiProviderName;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

/** Provider error bodies are short; keep a redacted one-line excerpt for logs. */
function responseSnippet(body: string): string | null {
  const compact = body.replace(/\s+/g, " ").trim();
  if (!compact) return null;
  return redactSecrets(compact).slice(0, 500);
}

export async function postJson(options: {
  provider: AiProviderName;
  model: string;
  url: string;
  headers: Record<string, string>;
  body: unknown;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}): Promise<unknown> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  let response: Response;
  try {
    response = await fetchImpl(options.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...options.headers },
      body: JSON.stringify(options.body),
      signal: controller.signal,
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    throw new AiProviderError(
      options.provider,
      aborted ? "TIMEOUT" : "NETWORK",
      aborted
        ? `${options.provider} request timed out after ${options.timeoutMs}ms (model ${options.model})`
        : `${options.provider} request failed due to a network error (model ${options.model})`,
      { retryable: true, model: options.model, cause: aborted ? undefined : error },
    );
  } finally {
    clearTimeout(timeout);
  }

  const rawBody = await response.text().catch(() => "");
  const status = response.status;
  const snippet = responseSnippet(rawBody);
  const detail = snippet ? `: ${snippet}` : "";
  const base = { status, model: options.model, responseSnippet: snippet };

  if (status === 429) {
    throw new AiProviderError(
      options.provider,
      "RATE_LIMITED",
      `${options.provider} rate limit reached (HTTP 429, model ${options.model})${detail}`,
      { ...base, retryable: true },
    );
  }
  if (status === 401 || status === 403) {
    throw new AiProviderError(
      options.provider,
      "AUTH",
      `${options.provider} rejected the configured credentials (HTTP ${status}, model ${options.model})${detail}`,
      { ...base, retryable: false, fallbackEligible: true },
    );
  }
  if (status === 400 || status === 404 || status === 422) {
    throw new AiProviderError(
      options.provider,
      "INVALID_REQUEST",
      `${options.provider} rejected the request (HTTP ${status}, model ${options.model})${detail}`,
      { ...base, retryable: false, fallbackEligible: true },
    );
  }
  if (!response.ok) {
    throw new AiProviderError(
      options.provider,
      "SERVER",
      `${options.provider} upstream error (HTTP ${status}, model ${options.model})${detail}`,
      { ...base, retryable: true },
    );
  }

  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    throw new AiProviderError(
      options.provider,
      "SERVER",
      `${options.provider} returned invalid JSON (HTTP ${status}, model ${options.model})`,
      { ...base, retryable: true },
    );
  }
}
