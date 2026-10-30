import { describe, expect, it } from "vitest";
import { hmacSha256Hex } from "@commitscibble/shared/node";
import { DOC_COMMIT_MARKER } from "@commitscibble/shared";
import {
  branchFromRef,
  getDeliveryId,
  isDocumentationCommitMessage,
  isPushEvent,
  isSelfAuthoredPush,
  parsePushPayload,
  pushTouchesPath,
  verifyWebhookSignature,
} from "./webhook.js";

const SECRET = "webhook-secret-value";

function pushBody(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    ref: "refs/heads/main",
    before: "1111111111111111111111111111111111111111",
    after: "2222222222222222222222222222222222222222",
    repository: {
      id: 42,
      name: "widget",
      full_name: "acme/widget",
      default_branch: "main",
      owner: { login: "acme" },
    },
    commits: [
      {
        id: "2222222",
        message: "feat: add endpoint",
        added: ["src/routes.ts"],
        removed: [],
        modified: [],
      },
    ],
    ...overrides,
  });
}

describe("webhook signature verification", () => {
  it("accepts a signature generated over the raw body", () => {
    const body = pushBody();
    const signature = `sha256=${hmacSha256Hex(SECRET, body)}`;
    expect(verifyWebhookSignature(SECRET, body, signature)).toBe(true);
  });

  it("rejects a signature over different content", () => {
    const signature = `sha256=${hmacSha256Hex(SECRET, "other body")}`;
    expect(verifyWebhookSignature(SECRET, pushBody(), signature)).toBe(false);
  });

  it("rejects an absent signature", () => {
    expect(verifyWebhookSignature(SECRET, pushBody(), undefined)).toBe(false);
  });

  it("rejects a signature made with the wrong secret", () => {
    const signature = `sha256=${hmacSha256Hex("wrong-secret", pushBody())}`;
    expect(verifyWebhookSignature(SECRET, pushBody(), signature)).toBe(false);
  });
});

describe("push parsing and loop prevention", () => {
  it("parses a valid GitHub push payload", () => {
    const payload = parsePushPayload(pushBody());
    expect(payload.repository.id).toBe(42);
    expect(payload.commits.length).toBe(1);
  });

  it("rejects malformed payloads", () => {
    expect(() => parsePushPayload(JSON.stringify({ ref: "refs/heads/main" }))).toThrow();
  });

  it("recognises documentation commits by marker", () => {
    expect(isDocumentationCommitMessage(`docs: update README ${DOC_COMMIT_MARKER}`)).toBe(true);
    expect(isDocumentationCommitMessage("docs: update README [commitscibble]")).toBe(true);
    expect(isDocumentationCommitMessage("feat: add endpoint")).toBe(false);
  });

  it("treats a push containing only documentation commits as self-authored", () => {
    const payload = parsePushPayload(
      pushBody({
        commits: [{ id: "abc", message: `docs: update ${DOC_COMMIT_MARKER}`, added: [], removed: [], modified: [] }],
        head_commit: { id: "abc", message: `docs: update ${DOC_COMMIT_MARKER}` },
      }),
    );
    expect(isSelfAuthoredPush(payload)).toBe(true);
  });

  it("does not treat mixed pushes as self-authored", () => {
    const payload = parsePushPayload(
      pushBody({
        commits: [
          { id: "abc", message: `docs: update ${DOC_COMMIT_MARKER}`, added: [], removed: [], modified: [] },
          { id: "def", message: "feat: new endpoint", added: [], removed: [], modified: [] },
        ],
      }),
    );
    expect(isSelfAuthoredPush(payload)).toBe(false);
  });

  it("ignores identical before/after SHAs", () => {
    const payload = parsePushPayload(pushBody({ before: "a".repeat(40), after: "a".repeat(40) }));
    expect(isSelfAuthoredPush(payload)).toBe(true);
  });

  it("detects when a push touches a path", () => {
    const payload = parsePushPayload(pushBody());
    expect(pushTouchesPath(payload, "src/routes.ts")).toBe(true);
    expect(pushTouchesPath(payload, "README.md")).toBe(false);
  });

  it("extracts branch names and delivery ids", () => {
    expect(branchFromRef("refs/heads/feature/docs")).toBe("feature/docs");
    expect(
      getDeliveryId({ "x-github-delivery": "delivery-123" } as Record<string, string | string[]>),
    ).toBe("delivery-123");
    expect(isPushEvent("push")).toBe(true);
    expect(isPushEvent("pull_request")).toBe(false);
  });
});
