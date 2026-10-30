import { describe, expect, it } from "vitest";
import type { ReadmeDraft } from "@commitscibble/shared";
import { assembleReadme, canonicalKeyForHeading, findSectionByCanonicalKey } from "./readme.js";
import { evaluateProposalFreshness } from "./apply-guard.js";
import { hashContent } from "@commitscibble/shared/node";

const draft: ReadmeDraft = {
  title: "Widget Service",
  summary: "An Express service for widgets.",
  sections: [
    {
      key: "license",
      heading: "License",
      level: 2,
      body: "MIT",
      evidence: ["LICENSE"],
      warnings: [],
    },
    {
      key: "overview",
      heading: "Overview",
      level: 2,
      body: "## Overview\n\nWidgets are stored in PostgreSQL.",
      evidence: ["src/index.ts"],
      warnings: [],
    },
    {
      key: "installation",
      heading: "Installation",
      level: 2,
      body: "```bash\npnpm install\n```",
      evidence: ["package.json"],
      warnings: [],
    },
  ],
  warnings: [],
};

describe("README assembly", () => {
  it("orders sections canonically and removes duplicate heading lines", () => {
    const markdown = assembleReadme(draft);
    const overviewIndex = markdown.indexOf("## Overview");
    const installationIndex = markdown.indexOf("## Installation");
    const licenseIndex = markdown.indexOf("## License");
    expect(overviewIndex).toBeGreaterThan(-1);
    expect(installationIndex).toBeGreaterThan(overviewIndex);
    expect(licenseIndex).toBeGreaterThan(installationIndex);
    expect(markdown).not.toContain("## Overview\n\n## Overview");
    expect(markdown.startsWith("# Widget Service\n\nAn Express service")).toBe(true);
  });

  it("maps headings to canonical section keys", () => {
    expect(canonicalKeyForHeading("Getting Started")).toBe("installation");
    expect(canonicalKeyForHeading("Environment Variables")).toBe("configuration");
    expect(canonicalKeyForHeading("API Reference")).toBe("api-reference");
    expect(canonicalKeyForHeading("Something Else")).toBeNull();
  });

  it("finds a section by canonical key", () => {
    const readme = assembleReadme(draft);
    expect(findSectionByCanonicalKey(readme, "installation")?.heading).toBe("Installation");
  });
});

describe("proposal freshness (optimistic concurrency)", () => {
  const base = "# Doc\n\nOriginal\n";

  it("applies when the current README matches the recorded base", () => {
    expect(
      evaluateProposalFreshness({
        baseReadmeHash: hashContent(base),
        currentContent: base,
        proposedContent: "# Doc\n\nUpdated\n",
      }).decision,
    ).toBe("APPLY");
  });

  it("marks the proposal stale when someone edited the README", () => {
    const result = evaluateProposalFreshness({
      baseReadmeHash: hashContent(base),
      currentContent: "# Doc\n\nManual edit\n",
      proposedContent: "# Doc\n\nUpdated\n",
    });
    expect(result.decision).toBe("STALE");
    expect(result.reason).toMatch(/changed after this proposal/);
  });

  it("treats cosmetic-only differences as unchanged", () => {
    expect(
      evaluateProposalFreshness({
        baseReadmeHash: hashContent(base),
        currentContent: base.replace(/\n/g, "\r\n"),
        proposedContent: base,
      }).decision,
    ).toBe("NO_CHANGE");
  });
});
