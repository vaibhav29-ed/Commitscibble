export const ERROR_CODES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHENTICATED: "UNAUTHENTICATED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  CSRF_FAILED: "CSRF_FAILED",
  OAUTH_STATE_INVALID: "OAUTH_STATE_INVALID",
  OAUTH_DENIED: "OAUTH_DENIED",
  GITHUB_UNAUTHORIZED: "GITHUB_UNAUTHORIZED",
  GITHUB_FORBIDDEN: "GITHUB_FORBIDDEN",
  GITHUB_NOT_FOUND: "GITHUB_NOT_FOUND",
  GITHUB_RATE_LIMITED: "GITHUB_RATE_LIMITED",
  GITHUB_ERROR: "GITHUB_ERROR",
  REPOSITORY_NOT_CONNECTED: "REPOSITORY_NOT_CONNECTED",
  REPOSITORY_DISCONNECTED: "REPOSITORY_DISCONNECTED",
  AI_NOT_CONFIGURED: "AI_NOT_CONFIGURED",
  AI_PROVIDER_ERROR: "AI_PROVIDER_ERROR",
  AI_INVALID_OUTPUT: "AI_INVALID_OUTPUT",
  README_VALIDATION_FAILED: "README_VALIDATION_FAILED",
  STALE_PROPOSAL: "STALE_PROPOSAL",
  PROPOSAL_NOT_PENDING: "PROPOSAL_NOT_PENDING",
  WEBHOOK_SIGNATURE_INVALID: "WEBHOOK_SIGNATURE_INVALID",
  UNSUPPORTED_OPERATION: "UNSUPPORTED_OPERATION",
  BILLING_DISABLED: "BILLING_DISABLED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  NOT_READY: "NOT_READY",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly retryable: boolean;
  readonly details?: unknown;

  constructor(
    code: ErrorCode,
    message: string,
    options: { httpStatus?: number; retryable?: boolean; details?: unknown; cause?: unknown } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "AppError";
    this.code = code;
    this.httpStatus = options.httpStatus ?? defaultStatus(code);
    this.retryable = options.retryable ?? false;
    this.details = options.details;
  }
}

function defaultStatus(code: ErrorCode): number {
  switch (code) {
    case ERROR_CODES.UNAUTHENTICATED:
      return 401;
    case ERROR_CODES.FORBIDDEN:
    case ERROR_CODES.CSRF_FAILED:
    case ERROR_CODES.REPOSITORY_DISCONNECTED:
      return 403;
    case ERROR_CODES.NOT_FOUND:
    case ERROR_CODES.GITHUB_NOT_FOUND:
      return 404;
    case ERROR_CODES.CONFLICT:
    case ERROR_CODES.STALE_PROPOSAL:
    case ERROR_CODES.PROPOSAL_NOT_PENDING:
      return 409;
    case ERROR_CODES.VALIDATION_ERROR:
    case ERROR_CODES.OAUTH_DENIED:
      return 422;
    case ERROR_CODES.RATE_LIMITED:
    case ERROR_CODES.GITHUB_RATE_LIMITED:
      return 429;
    case ERROR_CODES.AI_NOT_CONFIGURED:
      return 503;
    case ERROR_CODES.NOT_READY:
      return 503;
    case ERROR_CODES.WEBHOOK_SIGNATURE_INVALID:
      return 401;
    case ERROR_CODES.INTERNAL_ERROR:
      return 500;
    default:
      return 400;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function toAppError(error: unknown): AppError {
  if (isAppError(error)) return error;
  if (error instanceof Error) {
    return new AppError(ERROR_CODES.INTERNAL_ERROR, error.message, { cause: error });
  }
  return new AppError(ERROR_CODES.INTERNAL_ERROR, "Unexpected error");
}
