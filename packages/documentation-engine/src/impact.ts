import {
  replaceSectionBodies,
  splitSections,
  type RepositoryAnalysis,
  type SectionKey,
  type SectionPatch,
} from "@commitscibble/shared";
import { hashContent } from "@commitscibble/shared/node";
import { extractCanonicalSections, findSectionByCanonicalKey } from "./readme.js";

export type ImpactConfidence = "high" | "medium" | "low";

export interface SectionImpact {
  key: SectionKey;
  reason: string;
  confidence: ImpactConfidence;
  evidence: string[];
}

export interface DocumentationImpact {
  sections: SectionImpact[];
  noImpact: boolean;
  requiresReview: boolean;
  summary: string;
  removedSourcePaths: string[];
}

export interface ImpactInput {
  previous: RepositoryAnalysis | null;
  current: RepositoryAnalysis;
  changedPaths: { path: string; status?: string }[];
  maintainedSections?: SectionKey[];
  sectionSources?: Record<string, string[]>;
}

const ALL_SECTIONS: SectionKey[] = [
  "overview",
  "features",
  "architecture",
  "tech-stack",
  "prerequisites",
  "installation",
  "configuration",
  "usage",
  "api-reference",
  "testing",
  "deployment",
  "troubleshooting",
  "security",
  "contributing",
  "license",
];

function diffSet(previous: string[], current: string[]): { added: string[]; removed: string[] } {
  const before = new Set(previous);
  const after = new Set(current);
  return {
    added: current.filter((value) => !before.has(value)),
    removed: previous.filter((value) => !after.has(value)),
  };
}

function describeList(values: string[], limit = 4): string {
  const shown = values.slice(0, limit).join(", ");
  return values.length > limit ? `${shown} +${values.length - limit} more` : shown;
}

/**
 * Decide which README sections a commit range can affect. This combines git
 * diff paths, derived analysis facts and section-to-source mapping rather than
 * relying on content hashes alone; unclassified source edits produce no impact
 * so manually authored sections are preserved.
 */
