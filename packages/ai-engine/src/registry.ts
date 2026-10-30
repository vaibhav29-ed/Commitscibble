import type { z } from "zod";
import { AppError, ERROR_CODES, type UsageRecord } from "@commitscibble/shared";
import type {
  AiJsonRequest,
  AiOrchestratorOptions,
  AiProvider,
  AiProviderError,
  AiExecutionResult,
} from "./types.js";
import { AiProviderError as ProviderError } from "./types.js";

class Semaphore {
  private active = 0;
  private readonly queue: (() => void)[] = [];

  constructor(private readonly limit: number) {}

  async acquire(): Promise<() => void> {
    if (this.active < this.limit) {
      this.active += 1;
      return () => this.release();
    }
    await new Promise<void>((resolve) => this.queue.push(resolve));
    this.active += 1;
    return () => this.release();
  }

  private release(): void {
    this.active = Math.max(0, this.active - 1);
    const next = this.queue.shift();
    if (next) next();
  }
}

export interface StructuredAiResult<T> extends AiExecutionResult<T> {
  warnings: string[];
}

/**
 * Executes a structured AI request against an ordered provider list with
 * per-provider retries, bounded exponential backoff with jitter, concurrency
 * limiting, and provider fallback. Prompt/response content is never logged by
 * this layer; only provider, model, attempt, latency and a safe error code.
 */
export class AiOrchestrator {
  private readonly options: AiOrchestratorOptions;
  private readonly semaphores = new Map<string, Semaphore>();
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly random: () => number;

  constructor(options: AiOrchestratorOptions) {
    this.options = options;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.random = options.random ?? Math.random;
  }

  get providers(): AiProvider[] {
    return this.options.providers;
  }

  private semaphore(name: string): Semaphore {
    let semaphore = this.semaphores.get(name);
    if (!semaphore) {
      semaphore = new Semaphore(this.options.maxConcurrency);
      this.semaphores.set(name, semaphore);
    }
    return semaphore;
  }

  async generateStructured<T>(
    request: AiJsonRequest,
    schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  ): Promise<StructuredAiResult<T>> {
    if (this.options.providers.length === 0) {
      throw new AppError(
        ERROR_CODES.AI_NOT_CONFIGURED,
        "No AI provider is configured. Set GEMINI_API_KEY or GROQ_API_KEY (or AI_ALLOW_MOCK=true for local development).",
      );
    }

    const usage: UsageRecord[] = [];
    let lastError: AiProviderError | null = null;

    for (const provider of this.options.providers) {
      const release = await this.semaphore(provider.name).acquire();
      try {
        for (let attempt = 0; attempt <= this.options.maxRetries; attempt += 1) {
          const startedAt = Date.now();
          try {
            const response = await provider.generateJson(request);
            const latencyMs = Date.now() - startedAt;
            const record: UsageRecord = {
              provider: provider.name,
              model: provider.model,
              operation: request.operation,
              attempt: attempt + 1,
              latencyMs,
              promptChars: request.prompt.length + request.system.length,
              completionChars: response.text.length,
              outcome: "SUCCESS",
              errorCode: null,
            };
            usage.push(record);
            this.record(record);

            const parsed = parseAndValidate(response.text, schema, provider.name);
            return {
              data: parsed,
              provider: provider.name,
              model: provider.model,
              attempt: attempt + 1,
              latencyMs,
              usage,
              warnings: [],
            };
          } catch (error) {
            const providerError = normalizeError(error, provider.name);
            lastError = providerError;
            const latencyMs = Date.now() - startedAt;
            const retryable = providerError.retryable && attempt < this.options.maxRetries;
            const record: UsageRecord = {
              provider: provider.name,
              model: provider.model,
              operation: request.operation,
              attempt: attempt + 1,
              latencyMs,
              promptChars: request.prompt.length + request.system.length,
              completionChars: 0,
              outcome: retryable ? "RETRYABLE_FAILURE" : "FAILED",
              errorCode: providerError.code,
            };
            usage.push(record);
            this.record(record);

            if (!retryable) break;
            const base = this.options.baseDelayMs ?? 500;
            const cap = this.options.maxDelayMs ?? 8000;
            const delay = Math.min(cap, base * 2 ** attempt) * (0.5 + this.random());
            await this.sleep(Math.round(delay));
          }
        }
      } finally {
        release();
      }

      if (lastError && !lastError.fallbackEligible) break;
      if (lastError) {
        const fallbackRecord: UsageRecord = {
          provider: provider.name,
          model: provider.model,
          operation: request.operation,
          attempt: 0,
          latencyMs: 0,
          promptChars: 0,
          completionChars: 0,
          outcome: "FALLBACK",
          errorCode: lastError.code,
        };
        usage.push(fallbackRecord);
        this.record(fallbackRecord);
      }
    }

    throw new AppError(
      ERROR_CODES.AI_PROVIDER_ERROR,
      lastError
        ? `AI generation failed: ${describeFailure(lastError.provider, lastError.code)}`
        : "AI generation failed: no provider produced a response",
      { httpStatus: 502, retryable: true, details: { safeCode: lastError?.code ?? "UNKNOWN" } },
    );
  }

  private record(record: UsageRecord): void {
    this.options.onUsage?.(record);
  }
}

function describeFailure(provider: string, code: string): string {
  switch (code) {
    case "RATE_LIMITED":
      return `${provider} is rate limited. Retry later or configure a fallback provider.`;
    case "AUTH":
      return `${provider} credentials were rejected. Check the API key.`;
    case "TIMEOUT":
      return `${provider} timed out.`;
    case "INVALID_OUTPUT":
      return `${provider} returned output that did not match the required schema.`;
    case "INVALID_REQUEST":
      return `${provider} rejected the request. Check the configured model identifier.`;
    default:
      return `${provider} is temporarily unavailable (${code}).`;
  }
}

function normalizeError(error: unknown, provider: AiProvider["name"]): AiProviderError {
  if (error instanceof ProviderError) return error;
  if (error instanceof Error) {
    return new ProviderError(provider, "INVALID_OUTPUT", "AI response could not be parsed", {
      retryable: true,
      fallbackEligible: true,
    });
  }
  return new ProviderError(provider, "SERVER", "Unknown AI provider failure", { retryable: true });
}

/** Strip common JSON fencing before parsing, then enforce the output schema. */
export function parseAndValidate<T>(
  text: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  provider: string,
): T {
  const cleaned = stripJsonFences(text);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new ProviderError(provider as AiProvider["name"], "INVALID_OUTPUT", "Model output was not valid JSON", {
      retryable: true,
      fallbackEligible: true,
    });
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new ProviderError(
      provider as AiProvider["name"],
      "INVALID_OUTPUT",
      `Model output did not match the documentation schema (${result.error.issues
        .slice(0, 3)
        .map((issue) => issue.path.join("."))
        .join(", ")})`,
      { retryable: true, fallbackEligible: true },
    );
  }
  return result.data;
}

function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) return fenced[1];
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) return trimmed.slice(first, last + 1);
  return trimmed;
}
