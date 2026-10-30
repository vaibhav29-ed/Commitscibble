import type { EmailMessage } from "@commitscibble/email";
import {
  documentationAppliedEmail,
  reviewRequiredEmail,
  runFailedEmail,
} from "@commitscibble/email";
import {
  User,
  type DocumentationRunDocument,
  type RepositoryDocument,
} from "@commitscibble/persistence";
import type { WorkerDeps } from "./context.js";

/**
 * Email notifications are best-effort. Every helper resolves a recipient,
 * delegates delivery to the injected sender and swallows any failure: a mail
 * problem must never change the outcome of a documentation run.
 */

async function recipientFor(userId: DocumentationRunDocument["userId"]): Promise<string | null> {
  const user = await User.findById(userId).select("email githubLogin");
  return user?.email ?? null;
}

async function deliver(
  deps: WorkerDeps,
  userId: DocumentationRunDocument["userId"],
  build: (to: string) => EmailMessage,
  kind: string,
): Promise<void> {
  if (!deps.email.enabled) return;
  try {
    const to = await recipientFor(userId);
    if (!to) return;
    const delivered = await deps.email.send(build(to));
    if (!delivered) {
      deps.logger.warn("Email notification was not delivered", { kind });
    }
  } catch (error) {
    deps.logger.warn("Email notification failed", {
      kind,
      error: error instanceof Error ? error.message : "unknown error",
    });
  }
}

export function notifyReviewRequired(
  deps: WorkerDeps,
  args: {
    run: DocumentationRunDocument;
    repository: RepositoryDocument;
    summary: string;
    additions: number;
    deletions: number;
    provider: string | null;
    model: string | null;
  },
): Promise<void> {
  const { run, repository } = args;
  return deliver(
    deps,
    run.userId,
    (to) => ({
      ...reviewRequiredEmail({
        repositoryFullName: repository.fullName,
        repositoryHtmlUrl: repository.htmlUrl,
        runId: String(run._id),
        appUrl: deps.env.APP_URL,
        summary: args.summary,
        additions: args.additions,
        deletions: args.deletions,
        provider: args.provider,
        model: args.model,
      }),
      to,
    }),
    "review_required",
  );
}

export function notifyApplied(
  deps: WorkerDeps,
  args: {
    run: DocumentationRunDocument;
    repository: RepositoryDocument;
    branch: string;
    commitSha: string | null;
  },
): Promise<void> {
  const { run, repository } = args;
  return deliver(
    deps,
    run.userId,
    (to) => ({
      ...documentationAppliedEmail({
        repositoryFullName: repository.fullName,
        repositoryHtmlUrl: repository.htmlUrl,
        runId: String(run._id),
        appUrl: deps.env.APP_URL,
        branch: args.branch,
        readmePath: repository.settings.readmePath,
        commitSha: args.commitSha,
      }),
      to,
    }),
    "applied",
  );
}

export function notifyRunFailed(
  deps: WorkerDeps,
  args: {
    run: DocumentationRunDocument;
    repository: RepositoryDocument;
    code: string;
    message: string;
  },
): Promise<void> {
  const { run, repository } = args;
  return deliver(
    deps,
    run.userId,
    (to) => ({
      ...runFailedEmail({
        repositoryFullName: repository.fullName,
        repositoryHtmlUrl: repository.htmlUrl,
        runId: String(run._id),
        appUrl: deps.env.APP_URL,
        code: args.code,
        message: args.message,
      }),
      to,
    }),
    "run_failed",
  );
}