export function computeDocumentationImpact(input: ImpactInput): DocumentationImpact {
  const impacts = new Map<SectionKey, SectionImpact>();
  const removedSourcePaths: string[] = [];

  const add = (
    key: SectionKey,
    reason: string,
    confidence: ImpactConfidence,
    evidence: string[] = [],
  ): void => {
    const existing = impacts.get(key);
    if (!existing) {
      impacts.set(key, { key, reason, confidence, evidence });
      return;
    }
    const rank = { high: 3, medium: 2, low: 1 };
    if (rank[confidence] > rank[existing.confidence]) {
      existing.confidence = confidence;
      existing.reason = reason;
    }
    existing.evidence = [...new Set([...existing.evidence, ...evidence])];
  };

  if (!input.previous) {
    for (const key of input.maintainedSections?.length ? input.maintainedSections : ALL_SECTIONS) {
      add(key, "Initial repository analysis", "high", input.current.manifests);
    }
    return finalize(impacts, removedSourcePaths);
  }

  const previous = input.previous;
  const current = input.current;

  const commandsChanged =
    previous.commands.install !== current.commands.install ||
    previous.commands.dev !== current.commands.dev ||
    previous.commands.build !== current.commands.build ||
    previous.commands.test !== current.commands.test ||
    previous.commands.lint !== current.commands.lint;
  const scripts = diffSet(
    Object.keys(previous.commands.scripts),
    Object.keys(current.commands.scripts),
  );
  if (previous.commands.install !== current.commands.install) {
    add(
      "installation",
      `Install command changed from "${previous.commands.install ?? "none"}" to "${current.commands.install ?? "none"}"`,
      "high",
      current.manifests,
    );
    add("prerequisites", "Installation prerequisites may have changed", "medium");
  }
  if (previous.commands.dev !== current.commands.dev) {
    add("installation", "Development command changed", "high");
    add("usage", "Development workflow changed", "medium");
  }
  if (previous.commands.build !== current.commands.build) {
    add("installation", "Build command changed", "high");
    add("deployment", "Build output or command changed", "medium");
  }
  if (previous.commands.test !== current.commands.test) {
    add("testing", "Test command changed", "high");
  }
  if (previous.commands.lint !== current.commands.lint) {
    add("testing", "Lint command changed", "low");
  }
  if (!commandsChanged && (scripts.added.length > 0 || scripts.removed.length > 0)) {
    const described = [...scripts.added, ...scripts.removed];
    add(
      "installation",
      `Documented scripts changed: ${describeList(described)}`,
      "medium",
    );
    add("usage", `Scripts changed: ${describeList(described)}`, "low");
  }

  const envDiff = diffSet(previous.envVars, current.envVars);
  if (envDiff.added.length > 0 || envDiff.removed.length > 0) {
    add(
      "configuration",
      `Environment variables added: ${envDiff.added.length}, removed: ${envDiff.removed.length}`,
      "high",
      current.manifests,
    );
  }

  const previousRoutes = previous.routes.map((route) => `${route.method} ${route.path}`);
  const currentRoutes = current.routes.map((route) => `${route.method} ${route.path}`);
  const routeDiff = diffSet(previousRoutes, currentRoutes);
  if (routeDiff.added.length > 0) {
    add("api-reference", `New endpoints: ${describeList(routeDiff.added)}`, "high", current.routes.map((r) => r.source));
  }
  if (routeDiff.removed.length > 0) {
    add(
      "api-reference",
      `Removed endpoints: ${describeList(routeDiff.removed)}; documentation may need removal`,
      "high",
    );
    removedSourcePaths.push(...routeDiff.removed);
  }

  const frameworkDiff = diffSet(previous.frameworks, current.frameworks);
  if (frameworkDiff.added.length > 0 || frameworkDiff.removed.length > 0) {
    add("tech-stack", `Frameworks changed: ${describeList([...frameworkDiff.added, ...frameworkDiff.removed])}`, "high");
    add("features", "Framework capabilities may warrant a feature description update", "low");
  }

  const languageDiff = diffSet(
    previous.languages.map((language) => language.name),
    current.languages.map((language) => language.name),
  );
  if (languageDiff.added.length > 0 || languageDiff.removed.length > 0) {
    add("tech-stack", `Primary languages changed: ${describeList([...languageDiff.added, ...languageDiff.removed])}`, "high");
  }

  const entryDiff = diffSet(previous.entryPoints, current.entryPoints);
  if (entryDiff.added.length > 0 || entryDiff.removed.length > 0) {
    add("architecture", `Entry points changed: ${describeList([...entryDiff.added, ...entryDiff.removed])}`, "medium");
  }

  const directoryDiff = diffSet(
    previous.topLevelDirectories.map((directory) => directory.path),
    current.topLevelDirectories.map((directory) => directory.path),
  );
  if (directoryDiff.added.length > 0 || directoryDiff.removed.length > 0) {
    add("architecture", `Top-level directories changed: ${describeList([...directoryDiff.added, ...directoryDiff.removed])}`, "medium");
  }

  if (previous.license !== current.license) {
    add("license", `License changed from ${previous.license ?? "unknown"} to ${current.license ?? "unknown"}`, "high");
  }

  if (previous.docker !== current.docker || previous.ci.join() !== current.ci.join()) {
    add("deployment", "Docker or CI configuration changed", "medium");
    add("testing", "CI configuration changed", "low");
  }

  const manifestDiff = diffSet(previous.manifests, current.manifests);
  if (manifestDiff.added.length > 0 || manifestDiff.removed.length > 0) {
    add("installation", `Manifests changed: ${describeList([...manifestDiff.added, ...manifestDiff.removed])}`, "high");
    add("tech-stack", "Project manifests changed", "medium");
  }

  if (previous.monorepo !== current.monorepo) {
    add("architecture", "Monorepo structure changed", "medium");
  }

  const changedPathSet = new Set(input.changedPaths.map((change) => change.path));
  for (const [key, paths] of Object.entries(input.sectionSources ?? {})) {
    const overlap = paths.filter((path) => changedPathSet.has(path));
    if (overlap.length > 0 && ALL_SECTIONS.includes(key as SectionKey)) {
      add(key as SectionKey, `Source files mapped to this section changed: ${describeList(overlap)}`, "medium", overlap);
    }
  }

  if (input.changedPaths.some((change) => change.status === "removed")) {
    for (const [key, paths] of Object.entries(input.sectionSources ?? {})) {
      if (!overlapWithRemoved(paths, input.changedPaths)) continue;
      if (ALL_SECTIONS.includes(key as SectionKey)) {
        add(key as SectionKey, "A source file backing this section was deleted", "low");
        removedSourcePaths.push(...overlapWithRemoved(paths, input.changedPaths));
      }
    }
  }

  const filtered = input.maintainedSections?.length
    ? new Map([...impacts].filter(([key]) => input.maintainedSections?.includes(key)))
    : impacts;

  return finalize(filtered, removedSourcePaths);
}

