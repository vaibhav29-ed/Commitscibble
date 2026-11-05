import { describe, expect, it } from "vitest";
import { parseReviewDiff } from "./review-cockpit";

const proposed = [
  "# Widget",
  "",
  "## Overview",
  "",
  "Widget is a toolkit.",
  "",
  "## Installation",
  "",
  "Run the installer.",
  "",
  "## Usage",
  "",
  "Import Widget.",
].join("\n");

describe("parseReviewDiff", () => {
  it("labels hunks with the nearest heading from the proposed document", () => {
    const diff = [
      "--- a/README.md",
      "+++ b/README.md",
      "@@ -1,3 +1,4 @@",
      " # Widget",
      " ",
      " ## Overview",
      "+Widget is a small toolkit.",
      "@@ -19,3 +20,4 @@",
      " ",
      " ## Usage",
      " ",
      "-Import Widget.",
      "+Import { Widget } from \"widget\";",
    ].join("\n");

    const parsed = parseReviewDiff(diff, proposed, ["overview", "usage"]);

    expect(parsed.filePath).toBe("README.md");
    expect(parsed.groups.map((group) => group.label)).toEqual(["Overview", "Usage"]);
    expect(parsed.groups[0].additions).toBe(1);
    expect(parsed.groups[1].deletions).toBe(1);
    expect(parsed.groups[1].additions).toBe(1);
    expect(parsed.groups[0]).toMatchObject({ firstLine: 1, lastLine: 4 });
    expect(parsed.groups[1]).toMatchObject({ firstLine: 20, lastLine: 23 });
    expect(parsed.additions).toBe(2);
    expect(parsed.deletions).toBe(1);
  });

  it("tracks old and new line numbers while rendering context", () => {
    const diff = [
      "--- a/README.md",
      "+++ b/README.md",
      "@@ -4,3 +4,3 @@",
      " unchanged",
      "-before",
      "+after",
      " still unchanged",
    ].join("\n");

    const parsed = parseReviewDiff(diff, proposed);
    const lines = parsed.groups[0].lines;

    expect(lines[0]).toMatchObject({ kind: "context", oldLine: 4, newLine: 4 });
    expect(lines[1]).toMatchObject({ kind: "remove", oldLine: 5, newLine: null });
    expect(lines[2]).toMatchObject({ kind: "add", oldLine: null, newLine: 5 });
    expect(lines[3]).toMatchObject({ kind: "context", oldLine: 6, newLine: 6 });
  });

  it("merges consecutive hunks that belong to the same section", () => {
    const diff = [
      "--- a/README.md",
      "+++ b/README.md",
      "@@ -5,2 +5,3 @@",
      " ## Installation",
      "+One more step.",
      "@@ -12,2 +9,2 @@",
      "-Old note.",
      "+New note.",
    ].join("\n");

    const parsed = parseReviewDiff(diff, proposed);

    expect(parsed.groups).toHaveLength(1);
    expect(parsed.groups[0].label).toBe("Installation");
    expect(parsed.groups[0].lines).toHaveLength(4);
  });

  it("falls back to the impacted section titles when the document has no headings", () => {
    const diff = [
      "--- a/README.md",
      "+++ b/README.md",
      "@@ -1,1 +1,2 @@",
      " Plain text",
      "+Extra text",
    ].join("\n");

    const parsed = parseReviewDiff(diff, "Plain text\nExtra text", ["overview"]);

    expect(parsed.groups[0].label).toBe("Overview");
  });

  it("does not split on hash comments inside fenced code blocks", () => {
    const diff = [
      "--- a/README.md",
      "+++ b/README.md",
      "@@ -0,0 +1,6 @@",
      "+## Installation",
      "+```bash",
      "+# Install the package",
      "+pnpm add widget-kit",
      "+```",
      "+Run it once.",
    ].join("\n");

    const parsed = parseReviewDiff(diff, proposed);

    expect(parsed.groups).toHaveLength(1);
    expect(parsed.groups[0].label).toBe("Installation");
    expect(parsed.groups[0].additions).toBe(6);
  });

  it("returns no groups for an empty diff", () => {
    expect(parseReviewDiff("")).toEqual({
      filePath: null,
      groups: [],
      additions: 0,
      deletions: 0,
    });
  });
});
