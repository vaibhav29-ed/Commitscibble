import { describe, expect, it } from "vitest";
import { makeAnalysis } from "../../../tests/helpers/analysis.js";
import { applyIncrementalPatches, computeDocumentationImpact } from "./impact.js";

const base = makeAnalysis();

describe("documentation impact classification", () => {
  it("maps a new environment variable to the configuration section only", () => {
    const current = makeAnalysis({ envVars: [...base.envVars, "CACHE_TTL"] });
    const impact = computeDocumentationImpact({
      previous: base,
      current,
      changedPaths: [{ path: ".env.example" }],
    });
    expect(impact.sections.map((section) => section.key)).toContain("configuration");
    expect(impact.sections.map((section) => section.key)).not.toContain("deployment");
    expect(impact.sections.find((section) => section.key === "configuration")?.confidence).toBe("high");
  });

  it("maps a changed test script to the testing section", () => {
    const current = makeAnalysis({
      commands: { ...base.commands, test: "pnpm run test:ci", scripts: { ...base.commands.scripts, test: "vitest run --coverage" } },
    });
    const impact = computeDocumentationImpact({
      previous: base,
      current,
      changedPaths: [{ path: "package.json" }],
    });
    expect(impact.sections.map((section) => section.key)).toContain("testing");
    expect(impact.sections.map((section) => section.key)).not.toContain("installation");
  });

  it("preserves documentation when a source file changes without fact changes", () => {
    const impact = computeDocumentationImpact({
      previous: base,
      current: makeAnalysis(),
      changedPaths: [{ path: "src/components/Button.tsx", status: "modified" }],
    });
    expect(impact.noImpact).toBe(true);
    expect(impact.sections).toHaveLength(0);
  });

  it("flags removed endpoints for review", () => {
    const current = makeAnalysis({ routes: [] });
    const impact = computeDocumentationImpact({
      previous: base,
      current,
      changedPaths: [{ path: "src/routes.ts", status: "removed" }],
    });
    expect(impact.sections.map((section) => section.key)).toContain("api-reference");
    expect(impact.requiresReview).toBe(true);
    expect(impact.removedSourcePaths.join(" ")).toContain("GET /health");
  });

  it("respects the maintained section configuration", () => {
    const impact = computeDocumentationImpact({
      previous: base,
      current: makeAnalysis({ envVars: [...base.envVars, "NEW_VAR"] }),
      changedPaths: [{ path: ".env.example" }],
      maintainedSections: ["installation"],
    });
    expect(impact.noImpact).toBe(true);
  });

  it("uses section-to-source mappings when facts are unchanged", () => {
    const impact = computeDocumentationImpact({
      previous: base,
      current: makeAnalysis(),
      changedPaths: [{ path: "src/index.ts" }],
      sectionSources: { architecture: ["src/index.ts"] },
    });
    expect(impact.sections).toContainEqual(
      expect.objectContaining({ key: "architecture", confidence: "medium" }),
    );
  });
});

const README = `# Widget

Overview text.

## Installation

\`\`\`bash
pnpm install
\`\`\`

## Usage

Run the widget.

## License

MIT
`;

describe("incremental patching", () => {
  const impact = computeDocumentationImpact({
    previous: base,
    current: base,
    changedPaths: [],
    sectionSources: {},
  });

  it("applies only allowed patches and preserves other sections byte for byte", () => {
    const allowedImpact = {
      ...impact,
      sections: [
        {
          key: "installation" as const,
          reason: "install command changed",
          confidence: "high" as const,
          evidence: ["package.json"],
        },
      ],
      noImpact: false,
    };
    const result = applyIncrementalPatches(
      README,
      [
        {
          key: "installation",
          heading: "Installation",
          level: 2,
          body: "```bash\npnpm install --frozen-lockfile\n```",
          explanation: "Install now uses a frozen lockfile.",
          confidence: "high",
          warnings: [],
        },
      ],
      allowedImpact,
    );

    expect(result.changed).toBe(true);
    expect(result.markdown).toContain("pnpm install --frozen-lockfile");
    expect(result.markdown).toContain("## Usage\n\nRun the widget.");
    expect(result.markdown).toContain("## License\n\nMIT");
    expect(result.applied).toHaveLength(1);
  });

  it("rejects patches for sections that were not classified as affected", () => {
    const allowedImpact = {
      ...impact,
      sections: [
        {
          key: "installation" as const,
          reason: "install command changed",
          confidence: "high" as const,
          evidence: [],
        },
      ],
      noImpact: false,
    };
    const result = applyIncrementalPatches(
      README,
      [
        {
          key: "usage",
          heading: "Usage",
          level: 2,
          body: "Different usage text.",
          explanation: "Not allowed",
          confidence: "low",
          warnings: [],
        },
      ],
      allowedImpact,
    );
    expect(result.rejected[0].key).toBe("usage");
    expect(result.markdown).toBe(README);
  });

  it("rejects patches for sections missing from the README", () => {
    const allowedImpact = {
      ...impact,
      sections: [
        {
          key: "api-reference" as const,
          reason: "routes changed",
          confidence: "high" as const,
          evidence: [],
        },
      ],
      noImpact: false,
    };
    const result = applyIncrementalPatches(
      README,
      [
        {
          key: "api-reference",
          heading: "API Reference",
          level: 2,
          body: "New endpoints.",
          explanation: "New section",
          confidence: "high",
          warnings: [],
        },
      ],
      allowedImpact,
    );
    expect(result.rejected[0].reason).toMatch(/does not exist/);
  });
});