function overlapWithRemoved(paths: string[], changed: { path: string; status?: string }[]): string[] {
  const removed = new Set(
    changed.filter((change) => change.status === "removed").map((change) => change.path),
  );
  return paths.filter((path) => removed.has(path));
}

function finalize(
  impacts: Map<SectionKey, SectionImpact>,
  removedSourcePaths: string[],
): DocumentationImpact {
  const sections = [...impacts.values()].sort(
    (a, b) => rank(b.confidence) - rank(a.confidence) || a.key.localeCompare(b.key),
  );
  const requiresReview =
    sections.some((section) => section.confidence === "low") || removedSourcePaths.length > 0;
  const summary =
    sections.length === 0
      ? "No documentation impact detected for these changes."
      : `Documentation impact in ${sections.length} section(s): ${sections
          .map((section) => section.key)
          .join(", ")}.`;
  return {
    sections,
    noImpact: sections.length === 0,
    requiresReview,
    summary,
    removedSourcePaths: [...new Set(removedSourcePaths)],
  };
}

function rank(confidence: ImpactConfidence): number {
  return confidence === "high" ? 3 : confidence === "medium" ? 2 : 1;
}

export interface ApplyPatchesResult {
  markdown: string;
  applied: { key: SectionKey; explanation: string; confidence: string }[];
  rejected: { key: string; reason: string }[];
  changed: boolean;
}

/**
 * Apply model-proposed section patches, rejecting anything outside the computed
 * impact set. All other sections are verified byte-identical before returning.
 */
export function applyIncrementalPatches(
  markdown: string,
  patches: SectionPatch[],
  impact: DocumentationImpact,
): ApplyPatchesResult {
  const allowed = new Set(impact.sections.map((section) => section.key));
  const rejected: ApplyPatchesResult["rejected"] = [];
  const replacements: Record<string, string> = {};
  const applied: ApplyPatchesResult["applied"] = [];
  const before = splitSections(markdown);
  const replacedKeys = new Map<string, SectionKey>();

  for (const patch of patches) {
    if (!allowed.has(patch.key)) {
      rejected.push({ key: patch.key, reason: "Section was not identified as affected by these changes" });
      continue;
    }
    const section = findSectionByCanonicalKey(markdown, patch.key);
    if (!section) {
      rejected.push({ key: patch.key, reason: "Section does not exist in the current README" });
      continue;
    }

    let body = patch.body.replace(/\r\n/g, "\n").trim();
    if (!body) {
      rejected.push({ key: patch.key, reason: "Proposed section body was empty" });
      continue;
    }
    if (new RegExp(`^#{1,6}\\s+${escapeRegExp(section.heading)}\\s*$`, "i").test(body.split("\n")[0])) {
      body = body.split("\n").slice(1).join("\n").trim();
    }
    const level = section.level;
    replacements[section.key] = `${"#".repeat(level)} ${patch.heading || section.heading}\n\n${body}\n\n`;
    replacedKeys.set(section.key, patch.key);
    applied.push({ key: patch.key, explanation: patch.explanation, confidence: patch.confidence });
  }

  if (Object.keys(replacements).length === 0) {
    return { markdown, applied, rejected, changed: false };
  }

  const updated = replaceSectionBodies(markdown, replacements);
  const after = splitSections(updated);
  for (const section of before.sections) {
    if (replacedKeys.has(section.key)) continue;
    const match = after.sections.find((candidate) => candidate.key === section.key);
    if (!match || hashContent(match.body) !== hashContent(section.body)) {
      throw new Error(
        `Incremental patch would modify unrelated section "${section.heading}"; refusing to apply`,
      );
    }
  }

  return {
    markdown: updated,
    applied,
    rejected,
    changed: hashContent(updated) !== hashContent(markdown),
  };
}

