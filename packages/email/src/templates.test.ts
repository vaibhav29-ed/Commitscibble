import { describe, expect, it } from "vitest";
import {
  documentationAppliedEmail,
  escapeHtml,
  reviewRequiredEmail,
  runFailedEmail,
} from "./templates.js";

const base = {
  repositoryFullName: "octo/example",
  repositoryHtmlUrl: "https://github.com/octo/example",
  runId: "run-1",
  appUrl: "https://app.example.com/",
};

describe("escapeHtml", () => {
  it("escapes markup characters", () => {
    expect(escapeHtml(`<script>"x" & 'y'</script>`)).toBe(
      "&lt;script&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/script&gt;",
    );
  });
});

describe("reviewRequiredEmail", () => {
  it("links to the review page and renders change stats", () => {
    const mail = reviewRequiredEmail({
      ...base,
      summary: "Expand the getting started section",
      additions: 12,
      deletions: 3,
      provider: "gemini",
      model: "gemini-2.5-flash",
    });

    expect(mail.subject).toContain("Review needed for octo/example");
    expect(mail.text).toContain("https://app.example.com/dashboard/reviews/run-1");
    expect(mail.text).toContain("+12 / -3 lines");
    expect(mail.html).toContain("gemini/gemini-2.5-flash");
    expect(mail.html).toContain("https://app.example.com/dashboard/reviews/run-1");
  });

  it("escapes the summary and falls back when empty", () => {
    const mail = reviewRequiredEmail({
      ...base,
      summary: "   ",
      additions: 0,
      deletions: 0,
      provider: null,
      model: null,
    });

    expect(mail.html).toContain("A new documentation proposal is ready.");
    expect(mail.html).toContain("the configured AI provider");
  });

  it("escapes untrusted summary content", () => {
    const mail = reviewRequiredEmail({
      ...base,
      summary: "<img src=x onerror=alert(1)>",
      additions: 1,
      deletions: 0,
      provider: null,
      model: null,
    });

    expect(mail.html).not.toContain("<img");
    expect(mail.html).toContain("&lt;img");
  });
});

describe("documentationAppliedEmail", () => {
  it("links to the committed README and commit", () => {
    const mail = documentationAppliedEmail({
      ...base,
      branch: "main",
      readmePath: "docs/README.md",
      commitSha: "abc123",
    });

    expect(mail.subject).toContain("README updated for octo/example");
    expect(mail.text).toContain("https://github.com/octo/example/blob/main/docs/README.md");
    expect(mail.text).toContain("https://github.com/octo/example/commit/abc123");
    expect(mail.html).toContain("abc123");
  });

  it("explains when no commit was required", () => {
    const mail = documentationAppliedEmail({
      ...base,
      branch: "main",
      readmePath: "README.md",
      commitSha: null,
    });

    expect(mail.text).toContain("no commit was created");
  });
});

describe("runFailedEmail", () => {
  it("includes the reason, code and activity link", () => {
    const mail = runFailedEmail({
      ...base,
      code: "AI_PROVIDER_ERROR",
      message: "All providers failed",
    });

    expect(mail.subject).toContain("Documentation run failed for octo/example");
    expect(mail.text).toContain("Reason: All providers failed");
    expect(mail.text).toContain("Error code: AI_PROVIDER_ERROR");
    expect(mail.text).toContain("https://app.example.com/dashboard/activity");
    expect(mail.html).toContain("AI_PROVIDER_ERROR");
  });

  it("escapes the failure message", () => {
    const mail = runFailedEmail({
      ...base,
      code: "INTERNAL_ERROR",
      message: "<b>boom</b>",
    });

    expect(mail.html).not.toContain("<b>boom</b>");
    expect(mail.html).toContain("&lt;b&gt;boom&lt;/b&gt;");
  });
});
