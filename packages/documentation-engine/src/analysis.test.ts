import { describe, expect, it } from "vitest";
import {
  emptyRepoFiles,
  makeManyFiles,
  monorepoFiles,
  nodeAppFiles,
  pythonAppFiles,
  secretHeavyFiles,
} from "../../../tests/fixtures/repos.js";
import { analyzeRepository } from "./analysis.js";
import { buildRepositorySnapshot, createMemorySource, snapshotEntriesFromFiles } from "./snapshot.js";

async function analyze(files: Record<string, string>, maxFiles = 60) {
  const snapshot = await buildRepositorySnapshot(
    createMemorySource(files),
    snapshotEntriesFromFiles(files),
    { readmePath: "README.md", maxFiles },
  );
  return { snapshot, analysis: analyzeRepository(snapshot, { fallbackName: "fallback-name" }) };
}

describe("repository analysis", () => {
  it("derives commands, stack, env vars and routes from a Node.js repository", async () => {
    const { analysis } = await analyze(nodeAppFiles);

    expect(analysis.projectName).toBe("widget-service");
    expect(analysis.commands.install).toBe("pnpm install");
    expect(analysis.commands.dev).toBe("pnpm dev");
    expect(analysis.commands.test).toBe("pnpm test");
    expect(analysis.packageManagers).toEqual(["pnpm"]);
    expect(analysis.frameworks).toContain("Express");
    expect(analysis.envVars).toEqual(["DATABASE_URL", "FEATURE_FLAGS", "PORT"]);
    expect(analysis.routes.some((route) => route.method === "GET" && route.path === "/health")).toBe(true);
    expect(analysis.license).toBe("MIT");
    expect(analysis.ci).toEqual([".github/workflows/ci.yml"]);
    expect(analysis.hasReadme).toBe(true);
    expect(analysis.hasTests).toBe(true);
    expect(analysis.evidence.some((reference) => reference.path === "package.json")).toBe(true);
  });

  it("supports Python projects without assuming JavaScript", async () => {
    const { analysis } = await analyze(pythonAppFiles);

    expect(analysis.commands.install).toBe("pip install -r requirements.txt");
    expect(analysis.commands.build).toBeNull();
    expect(analysis.frameworks).toContain("FastAPI");
    expect(analysis.envVars).toEqual(["DATABASE_URL", "LOG_LEVEL"]);
    expect(analysis.routes.map((route) => `${route.method} ${route.path}`)).toEqual([
      "GET /items",
      "POST /items",
    ]);
    expect(analysis.hasReadme).toBe(false);
  });

  it("detects a monorepo layout", async () => {
    const { analysis } = await analyze(monorepoFiles);
    expect(analysis.monorepo).toBe(true);
    expect(analysis.projectName).toBe("acme-platform");
    expect(analysis.commands.install).toBe("pnpm install");
    expect(analysis.topLevelDirectories.map((directory) => directory.path)).toContain("packages");
  });

  it("reports unsupported repositories instead of inventing commands", async () => {
    const { analysis } = await analyze(emptyRepoFiles);
    expect(analysis.commands.install).toBeNull();
    expect(analysis.unsupported.join(" ")).toMatch(/No recognized package manifest/);
    expect(analysis.languages).toHaveLength(0);
  });

  it("never reads secret files", async () => {
    const { snapshot, analysis } = await analyze(secretHeavyFiles);
    const paths = snapshot.files.map((file) => file.path);
    expect(paths).not.toContain(".env");
    expect(paths).not.toContain("id_rsa");
    expect(paths).not.toContain("secrets.yml");
    expect(paths).not.toContain("node_modules/pkg/index.js");
    expect(paths).toContain(".env.example");
    expect(analysis.envVars).toEqual(["GITHUB_TOKEN"]);
  });

  it("flags truncated analysis for large repositories", async () => {
    const { snapshot, analysis } = await analyze(makeManyFiles(60), 10);
    expect(snapshot.inventory.truncated).toBe(true);
    expect(analysis.filesIncluded).toBeLessThanOrEqual(12);
    expect(analysis.unsupported.join(" ")).toMatch(/Only \d+ of \d+ eligible files were inspected/);
  });
});
