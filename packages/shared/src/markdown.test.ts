import { describe, expect, it } from "vitest";
import {
  findDuplicateHeadings,
  findHeadingLevelJumps,
  parseHeadings,
  replaceSectionBodies,
  splitSections,
} from "./markdown.js";

const README = `# Project

Intro paragraph.

## Overview

A short overview.

\`\`\`bash
# this is not a heading
echo "## neither is this"
\`\`\`

## Installation

Run the installer.

### Linux

Use the package manager.

## License

MIT
`;

describe("markdown sections", () => {
  it("parses headings while ignoring fenced code blocks", () => {
    const headings = parseHeadings(README).map((heading) => `${heading.level}:${heading.text}`);
    expect(headings).toEqual([
      "1:Project",
      "2:Overview",
      "2:Installation",
      "3:Linux",
      "2:License",
    ]);
  });

  it("splits level-2 sections beneath the title without losing content", () => {
    const split = splitSections(README);
    expect(split.preamble).toContain("# Project");
    expect(split.sections.map((section) => section.heading)).toEqual([
      "Overview",
      "Installation",
      "License",
    ]);
    const reassembled = split.preamble + split.sections.map((section) => section.body).join("");
    expect(reassembled).toBe(README);
  });

  it("nests deeper headings inside their parent section", () => {
    const split = splitSections(README);
    const installation = split.sections.find((section) => section.heading === "Installation");
    expect(installation?.body).toContain("### Linux");
  });

  it("replaces only the requested section", () => {
    const updated = replaceSectionBodies(README, {
      installation: "## Installation\n\nUse `pnpm install`.\n\n",
    });
    expect(updated).toContain("Use `pnpm install`.");
    expect(updated).not.toContain("Run the installer.");
    expect(updated).toContain("A short overview.");
    expect(updated).toContain("## License\n\nMIT\n");
    expect(updated.startsWith("# Project\n\nIntro paragraph.")).toBe(true);
  });

  it("rejects replacement bodies with a mismatched heading level", () => {
    expect(() =>
      replaceSectionBodies(README, { installation: "### Installation\n\nbad\n" }),
    ).toThrow(/heading level/);
  });

  it("rejects unknown section keys", () => {
    expect(() => replaceSectionBodies(README, { nope: "## Nope\n\nx\n" })).toThrow(/Unknown README section/);
  });

  it("detects duplicate headings on the same slug", () => {
    const duplicated = "## Usage\n\ntext\n\n## Usage\n\nmore\n";
    expect(findDuplicateHeadings(duplicated)).toEqual(["Usage"]);
  });

  it("detects heading level jumps", () => {
    const jumps = findHeadingLevelJumps("## A\n\n#### B\n");
    expect(jumps).toEqual([{ from: "A", to: "B" }]);
  });
});
