import { describe, expect, it } from "vitest";
import { createUnifiedDiff, diffStats, splitLines, summarizeDiff } from "./diff.js";

describe("diff", () => {
  it("produces a unified diff with context for a single changed line", () => {
    const oldText = "line one\nline two\nline three\nline four\nline five\n";
    const newText = "line one\nline two\nline THREE\nline four\nline five\n";
    const diff = createUnifiedDiff(oldText, newText, { path: "README.md" });

    expect(diff).toContain("--- a/README.md");
    expect(diff).toContain("+++ b/README.md");
    expect(diff).toContain("-line three");
    expect(diff).toContain("+line THREE");
    expect(diff).toContain("@@ -1,5 +1,5 @@");
  });

  it("returns an empty string when content is unchanged", () => {
    expect(createUnifiedDiff("# Doc\n\nBody\n", "# Doc\n\nBody\n")).toBe("");
  });

  it("counts additions and deletions", () => {
    const stats = diffStats("a\nb\nc\n", "a\nc\nd\n");
    expect(stats.additions).toBe(1);
    expect(stats.deletions).toBe(1);
  });

  it("does not emit a phantom trailing empty line", () => {
    expect(splitLines("a\nb\n")).toEqual(["a", "b"]);
    expect(splitLines("")).toEqual([]);
  });

  it("summarizes only changed lines", () => {
    const diff = createUnifiedDiff("old\n", "new\n", { path: "README.md" });
    expect(summarizeDiff(diff)).toEqual(["-old", "+new"]);
  });

  it("handles a completely new document", () => {
    const diff = createUnifiedDiff("", "# New\n\nHello\n", { path: "README.md" });
    expect(diff).toContain("+# New");
    expect(diff).toContain("@@ -0,0 +1,3 @@");
  });
});
