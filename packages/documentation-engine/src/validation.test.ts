import { describe, expect, it } from "vitest";
import { VALID_README, makeAnalysis } from "../../../tests/helpers/analysis.js";
import { extractCommands, guardCleanup, validateReadme } from "./validation.js";

const analysis = makeAnalysis();
const knownPaths = new Set([
  "package.json",
  "README.md",
  "LICENSE",
  "src/index.ts",
  ".env.example",
]);

function validate(markdown: string) {
  return validateReadme(markdown, { analysis, knownPaths, readmePath: "README.md" });
}

describe("README validation", () => {
  it("accepts a grounded README", () => {
    const result = validate(VALID_README);
    expect(result.hasBlockingErrors).toBe(false);
    expect(result.issues.filter((issue) => issue.severity === "error")).toEqual([]);
  });

  it("rejects documented scripts that do not exist", () => {
    const result = validate(`${VALID_README}\n\n\`\`\`bash\npnpm ghost-script\n\`\`\`\n`);
    expect(result.hasBlockingErrors).toBe(true);
    expect(result.issues.some((issue) => issue.code === "unknown_script")).toBe(true);
  });

  it("allows package-manager built-ins", () => {
    const markdown = `${VALID_README}\n\n\`\`\`bash\npnpm install\nnpm test\n\`\`\`\n`;
    const result = validate(markdown);
    expect(result.issues.some((issue) => issue.code === "unknown_script")).toBe(false);
  });

  it("blocks leaked credentials and placeholder content", () => {
    const secret = validate(`${VALID_README}\n\`ghp_abcdefghijklmnopqrstuvwxyz0123456789\`\n`);
    expect(secret.issues.some((issue) => issue.code === "secret_leak")).toBe(true);

    const placeholder = validate(`${VALID_README}\n\nClone https://github.com/your-org/your-repo\n`);
    expect(placeholder.issues.some((issue) => issue.code === "placeholder_content")).toBe(true);
  });

  it("blocks duplicate headings and broken relative links", () => {
    const duplicates = validate(`${VALID_README}\n\n## Installation\n\nAgain.\n`);
    expect(duplicates.issues.some((issue) => issue.code === "duplicate_heading")).toBe(true);

    const broken = validate(`${VALID_README}\n\nSee [the guide](docs/guide.md).\n`);
    expect(broken.issues.some((issue) => issue.code === "broken_relative_link")).toBe(true);
  });

  it("warns about environment variables absent from the template", () => {
    const markdown = VALID_README.replace(
      "| `DATABASE_URL` | Database connection |",
      "| `MADE_UP_VAR` | nope |",
    );
    const result = validate(markdown);
    expect(result.issues.some((issue) => issue.code === "unknown_env_var")).toBe(true);
    expect(result.hasBlockingErrors).toBe(false);
  });

  it("extracts commands from fenced blocks only", () => {
    const commands = extractCommands(
      "Use pnpm install inline.\n\n```bash\n$ pnpm build\n# comment\npnpm test\n```\n",
    );
    expect(commands).toEqual(["pnpm build", "pnpm test"]);
  });
});

describe("cleanup guard", () => {
  const original = `# Widget
## Installation
\`\`\`bash
pnpm install
pnpm build
\`\`\`
## Configuration
\`PORT\` and \`DATABASE_URL\` are required.
## License
MIT
`;

  it("blocks cleanup that drops documented commands", () => {
    const cleaned = `# Widget
## Installation
\`\`\`bash
pnpm install
\`\`\`
## Configuration
\`PORT\` and \`DATABASE_URL\` are required.
## License
MIT
`;
    const result = guardCleanup(original, cleaned, analysis);
    expect(result.blockers.some((issue) => issue.code === "cleanup_dropped_command")).toBe(true);
  });

  it("blocks cleanup that removes documented environment variables", () => {
    const cleaned = original.replace("`DATABASE_URL` are required.", "are required.");
    const result = guardCleanup(original, cleaned, analysis);
    expect(result.blockers.some((issue) => issue.code === "cleanup_dropped_env_var")).toBe(true);
  });

  it("blocks cleanup that removes more than 60% of the document", () => {
    const result = guardCleanup(original, "# Widget\n\nMIT\n", analysis);
    expect(result.blockers.some((issue) => issue.code === "cleanup_too_destructive")).toBe(true);
  });

  it("reports no change for identical content", () => {
    const result = guardCleanup(original, original, analysis);
    expect(result.changed).toBe(false);
    expect(result.blockers).toHaveLength(0);
  });
});
