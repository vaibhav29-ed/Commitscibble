import { UnrecoverableError } from "bullmq";
import { AiProviderError } from "@commitscibble/ai-engine";
import { AppError, ERROR_CODES, redactSecrets } from "@commitscibble/shared";

export interface ErrorDiagnostics {
  name: string;
  message: string;
  code: string | null;
  stack: string | null;
  provider: string | null;
  model: string | null;
  status: number | null;
  providerCode: string | null;
  providerMessage: string | null;
  responseSnippet: string | null;
  causeMessage: string | null;
  causeStack: string | null;
}

const MAX_FIELD_LENGTH = 800;

function safe(value: string | null | undefined): string | null {
  if (!value) return null;
  return redactSecrets(value).slice(0, MAX_FIELD_LENGTH);
}

function causeChain(error: unknown): unknown[] {
  const chain: unknown[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current !== undefined && current !== null && !seen.has(current)) {
    chain.push(current);
    seen.add(current);
    current = current instanceof Error ? (current as { cause?: unknown }).cause : undefined;
  }
  return chain;
}

export function describeError(error: unknown): ErrorDiagnostics {
  const chain = causeChain(error);
  const appError = chain.find((entry): entry is AppError => entry instanceof AppError) ?? null;
  const providerError =
    chain.find((entry): entry is AiProviderError => entry instanceof AiProviderError) ?? null;
  const root = chain.length > 0 ? chain[chain.length - 1] : error;
  const details = (appError?.details ?? {}) as Record<string, unknown>;

  return {
    name: error instanceof Error ? error.name : "UnknownError",
    message: safe(error instanceof Error ? error.message : String(error)) ?? "Unknown error",
    code: appError?.code ?? null,
    stack: safe(error instanceof Error ? error.stack : null),
    provider:
      providerError?.provider ??
      (typeof details.provider === "string" ? details.provider : null),
    model:
      providerError?.model ?? (typeof details.model === "string" ? details.model : null),
    status:
      providerError?.status ?? (typeof details.status === "number" ? details.status : null),
    providerCode:
      providerError?.code ??
      (typeof details.safeCode === "string" ? details.safeCode : null),
    providerMessage: safe(providerError?.message),
    responseSnippet: safe(providerError?.responseSnippet),
    causeMessage: root instanceof Error ? safe(root.message) : null,
    causeStack: root instanceof Error ? safe(root.stack) : null,
  };
}

const PERMANENT_CODES: ReadonlySet<string> = new Set([
  ERROR_CODES.AI_NOT_CONFIGURED,
  ERROR_CODES.README_VALIDATION_FAILED,
  ERROR_CODES.VALIDATION_ERROR,
  ERROR_CODES.NOT_FOUND,
  ERROR_CODES.GITHUB_NOT_FOUND,
  ERROR_CODES.GITHUB_UNAUTHORIZED,
  ERROR_CODES.GITHUB_FORBIDDEN,
  ERROR_CODES.REPOSITORY_NOT_CONNECTED,
  ERROR_CODES.REPOSITORY_DISCONNECTED,
  ERROR_CODES.STALE_PROPOSAL,
  ERROR_CODES.PROPOSAL_NOT_PENDING,
  ERROR_CODES.UNSUPPORTED_OPERATION,
  ERROR_CODES.FORBIDDEN,
  ERROR_CODES.UNAUTHENTICATED,
  ERROR_CODES.CSRF_FAILED,
  ERROR_CODES.OAUTH_DENIED,
]);

export function isPermanentError(error: unknown): boolean {
  if (error instanceof UnrecoverableError) return true;
  if (error instanceof AiProviderError) return !error.retryable;
  if (error instanceof AppError) {
    if (PERMANENT_CODES.has(error.code)) return true;
    if (error.code === ERROR_CODES.AI_PROVIDER_ERROR) return !error.retryable;
    return false;
  }
  return false;
}

export function toQueueError(error: unknown): Error {
  if (error instanceof UnrecoverableError) return error;
  if (isPermanentError(error)) {
    const diagnostics = describeError(error);
    const wrapped = new UnrecoverableError(diagnostics.causeMessage ?? diagnostics.message);
    Object.defineProperty(wrapped, "cause", { value: error, configurable: true });
    return wrapped;
  }
  return error instanceof Error ? error : new Error(String(error));
}