export interface SectionSourceMapping {
  sectionKey: SectionKey;
  heading: string;
  evidencePaths: string[];
  sourceHashes: Record<string, string>;
}

/** Map README sections to the repository files that justify them. */
export function mapSectionsToSources(
  markdown: string,
  analysis: RepositoryAnalysis,
  files: { path: string; content: string }[],
): SectionSourceMapping[] {
  const hashes = new Map(files.map((file) => [file.path, hashContent(file.content)]));
  const manifestPaths = analysis.manifests;
  const envPaths = analysis.evidence
    .filter((evidence) => evidence.reason.startsWith("environment variable"))
    .map((evidence) => evidence.path);
  const routePaths = analysis.routes.map((route) => route.source);
  const licensePaths = analysis.evidence
    .filter((evidence) => evidence.reason.startsWith("license"))
    .map((evidence) => evidence.path);
  const deploymentPaths = [
    ...analysis.ci,
    ...analysis.evidence.filter((evidence) => /deploy|docker/i.test(evidence.path)).map((evidence) => evidence.path),
  ];

  const pathsFor = (key: SectionKey): string[] => {
    switch (key) {
      case "installation":
      case "prerequisites":
      case "tech-stack":
      case "usage":
        return manifestPaths;
      case "configuration":
        return envPaths;
      case "api-reference":
        return [...new Set(routePaths)];
      case "testing":
        return manifestPaths;
      case "deployment":
        return [...new Set(deploymentPaths)];
      case "license":
        return licensePaths;
      case "architecture":
        return [...new Set([...manifestPaths, ...analysis.entryPoints])];
      case "overview":
        return manifestPaths.slice(0, 1);
      default:
        return [];
    }
  };

  return extractCanonicalSections(markdown).map(({ key, section }) => {
    const evidencePaths = pathsFor(key);
    return {
      sectionKey: key,
      heading: section.heading,
      evidencePaths,
      sourceHashes: Object.fromEntries(
        evidencePaths
          .filter((path) => hashes.has(path))
          .map((path) => [path, hashes.get(path) as string]),
      ),
    };
  });
}

/**
 * Snapshot of facts used for change detection. Content hashes are indicators
 * only; the pipeline still compares derived facts and git diffs.
 */
export function factsFingerprint(analysis: RepositoryAnalysis): Record<string, string> {
  return {
    install: hashContent(analysis.commands.install ?? ""),
    dev: hashContent(analysis.commands.dev ?? ""),
    build: hashContent(analysis.commands.build ?? ""),
    test: hashContent(analysis.commands.test ?? ""),
    lint: hashContent(analysis.commands.lint ?? ""),
    scripts: hashContent(JSON.stringify(analysis.commands.scripts)),
    envVars: hashContent(JSON.stringify(analysis.envVars)),
    routes: hashContent(JSON.stringify(analysis.routes)),
    frameworks: hashContent(JSON.stringify(analysis.frameworks)),
    languages: hashContent(JSON.stringify(analysis.languages)),
    entryPoints: hashContent(JSON.stringify(analysis.entryPoints)),
    directories: hashContent(JSON.stringify(analysis.topLevelDirectories)),
    manifests: hashContent(JSON.stringify(analysis.manifests)),
    license: hashContent(analysis.license ?? ""),
    deployment: hashContent(JSON.stringify([analysis.docker, analysis.ci])),
  };
}

export function sectionsSourceOverlap(
  changedPaths: string[],
  sectionSources: Record<string, string[]>,
): SectionKey[] {
  const changed = new Set(changedPaths);
  const keys: SectionKey[] = [];
  for (const [key, paths] of Object.entries(sectionSources)) {
    if (paths.some((path) => changed.has(path)) && ALL_SECTIONS.includes(key as SectionKey)) {
      keys.push(key as SectionKey);
    }
  }
  return keys;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
