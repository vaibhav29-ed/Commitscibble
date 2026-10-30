import { AiProviderError } from "../types.js";
import type { AiProviderName } from "@commitscibble/shared";

export interface FetchProviderOptions {
  apiKey: string;
  model: string;
  timeoutMs: number;
  name: AiProviderName;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

export async function postJson(options: {
  provider: AiProviderName;
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
        ? `${options.provider} request timed out after ${options.timeoutMs}ms`
        : `${options.provider} request failed due to a network error`,
      { retryable: true },
    );
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 429) {
    throw new AiProviderError(options.provider, "RATE_LIMITED", `${options.provider} rate limit reached`, {
      retryable: true,
      status: 429,
    });
  }
  if (response.status === 401 || response.status === 403) {
    throw new AiProviderError(
      options.provider,
      "AUTH",
      `${options.provider} rejected the configured credentials`,
      { retryable: false, fallbackEligible: true, status: response.status },
    );
  }
  if (response.status === 400 || response.status === 404 || response.status === 422) {
    throw new AiProviderError(
      options.provider,
      "INVALID_REQUEST",
      `${options.provider} rejected the request (status ${response.status}); check the configured model id`,
      { retryable: false, fallbackEligible: true, status: response.status },
    );
  }
  if (!response.ok) {
    throw new AiProviderError(
      options.provider,
      "SERVER",
      `${options.provider} upstream error (status ${response.status})`,
      { retryable: true, status: response.status },
    );
  }

  try {
    return await response.json();
  } catch {
    throw new AiProviderError(options.provider, "SERVER", `${options.provider} returned invalid JSON`, {
      retryable: true,
    });
  }
}
