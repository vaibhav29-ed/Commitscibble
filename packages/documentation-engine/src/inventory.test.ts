import { describe, expect, it } from "vitest";
import { nodeAppFiles, secretHeavyFiles } from "../../../tests/fixtures/repos.js";
import {
  buildInventory,
  classifyFile,
  isEntryCandidate,
  isEnvTemplate,
  isTestPath,
  parseGitignore,
} from "./inventory.js";

function entries(files: Record<string, string>) {
  return Object.entries(files).map(([path, content]) => ({
    path,
    size: Buffer.byteLength(content),
    type: "blob" as const,
  }));
}

describe("file inventory", () => {
  it("excludes dependencies, build output, binaries and secret files", () => {
    const inventory = buildInventory(entries(secretHeavyFiles), { maxFiles: 50 });
    const excludedPaths = inventory.excluded.map((entry) => entry.path);
    expect(excludedPaths).toContain(".env");
    expect(excludedPaths).toContain("id_rsa");
    expect(excludedPaths).toContain("secrets.yml");
    expect(excludedPaths).toContain("node_modules/pkg/index.js");
    expect(excludedPaths).toContain("dist/bundle.js");
    expect(excludedPaths).toContain("assets/logo.png");
    expect(inventory.selected.map((entry) => entry.path)).toContain(".env.example");
  });

  it("honours .gitignore patterns", () => {
    const inventory = buildInventory(
      entries({
        ...nodeAppFiles,
        "dist/bundle.js": "x",
        "coverage/report.json": "{}",
      }),
      { gitignore: nodeAppFiles[".gitignore"], maxFiles: 50 },
    );
    const excluded = inventory.excluded.map((entry) => entry.path);
    expect(excluded).toContain("dist/bundle.js");
    expect(excluded).toContain("coverage/report.json");
  });

  it("honours repository-specific ignore patterns", () => {
    const inventory = buildInventory(entries(nodeAppFiles), {
      ignoredPaths: ["src/*.test.ts"],
      maxFiles: 50,
    });
    expect(inventory.excluded.map((entry) => entry.path)).toContain("src/users.test.ts");
  });

  it("bounds the selected context deterministically", () => {
    const inventory = buildInventory(entries(nodeAppFiles), { maxFiles: 3 });
    expect(inventory.selected).toHaveLength(3);
    expect(inventory.truncated).toBe(true);
    expect(inventory.selected[0].kind).toBe("manifest");
  });

  it("classifies files by kind", () => {
    expect(classifyFile("package.json")).toBe("manifest");
    expect(classifyFile("src/index.ts")).toBe("source");
    expect(classifyFile("src/index.test.ts")).toBe("test");
    expect(classifyFile(".github/workflows/ci.yml")).toBe("ci");
    expect(classifyFile("Dockerfile")).toBe("manifest");
    expect(classifyFile("logo.png")).toBe("asset");
  });

  it("recognises entry points and env templates", () => {
    expect(isEntryCandidate("src/index.ts")).toBe(true);
    expect(isEntryCandidate("app/main.py")).toBe(true);
    expect(isEntryCandidate("src/utils.ts")).toBe(false);
    expect(isEnvTemplate(".env.example")).toBe(true);
    expect(isEnvTemplate(".env")).toBe(false);
    expect(isTestPath("tests/test_app.py")).toBe(true);
  });

  it("parses gitignore comments and negations", () => {
    const patterns = parseGitignore("# comment\n\ndist/\n!dist/keep.js\n");
    expect(patterns).toEqual(["dist/", "!dist/keep.js"]);
  });
});
