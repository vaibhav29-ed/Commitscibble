import type { EvidenceRef, RepositoryAnalysis } from "@commitscibble/shared";
import { countByLanguage, isEntryCandidate, isTestPath } from "./inventory.js";
import type { RepositorySnapshot } from "./snapshot.js";
import {
  buildCommands,
  detectEntryPoints,
  detectFrameworks,
  detectRoutes,
  extractManifestFacts,
} from "./manifests.js";

export interface AnalyzeOptions {
  fallbackName: string;
  analyzedAt?: Date;
}

export function analyzeRepository(
  snapshot: RepositorySnapshot,
  options: AnalyzeOptions,
): RepositoryAnalysis {
  const facts = extractManifestFacts(snapshot.files);
  const inventoryPaths = snapshot.inventory.entries.map((entry) => entry.path);
  const languages = countByLanguage(snapshot.inventory.entries);
  const frameworks = detectFrameworks(facts, inventoryPaths);
  const commands = buildCommands(facts);
  const envVars = [...new Set(facts.envTemplates.flatMap((template) => template.vars))].sort();
  const entryPoints = detectEntryPoints(snapshot.files);
  const sourceFiles = snapshot.files.filter(
    (file) => !file.path.endsWith(".json") && !file.path.endsWith(".md") && !file.path.endsWith(".toml"),
  );
  const routes = detectRoutes(sourceFiles);

  const directoryCounts = new Map<string, number>();
  for (const entry of snapshot.inventory.entries) {
    const segments = entry.path.split("/");
    if (segments.length < 2) continue;
    const top = segments[0];
    directoryCounts.set(top, (directoryCounts.get(top) ?? 0) + 1);
  }
  const topLevelDirectories = [...directoryCounts.entries()]
    .map(([path, files]) => ({ path, files }))
    .sort((a, b) => b.files - a.files)
    .slice(0, 12);

  const unsupported: string[] = [];
  if (!facts.packageJson && !facts.hasPython && !facts.hasGoModule && !facts.hasCargo && !facts.hasComposer && !facts.hasGemfile && !facts.hasMaven && !facts.hasGradle) {
    unsupported.push(
      "No recognized package manifest was found, so install/build/test commands could not be verified.",
    );
  }
  if (commands.install === null && commands.build === null) {
    unsupported.push("No runnable install or build commands could be derived from the repository.");
  }
  if (languages.length === 0) {
    unsupported.push("No recognized source files were found in the inspected file set.");
  }
  if (snapshot.inventory.truncated) {
    unsupported.push(
      `Only ${snapshot.inventory.selected.length} of ${snapshot.inventory.entries.length} eligible files were inspected; the remainder is not represented in this analysis.`,
    );
  }
  if (snapshot.readErrors.length > 0) {
    unsupported.push(
      `${snapshot.readErrors.length} file(s) could not be read at this revision and were excluded from the evidence set.`,
    );
  }
  if (facts.license.file && !facts.license.id) {
    unsupported.push(
      `A license file exists at ${facts.license.file} but its license could not be identified automatically.`,
    );
  }
  if (envVars.length === 0) {
    unsupported.push("No environment variable template was found, so configuration is not documented.");
  }

  const evidence: EvidenceRef[] = [];
  for (const path of facts.manifestPaths) {
    evidence.push({ path, reason: "manifest / project configuration" });
  }
  for (const template of facts.envTemplates) {
    evidence.push({ path: template.path, reason: "environment variable names (values are never read)" });
  }
  if (facts.license.file) {
    evidence.push({
      path: facts.license.file,
      reason: facts.license.id ? `license: ${facts.license.id}` : "license file (unidentified)",
    });
  }
  for (const path of entryPoints) {
    evidence.push({ path, reason: "entry point" });
  }
  for (const route of routes.slice(0, 20)) {
    evidence.push({ path: route.source, reason: `route ${route.method} ${route.path}` });
  }

  const hasTests =
    snapshot.inventory.entries.some((entry) => isTestPath(entry.path)) || Boolean(commands.test);

  const projectName = facts.packageJson?.name ?? facts.cargoName ?? options.fallbackName;

  return {
    projectName,
    description: facts.packageJson?.description ?? null,
    languages,
    frameworks,
    packageManagers: facts.packageManager ? [facts.packageManager] : facts.hasPython ? ["pip"] : [],
    monorepo: facts.monorepo,
    manifests: facts.manifestPaths,
    commands,
    envVars,
    entryPoints,
    topLevelDirectories,
    routes,
    docker: facts.docker,
    ci: facts.ciWorkflows,
    license: facts.license.id,
    hasTests,
    hasReadme: Boolean(snapshot.readme),
    unsupported,
    evidence,
    filesConsidered: snapshot.inventory.totalFiles,
    filesIncluded: snapshot.files.length,
    analyzedAt: (options.analyzedAt ?? new Date()).toISOString(),
  };
}

export function selectEvidenceFiles(
  snapshot: RepositorySnapshot,
  analysis: RepositoryAnalysis,
  limit = 25,
): { path: string; content: string; reason: string }[] {
  const evidenceReasons = new Map(analysis.evidence.map((ref) => [ref.path, ref.reason]));
  const priority = (path: string): number => {
    if (analysis.manifests.includes(path)) return 100;
    if (evidenceReasons.has(path)) return 90;
    if (analysis.entryPoints.includes(path)) return 80;
    if (analysis.routes.some((route) => route.source === path)) return 70;
    if (isEntryCandidate(path)) return 60;
    return 10;
  };

  return snapshot.files
    .filter((file) => !/^(README|readme)/.test(file.path.split("/").pop() ?? ""))
    .map((file) => ({
      path: file.path,
      content: file.content,
      reason: evidenceReasons.get(file.path) ?? "repository source",
      score: priority(file.path),
    }))
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, limit)
    .map(({ path, content, reason }) => ({ path, content, reason }));
}
