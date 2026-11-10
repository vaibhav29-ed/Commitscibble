import {
  DOC_COMMIT_MARKER,
  pushWebhookSchema,
  type PushWebhookPayload,
} from "@commitscibble/shared";
import { verifyHmacSha256 } from "@commitscibble/shared/node";

export function verifyWebhookSignature(
  secret: string,
  rawBody: string | Buffer,
  signature: string | undefined,
): boolean {
  return verifyHmacSha256(secret, rawBody, signature);
}

export function isPushEvent(eventName: string | undefined): boolean {
  return eventName === "push";
}

export function getDeliveryId(headers: Record<string, string | string[] | undefined>): string | null {
  const value = headers["x-github-delivery"];
  if (Array.isArray(value)) return value[0] ?? null;
  return value && value.length > 0 ? value : null;
}

export function parsePushPayload(rawBody: string): PushWebhookPayload {
  const parsed = JSON.parse(rawBody) as unknown;
  return pushWebhookSchema.parse(parsed);
}

export function branchFromRef(ref: string): string {
  return ref.replace(/^refs\/heads\//, "");
}

export function isDocumentationCommitMessage(message: string): boolean {
  return message.includes(DOC_COMMIT_MARKER) || /commitscibble/i.test(message);
}

export function isSelfAuthoredPush(payload: PushWebhookPayload): boolean {
  if (payload.after === payload.before) return true;
  const headMessage = payload.head_commit?.message;
  if (headMessage && isDocumentationCommitMessage(headMessage)) return true;
  if (payload.commits.length === 0) return false;
  return payload.commits.every((commit) => isDocumentationCommitMessage(commit.message));
}

export function pushTouchesPath(payload: PushWebhookPayload, path: string): boolean {
  return payload.commits.some(
    (commit) =>
      commit.added.includes(path) ||
      commit.removed.includes(path) ||
      commit.modified.includes(path),
  );
}
