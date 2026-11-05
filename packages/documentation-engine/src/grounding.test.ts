import { describe, expect, it } from "vitest";
import type { GeneratedSection } from "@commitscibble/shared";
import { auditEvidenceGrounding } from "./grounding.js";

function section(
  overrides: Partial<GeneratedSection> & Pick<GeneratedSection, "key" | "heading" | "evidence">,
): GeneratedSection {
  return {
    level: 2,
    body: "Content.",
    warnings: [],
    ...overrides,
  };
}

const knownPaths = new Set([
  "package.json",
  ".env.example",
  "src/index.ts",
  "src/routes/health.ts",
  "src/routes/repositories.ts",
  "docs/architecture.md",
  "LICENSE",
]);

describe("evidence grounding audit", () => {
  it("accepts file and directory citations from the inventory", () => {
    const result = auditEvidenceGrounding(
      [
        section({ key: "installation", heading: "Installation", evidence: ["package.json"] }),
        section({ key: "api-reference", heading: "API Reference", evidence: ["src/routes/"] }),
      ],
      { knownPaths },
    );

    expect(result.sections.every((entry) => entry.grounded)).toBe(true);
    expect(result.unsupportedPaths).toHaveLength(0);
    expect(result.needsRepair).toBe(false);
    expect(result.summary).toContain("2/2 section(s)");
  });

  it("normalises leading ./ and Windows separators before matching", () => {
    const result = auditEvidenceGrounding(
      [
        section({
          key: "architecture",
          heading: "Architecture",
          evidence: ["./src/index.ts", "src\\routes\\health.ts"],
        }),
      ],
      { knownPaths },
    );

    expect(result.sections[0].unsupported).toHaveLength(0);
    expect(result.sections[0].verified).toEqual(["src/index.ts", "src/routes/health.ts"]);
    expect(result.needsRepair).toBe(false);
  });

  it("reports invented citations and asks for one repair pass", () => {
    const result = auditEvidenceGrounding(
      [
        section({
          key: "configuration",
          heading: "Configuration",
          evidence: [".env.example", "config/secrets.toml"],
        }),
      ],
      { knownPaths },
    );

    expect(result.unsupportedPaths).toEqual(["config/secrets.toml"]);
    expect(result.needsRepair).toBe(true);
    expect(result.feedback.join(" ")).toContain("config/secrets.toml");
    expect(result.warnings.join(" ")).toContain("not in the repository");
    expect(result.sections[0].grounded).toBe(true);
  });

  it("downgrades citations to warnings when the inventory is truncated", () => {
    const result = auditEvidenceGrounding(
      [section({ key: "usage", heading: "Usage", evidence: ["scripts/missing.ts"] })],
      { knownPaths, inventoryTruncated: true },
    );

    expect(result.unsupportedPaths).toEqual(["scripts/missing.ts"]);
    expect(result.needsRepair).toBe(false);
    expect(result.warnings).toHaveLength(1);
  });

  it("ignores free-form labels and flags sections without evidence", () => {
    const result = auditEvidenceGrounding(
      [
        section({ key: "license", heading: "License", evidence: ["license information"] }),
        section({ key: "overview", heading: "Overview", evidence: [] }),
      ],
      { knownPaths },
    );

    expect(result.unsupportedPaths).toHaveLength(0);
    expect(result.ungroundedSections).toEqual(["License", "Overview"]);
    expect(result.warnings).toHaveLength(2);
    expect(result.summary).toContain("0/2 section(s)");
  });

  it("handles an empty draft", () => {
    const result = auditEvidenceGrounding([], { knownPaths });
    expect(result.sections).toHaveLength(0);
    expect(result.needsRepair).toBe(false);
    expect(result.summary).toBe("No documentation sections were produced.");
  });
});
