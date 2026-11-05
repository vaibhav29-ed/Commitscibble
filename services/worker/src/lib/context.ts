import { AppError, ERROR_CODES, redactSecrets, type ActivityEventType } from "@commitscibble/shared";
import type { DocumentationAi } from "@commitscibble/ai-engine";
import type { EmailSender } from "@commitscibble/email";
import {
  GitHubClient,
  GitHubError,
  getInstallationToken,
  normalizePrivateKey,
} from "@commitscibble/github";
import {
  DocumentationRun,
  Repository,
  User,
  recordActivity,
  type DocumentationRunDocument,
  type RepositoryDocument,
} from "@commitscibble/persistence";
import type { Env } from "@commitscibble/config";
import { decryptGitHubToken } from "./crypto.js";
import type { Logger } from "./logger.js";
import { notifyRunFailed } from "./notifications.js";

export interface WorkerDeps {
  env: Env;
  logger: Logger;
  ai: DocumentationAi;
  email: EmailSender;
  nudgeOutbox: () => Promise<void>;
}

export class RunCancelledError extends Error {
  constructor(runId: string) {
    super(`Run ${runId} was cancelled`);
    this.name = "RunCancelledError";
  }
}

/** Cheap checkpoint: nothing is written to GitHub after a cancellation. */
export async function assertRunActive(runId: string): Promise<void> {
  const current = await DocumentationRun.findById(runId).select("status").lean();
  if (current?.status === "CANCELLED") throw new RunCancelledError(String(runId));
}

export interface PreparedRun {
  run: DocumentationRunDocument;
  repository: RepositoryDocument;
  client: GitHubClient;
  branch: string;
  headSha: string;
}

/** Atomically claim a queued/retrying/failed run for processing. */
export async function claimRun(runId: string): Promise<DocumentationRunDocument | null> {
  const run = await DocumentationRun.findOneAndUpdate(
    { _id: runId, status: { $in: ["QUEUED", "RETRYING", "FAILED"] } },
    {
      $set: {
        status: "RUNNING",
        startedAt: new Date(),
        completedAt: null,
        errorCode: null,
        errorMessage: null,
        notifiedFailureAt: null,
      },
    },
    { new: true },
  );
  if (run) return run;

  const existing = await DocumentationRun.findById(runId);
  if (!existing) {
    throw new AppError(ERROR_CODES.NOT_FOUND, `Run ${runId} no longer exists`, { httpStatus: 404 });
  }
  if (existing.status === "SUCCEEDED" || existing.status === "CANCELLED") {
    return null;
  }
  throw new AppError(
    ERROR_CODES.CONFLICT,
    `Run ${runId} is already being processed (${existing.status})`,
    { httpStatus: 409 },
  );
}

export async function getGitHubClient(
  env: Env,
  userId: string,
  installationId?: number | null,
): Promise<GitHubClient> {
  if (installationId && env.GITHUB_APP_ID && env.GITHUB_APP_PRIVATE_KEY) {
    const token = await getInstallationToken({
      appId: env.GITHUB_APP_ID,
      privateKey: normalizePrivateKey(env.GITHUB_APP_PRIVATE_KEY),
      installationId,
      baseUrl: env.GITHUB_API_BASE_URL,
    });
    return new GitHubClient({ token, baseUrl: env.GITHUB_API_BASE_URL });
  }

  const user = await User.findById(userId).select("+githubTokenEncrypted");
  if (!user?.githubTokenEncrypted) {
    throw new AppError(
      ERROR_CODES.GITHUB_UNAUTHORIZED,
      "The authorizing GitHub account has no stored credentials. Ask the user to sign in again.",
      { httpStatus: 401 },
    );
  }
  const token = decryptGitHubToken(user.githubTokenEncrypted, env.TOKEN_ENCRYPTION_KEY as string);
  return new GitHubClient({ token, baseUrl: env.GITHUB_API_BASE_URL });
}

export async function prepareRun(deps: WorkerDeps, runId: string): Promise<PreparedRun | null> {
  const run = await claimRun(runId);
  if (!run) {
    deps.logger.info("Skipping run that is already terminal", { runId });
    return null;
  }

  const repository = await Repository.findById(run.repositoryId);
  if (!repository) {
    await failRun(deps, run, new AppError(ERROR_CODES.NOT_FOUND, "Repository record no longer exists"));
    return null;
  }

  try {
    const client = await getGitHubClient(
      deps.env,
      String(run.userId),
      repository.githubInstallationId,
    );
    const branch = repository.settings.targetBranch ?? repository.defaultBranch;
    const branchInfo = await client.getBranch(repository.owner, repository.name, branch);
    return { run, repository, client, branch, headSha: branchInfo.sha };
  } catch (error) {
    await failRun(deps, run, error);
    throw error;
  }
}

