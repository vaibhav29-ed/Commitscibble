import { minimatch } from "minimatch";

export type FileKind =
  | "manifest"
  | "config"
  | "source"
  | "test"
  | "docs"
  | "ci"
  | "infra"
  | "asset"
  | "lockfile"
  | "other";

export interface InventoryEntry {
  path: string;
  size: number;
  language: string | null;
  kind: FileKind;
  score: number;
  includeInContext: boolean;
  exclusionReason?: string;
}

export interface InventoryExclusion {
  path: string;
  reason: string;
}

export interface Inventory {
  entries: InventoryEntry[];
  selected: InventoryEntry[];
  excluded: InventoryExclusion[];
  totalFiles: number;
  truncated: boolean;
}

export interface InventoryOptions {
  ignoredPaths?: string[];
  gitignore?: string | null;
  maxFiles?: number;
  maxFileBytes?: number;
}

const EXCLUDED_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "out",
  "output",
  ".next",
  ".nuxt",
  ".output",
  ".turbo",
  "coverage",
  "vendor",
  "__pycache__",
  ".venv",
  "venv",
  "env",
  "target",
  "pods",
  ".idea",
  ".vscode",
  ".cache",
  "tmp",
  "temp",
  "logs",
  ".pytest_cache",
  ".mypy_cache",
  ".ruff_cache",
  "bin",
  "obj",
]);

const BINARY_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "avif",
  "ico",
  "bmp",
  "tiff",
  "pdf",
  "zip",
  "gz",
  "tar",
  "tgz",
  "bz2",
  "7z",
  "rar",
  "exe",
  "dll",
  "so",
  "dylib",
  "class",
  "jar",
  "war",
  "wasm",
  "woff",
  "woff2",
  "ttf",
  "otf",
  "eot",
  "mp3",
  "mp4",
  "mov",
  "avi",
  "mkv",
  "wav",
  "psd",
  "sketch",
  "fig",
  "db",
  "sqlite",
  "sqlite3",
  "pyc",
  "pyd",
  "o",
  "a",
  "lib",
  "snap",
]);

const LOCKFILES = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lockb",
  "poetry.lock",
  "uv.lock",
  "pipfile.lock",
  "cargo.lock",
  "go.sum",
  "composer.lock",
  "gemfile.lock",
  "pdm.lock",
]);

const MANIFEST_FILES = new Set([
  "package.json",
  "pyproject.toml",
  "requirements.txt",
  "pipfile",
  "poetry.lock",
  "setup.py",
  "setup.cfg",
  "go.mod",
  "cargo.toml",
  "composer.json",
  "gemfile",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  "dockerfile",
  "docker-compose.yml",
  "docker-compose.yaml",
  "compose.yml",
  "compose.yaml",
  "makefile",
  "turbo.json",
  "nx.json",
  "lerna.json",
  "pnpm-workspace.yaml",
  "deno.json",
]);

const SECRET_FILE_PATTERNS = [
  /(^|\/)\.env(\.|$)/i,
  /(^|\/)\.env$/,
  /(^|\/)[^/]*\.(pem|key|p12|pfx|keystore|jks)$/i,
  /(^|\/)id_(rsa|dsa|ecdsa|ed25519)$/i,
  /(^|\/)\.npmrc$/i,
  /(^|\/)\.netrc$/i,
  /(^|\/)credentials(\.json)?$/i,
  /(^|\/)secrets?\.(json|ya?ml|toml)$/i,
];

const ENV_TEMPLATE_PATTERN = /(^|\/)\.env\.(example|sample|template|defaults?)$/i;

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  ts: "TypeScript",
  tsx: "TypeScript",
  mts: "TypeScript",
  cts: "TypeScript",
  js: "JavaScript",
  jsx: "JavaScript",
  mjs: "JavaScript",
  cjs: "JavaScript",
  py: "Python",
  go: "Go",
  rs: "Rust",
  java: "Java",
  kt: "Kotlin",
  kts: "Kotlin",
  rb: "Ruby",
  php: "PHP",
  cs: "C#",
  cpp: "C++",
  cc: "C++",
  cxx: "C++",
  hpp: "C++",
  c: "C",
  h: "C",
  swift: "Swift",
  sh: "Shell",
  bash: "Shell",
  ps1: "PowerShell",
  sql: "SQL",
  vue: "Vue",
  svelte: "Svelte",
  dart: "Dart",
  scala: "Scala",
  ex: "Elixir",
  exs: "Elixir",
  clj: "Clojure",
  hs: "Haskell",
  lua: "Lua",
  r: "R",
  md: "Markdown",
  mdx: "Markdown",
};

