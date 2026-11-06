import type { AiProviderName, UsageRecord } from "@commitscibble/shared";

export interface AiJsonRequest {
  system: string;
  prompt: string;
  /** Logical operation label, recorded in usage data (never prompt content). */
  operation: string;
}

export interface AiRawResponse {
  text: string;
  /** Model that actually produced the text, when the provider can report it. */
  model?: string;
}

export interface AiProvider {
  readonly name: AiProviderName;
  readonly model: string;
  generateJson(request: AiJsonRequest): Promise<AiRawResponse>;
}

export type AiFailureCode =
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "NETWORK"
  | "AUTH"
  | "INVALID_REQUEST"
  | "SERVER"
  | "INVALID_OUTPUT";

export class AiProviderError extends Error {
  readonly provider: AiProviderName;
  readonly code: AiFailureCode;
  readonly retryable: boolean;
  readonly fallbackEligible: boolean;
  readonly status: number | null;
  /** Model id that was sent to the provider for the failing request. */
  readonly model: string | null;
  /** Short, redacted excerpt of the provider's error body. Never the API key. */
  readonly responseSnippet: string | null;

  constructor(
    provider: AiProviderName,
    code: AiFailureCode,
    message: string,
    options: {
      retryable?: boolean;
      fallbackEligible?: boolean;
      status?: number | null;
      model?: string | null;
      responseSnippet?: string | null;
      cause?: unknown;
    } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "AiProviderError";
    this.provider = provider;
    this.code = code;
    this.status = options.status ?? null;
    this.model = options.model ?? null;
    this.responseSnippet = options.responseSnippet ?? null;
    this.retryable =
      options.retryable ??
      (code === "RATE_LIMITED" || code === "TIMEOUT" || code === "NETWORK" || code === "SERVER");
    this.fallbackEligible = options.fallbackEligible ?? code !== "INVALID_REQUEST";
  }
}

export interface AiExecutionResult<T> {
  data: T;
  provider: AiProviderName;
  model: string;
  attempt: number;
  latencyMs: number;
  usage: UsageRecord[];
}

export interface AiOrchestratorOptions {
  providers: AiProvider[];
  maxRetries: number;
  timeoutMs: number;
  maxConcurrency: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  onUsage?: (record: UsageRecord) => void;
}

export interface AiProviderConfig {
  gemini: { apiKey: string | null; model: string };
  groq: { apiKey: string | null; model: string };
  mock: { enabled: boolean };
}