export async function emitRunEvent(
  deps: WorkerDeps,
  prepared: Pick<PreparedRun, "run" | "repository">,
  type: ActivityEventType,
  message: string,
  options: {
    progress?: { step: number; total: number } | null;
    metadata?: Record<string, string | number | boolean> | null;
  } = {},
): Promise<void> {
  await recordActivity({
    userId: prepared.run.userId,
    repositoryId: prepared.run.repositoryId,
    repositoryFullName: prepared.repository.fullName,
    runId: prepared.run._id,
    jobId: prepared.run.jobId,
    type,
    message,
    logId: prepared.run.correlationId,
    progress: options.progress ?? null,
    metadata: options.metadata ?? null,
  });
  void deps.nudgeOutbox().catch(() => undefined);
}

export async function succeedRun(
  deps: WorkerDeps,
  prepared: Pick<PreparedRun, "run" | "repository">,
  message: string,
  options: { metadata?: Record<string, string | number | boolean> | null } = {},
): Promise<void> {
  const updated = await DocumentationRun.updateOne(
    { _id: prepared.run._id, status: "RUNNING" },
    { $set: { status: "SUCCEEDED", completedAt: new Date(), errorCode: null, errorMessage: null } },
  );
  if (updated.modifiedCount === 0) {
    deps.logger.info("Run is no longer RUNNING; skipping success transition", {
      runId: String(prepared.run._id),
    });
    return;
  }
  prepared.run.status = "SUCCEEDED";
  await emitRunEvent(deps, prepared, "SUCCESS", message, { metadata: options.metadata ?? null });
}

export async function failRun(
  deps: WorkerDeps,
  run: DocumentationRunDocument,
  error: unknown,
): Promise<void> {
  if (error instanceof RunCancelledError) {
    deps.logger.info("Run was cancelled; stopping before marking it failed", {
      runId: String(run._id),
    });
    void deps.nudgeOutbox().catch(() => undefined);
    return;
  }
  const appError =
    error instanceof AppError
      ? error
      : new AppError(ERROR_CODES.INTERNAL_ERROR, "Documentation run failed unexpectedly", {
          cause: error,
        });
  const message = safeErrorMessage(appError);
  try {
    const updated = await DocumentationRun.updateOne(
      { _id: run._id, status: "RUNNING" },
      {
        $set: {
          status: "FAILED",
          completedAt: new Date(),
          errorCode: appError.code,
          errorMessage: message,
        },
      },
    );
    if (updated.modifiedCount === 0) {
      deps.logger.info("Run is no longer RUNNING; skipping failure transition", {
        runId: String(run._id),
      });
      return;
    }
    run.status = "FAILED";
    const repository = await Repository.findById(run.repositoryId);
    await recordActivity({
      userId: run.userId,
      repositoryId: run.repositoryId,
      repositoryFullName: repository?.fullName ?? null,
      runId: run._id,
      jobId: run.jobId,
      type: "FAILED",
      message,
      logId: run.correlationId,
      metadata: { errorCode: appError.code },
    });
    if (repository) {
      await Repository.updateOne(
        { _id: repository._id },
        { $set: { documentationStatus: "STALE" } },
      );
      const claimed = await DocumentationRun.findOneAndUpdate(
        { _id: run._id, notifiedFailureAt: null },
        { $set: { notifiedFailureAt: new Date() } },
      );
      if (claimed) {
        void notifyRunFailed(deps, {
          run,
          repository,
          code: appError.code,
          message,
        });
      }
    }
  } finally {
    deps.logger.error("Documentation run failed", {
      runId: String(run._id),
      code: appError.code,
      error: redactSecrets(appError.message),
    });
    void deps.nudgeOutbox().catch(() => undefined);
  }
}

export function safeErrorMessage(error: AppError): string {
  if (error instanceof GitHubError) {
    return redactSecrets(error.message);
  }
  return redactSecrets(error.message).slice(0, 400);
}

export function assertCommitAvailable(repository: RepositoryDocument, sha: string): void {
  if (!/^[a-f0-9]{7,40}$/i.test(sha)) {
    throw new AppError(ERROR_CODES.VALIDATION_ERROR, "Invalid commit SHA in job data");
  }
  void repository;
}