const ENTRY_PATTERNS: RegExp[] = [
  /^(src\/)?(index|main|app|server|cli|bootstrap)\.(ts|tsx|js|jsx|mjs|cjs)$/,
  /^(?:src\/|app\/)?(?:main|app|manage|wsgi|asgi|run)\.py$/,
  /^(cmd\/[^/]+\/)?main\.go$/,
  /^src\/main\.rs$/,
  /^app\/(page|layout)\.(tsx|jsx|ts|js)$/,
  /^pages\/_app\.(tsx|jsx|ts|js)$/,
];

const TEST_PATTERN = /(^|\/)(tests?|__tests__|spec)\//i;
const TEST_FILE_PATTERN = /\.(test|spec)\.(ts|tsx|js|jsx|py|go|rs|java|kt)$/i;

export function extensionOf(path: string): string {
  const base = path.split("/").pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot < 0 ? "" : base.slice(dot + 1).toLowerCase();
}

export function baseName(path: string): string {
  return path.split("/").pop() ?? path;
}

export function languageOf(path: string): string | null {
  return LANGUAGE_BY_EXTENSION[extensionOf(path)] ?? null;
}

export function isEntryCandidate(path: string): boolean {
  const withoutPrefix = path.replace(/^\.\//, "");
  return ENTRY_PATTERNS.some((pattern) => pattern.test(withoutPrefix));
}

export function isTestPath(path: string): boolean {
  return TEST_PATTERN.test(path) || TEST_FILE_PATTERN.test(path);
}

export function isEnvTemplate(path: string): boolean {
  return ENV_TEMPLATE_PATTERN.test(path);
}

function isSecretFile(path: string): boolean {
  if (isEnvTemplate(path)) return false;
  return SECRET_FILE_PATTERNS.some((pattern) => pattern.test(path));
}

export function classifyFile(path: string): FileKind {
  const name = baseName(path).toLowerCase();
  const lowerPath = path.toLowerCase();
  if (MANIFEST_FILES.has(name)) return "manifest";
  if (/^(license|licence|copying)(\.(md|txt))?$/.test(name)) return "docs";
  if (LOCKFILES.has(name)) return "lockfile";
  if (isEnvTemplate(path)) return "config";
  if (lowerPath.startsWith(".github/workflows/") || name === ".gitlab-ci.yml" || name === "azure-pipelines.yml") return "ci";
  if (isTestPath(path)) return "test";
  if (name.startsWith("readme") || lowerPath.includes("/docs/") || lowerPath.startsWith("docs/")) return "docs";
  if (/^(dockerfile|jenkinsfile|procfile)$/i.test(name) || /\.(tf|tfvars)$/i.test(name)) return "infra";
  if (["svg", "png", "jpg", "jpeg", "gif", "webp", "ico"].includes(extensionOf(path))) return "asset";
  if (languageOf(path) === "Markdown") return "docs";
  if (languageOf(path)) return "source";
  if (["json", "yaml", "yml", "toml", "ini", "cfg", "conf"].includes(extensionOf(path))) return "config";
  return "other";
}

function scoreEntry(path: string, kind: FileKind, size: number): number {
  const depth = path.split("/").length - 1;
  let score = 0;
  switch (kind) {
    case "manifest":
      score = 110;
      break;
    case "ci":
      score = 85;
      break;
    case "infra":
      score = 80;
      break;
    case "config":
      score = 75;
      break;
    case "source":
      score = Math.max(20, 60 - depth * 5);
      break;
    case "test":
      score = Math.max(15, 45 - depth * 4);
      break;
    case "docs":
      score = 35;
      break;
    case "asset":
      score = 5;
      break;
    case "lockfile":
      score = 2;
      break;
    default:
      score = 10;
  }
  if (isEntryCandidate(path)) score += 30;
  if (isEnvTemplate(path)) score += 25;
  if (size > 120_000) score -= 25;
  return score;
}

export function parseGitignore(content: string): string[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

function matchesPattern(path: string, rawPattern: string): boolean {
  let pattern = rawPattern;
  const directoryOnly = pattern.endsWith("/");
  if (directoryOnly) pattern = pattern.replace(/\/+$/, "");
  if (!pattern) return false;
  const anchored = pattern.startsWith("/");
  if (anchored) pattern = pattern.slice(1);
  const candidates = anchored ? [pattern] : [pattern, `**/${pattern}`];
  return candidates.some((candidate) => {
    if (minimatch(path, candidate, { dot: true })) return true;
    if (minimatch(path, `${candidate}/**`, { dot: true })) return true;
    return directoryOnly && path.startsWith(`${candidate}/`);
  });
}

export function isIgnoredByGitignore(path: string, patterns: string[]): boolean {
  let ignored = false;
  for (const pattern of patterns) {
    const negated = pattern.startsWith("!");
    const effective = negated ? pattern.slice(1) : pattern;
    if (!effective) continue;
    if (matchesPattern(path, effective)) ignored = !negated;
  }
  return ignored;
}

export function buildInventory(
  files: { path: string; size: number; type?: string }[],
  options: InventoryOptions = {},
): Inventory {
  const maxFiles = options.maxFiles ?? 60;
  const maxFileBytes = options.maxFileBytes ?? 200_000;
  const gitignore = options.gitignore ? parseGitignore(options.gitignore) : [];
  const extraIgnores = options.ignoredPaths ?? [];

  const excluded: InventoryExclusion[] = [];
  const entries: InventoryEntry[] = [];

  for (const file of files) {
    if (file.type && file.type !== "blob") continue;
    const path = file.path.replace(/^\.\//, "");
    if (!path) continue;

    const segments = path.split("/");
    const excludedDir = segments.slice(0, -1).find((segment) => EXCLUDED_DIRS.has(segment.toLowerCase()));
    if (excludedDir) {
      excluded.push({ path, reason: `excluded directory: ${excludedDir}` });
      continue;
    }
    if (isSecretFile(path)) {
      excluded.push({ path, reason: "potential secret or credential file" });
      continue;
    }
    if (isIgnoredByGitignore(path, gitignore)) {
      excluded.push({ path, reason: "matched .gitignore" });
      continue;
    }
    if (extraIgnores.some((pattern) => matchesPattern(path, pattern))) {
      excluded.push({ path, reason: "matched repository ignore rules" });
      continue;
    }
    if (BINARY_EXTENSIONS.has(extensionOf(path))) {
      excluded.push({ path, reason: "binary file" });
      continue;
    }
    if (file.size > maxFileBytes) {
      excluded.push({ path, reason: `file exceeds ${maxFileBytes} byte limit` });
      continue;
    }

    const kind = classifyFile(path);
    if (kind === "lockfile") {
      excluded.push({ path, reason: "lockfile used only for package manager detection" });
      entries.push({
        path,
        size: file.size,
        language: null,
        kind,
        score: 2,
        includeInContext: false,
      });
      continue;
    }

    entries.push({
      path,
      size: file.size,
      language: languageOf(path),
      kind,
      score: scoreEntry(path, kind, file.size),
      includeInContext: kind !== "asset" && kind !== "other",
    });
  }

  const candidates = entries.filter((entry) => entry.includeInContext);
  candidates.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  const selected = candidates.slice(0, maxFiles);

  return {
    entries: entries.sort((a, b) => a.path.localeCompare(b.path)),
    selected,
    excluded,
    totalFiles: files.length,
    truncated: candidates.length > selected.length,
  };
}

export function countByLanguage(entries: InventoryEntry[]): { name: string; fileCount: number }[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    if (!entry.language || entry.kind === "docs" || entry.kind === "lockfile") continue;
    counts.set(entry.language, (counts.get(entry.language) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, fileCount]) => ({ name, fileCount }))
    .sort((a, b) => b.fileCount - a.fileCount);
}
