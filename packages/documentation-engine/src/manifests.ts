import { baseName, isEnvTemplate, isEntryCandidate, isTestPath, languageOf } from "./inventory.js";
import type { DetectedCommand, RepositoryAnalysis } from "@commitscibble/shared";

export interface PackageJsonFacts {
  name: string | null;
  description: string | null;
  scripts: Record<string, string>;
  dependencies: string[];
  devDependencies: string[];
  packageManager: string | null;
  isWorkspaceRoot: boolean;
  engines: Record<string, string>;
}

export interface ManifestFacts {
  files: { path: string; content: string }[];
  packageJson: PackageJsonFacts | null;
  packageManager: "pnpm" | "yarn" | "npm" | "bun" | null;
  hasPython: boolean;
  pythonManifest: string | null;
  poetryProject: boolean;
  hasGoModule: boolean;
  hasCargo: boolean;
  cargoName: string | null;
  hasComposer: boolean;
  hasGemfile: boolean;
  hasMaven: boolean;
  hasGradle: boolean;
  docker: boolean;
  compose: boolean;
  ciWorkflows: string[];
  envTemplates: { path: string; vars: string[] }[];
  license: { id: string | null; file: string | null };
  monorepo: boolean;
  manifestPaths: string[];
}

export function parsePackageJson(content: string): PackageJsonFacts | null {
  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const scripts: Record<string, string> = {};
  if (record.scripts && typeof record.scripts === "object") {
    for (const [key, value] of Object.entries(record.scripts as Record<string, unknown>)) {
      if (typeof value === "string") scripts[key] = value;
    }
  }
  const readDeps = (value: unknown): string[] =>
    value && typeof value === "object" ? Object.keys(value as Record<string, unknown>) : [];
  return {
    name: typeof record.name === "string" ? record.name : null,
    description: typeof record.description === "string" ? record.description : null,
    scripts,
    dependencies: readDeps(record.dependencies),
    devDependencies: readDeps(record.devDependencies),
    packageManager: typeof record.packageManager === "string" ? record.packageManager : null,
    isWorkspaceRoot: Boolean(record.workspaces),
    engines:
      record.engines && typeof record.engines === "object"
        ? Object.fromEntries(
            Object.entries(record.engines as Record<string, unknown>).filter(
              (entry): entry is [string, string] => typeof entry[1] === "string",
            ),
          )
        : {},
  };
}

export function parseEnvVarNames(content: string): string[] {
  const names = new Set<string>();
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^(?:export\s+)?([A-Z][A-Z0-9_]{1,64})\s*=/);
    if (match) names.add(match[1]);
  }
  return [...names].sort();
}

const LICENSE_MARKERS: { id: string; pattern: RegExp }[] = [
  { id: "MIT", pattern: /MIT License/i },
  { id: "Apache-2.0", pattern: /Apache License,?\s+Version 2\.0/i },
  { id: "GPL-3.0", pattern: /GNU GENERAL PUBLIC LICENSE\s+Version 3/i },
  { id: "GPL-2.0", pattern: /GNU GENERAL PUBLIC LICENSE\s+Version 2/i },
  { id: "AGPL-3.0", pattern: /GNU AFFERO GENERAL PUBLIC LICENSE/i },
  { id: "LGPL-3.0", pattern: /GNU LESSER GENERAL PUBLIC LICENSE/i },
  { id: "MPL-2.0", pattern: /Mozilla Public License,?\s+Version 2\.0/i },
  { id: "BSD-3-Clause", pattern: /BSD 3-Clause/i },
  { id: "BSD-2-Clause", pattern: /BSD 2-Clause/i },
  { id: "ISC", pattern: /ISC License/i },
  { id: "Unlicense", pattern: /This is free and unencumbered software released into the public domain/i },
];

export function detectLicense(content: string): string | null {
  for (const marker of LICENSE_MARKERS) {
    if (marker.pattern.test(content)) return marker.id;
  }
  return null;
}

export function extractManifestFacts(files: { path: string; content: string }[]): ManifestFacts {
  const byPath = new Map(files.map((file) => [file.path, file.content]));
  const rootPackage = byPath.get("package.json");
  const packageJson = rootPackage ? parsePackageJson(rootPackage) : null;

  let packageManager: ManifestFacts["packageManager"] = null;
  if (byPath.has("pnpm-lock.yaml") || byPath.has("pnpm-workspace.yaml")) packageManager = "pnpm";
  else if (byPath.has("yarn.lock")) packageManager = "yarn";
  else if (byPath.has("bun.lockb")) packageManager = "bun";
  else if (byPath.has("package-lock.json")) packageManager = "npm";
  if (packageJson?.packageManager) {
    const declared = packageJson.packageManager.split("@")[0];
    if (declared === "pnpm" || declared === "yarn" || declared === "npm" || declared === "bun") {
      packageManager = declared;
    }
  }

  const pythonManifest =
    ["pyproject.toml", "requirements.txt", "setup.py", "Pipfile"].find((path) => byPath.has(path)) ??
    null;
  const poetryProject = Boolean(byPath.get("pyproject.toml")?.includes("[tool.poetry]"));
  const cargoToml = byPath.get("Cargo.toml");
  const cargoName = cargoToml?.match(/^\s*name\s*=\s*"([^"]+)"/m)?.[1] ?? null;

  const licenses = files.filter((file) => /^(LICENSE|LICENCE|COPYING)(\.(md|txt))?$/i.test(baseName(file.path)));
  let license: ManifestFacts["license"] = { id: null, file: null };
  for (const file of licenses) {
    const detected = detectLicense(file.content);
    if (detected) {
      license = { id: detected, file: file.path };
      break;
    }
    if (!license.file) license = { id: null, file: file.path };
  }

  const envTemplates = files
    .filter((file) => isEnvTemplate(file.path) && !file.path.includes("/"))
    .map((file) => ({ path: file.path, vars: parseEnvVarNames(file.content) }));

  const manifestPaths = files
    .map((file) => file.path)
    .filter((path) => {
      const name = baseName(path).toLowerCase();
      return (
        ["package.json", "pyproject.toml", "requirements.txt", "go.mod", "cargo.toml", "composer.json", "gemfile", "pom.xml", "build.gradle", "dockerfile", "makefile", "pnpm-workspace.yaml", "turbo.json"].includes(name) ||
        path.startsWith(".github/workflows/")
      );
    });

  return {
    files,
    packageJson,
    packageManager,
    hasPython: Boolean(pythonManifest),
    pythonManifest,
    poetryProject,
    hasGoModule: byPath.has("go.mod"),
    hasCargo: Boolean(cargoToml),
    cargoName,
    hasComposer: byPath.has("composer.json"),
    hasGemfile: byPath.has("Gemfile"),
    hasMaven: byPath.has("pom.xml"),
    hasGradle: byPath.has("build.gradle") || byPath.has("build.gradle.kts"),
    docker: [...byPath.keys()].some((path) => /(^|\/)Dockerfile$/i.test(path)),
    compose: [...byPath.keys()].some((path) => /(^|\/)(docker-)?compose\.ya?ml$/i.test(path)),
    ciWorkflows: [...byPath.keys()].filter((path) => path.startsWith(".github/workflows/")),
    envTemplates,
    license,
    monorepo: Boolean(byPath.get("pnpm-workspace.yaml") || byPath.get("turbo.json") || byPath.get("lerna.json") || packageJson?.isWorkspaceRoot),
    manifestPaths,
  };
}

export function buildCommands(facts: ManifestFacts): RepositoryAnalysis["commands"] {
  const commands: RepositoryAnalysis["commands"] = {
    install: null,
    dev: null,
    build: null,
    test: null,
    lint: null,
    scripts: {},
    scriptSource: null,
  };

  if (facts.packageJson) {
    commands.scripts = facts.packageJson.scripts;
    commands.scriptSource = "package.json";
    const pm = facts.packageManager ?? "npm";
    commands.install =
      pm === "npm" ? "npm install" : pm === "bun" ? "bun install" : `${pm} install`;
    const run = (script: string) =>
      pm === "npm" ? `npm run ${script}` : pm === "yarn" ? `yarn ${script}` : pm === "bun" ? `bun run ${script}` : `pnpm ${script}`;
    if (facts.packageJson.scripts.dev) commands.dev = run("dev");
    if (facts.packageJson.scripts.build) commands.build = run("build");
    if (facts.packageJson.scripts.test) commands.test = run("test");
    if (facts.packageJson.scripts.lint) commands.lint = run("lint");
    return commands;
  }

  if (facts.poetryProject) {
    commands.install = "poetry install";
    commands.scriptSource = "pyproject.toml";
    return commands;
  }
  if (facts.hasPython && facts.pythonManifest === "requirements.txt") {
    commands.install = "pip install -r requirements.txt";
    commands.scriptSource = "requirements.txt";
    return commands;
  }
  if (facts.hasGoModule) {
    commands.install = "go mod download";
    commands.build = "go build ./...";
    commands.test = "go test ./...";
    commands.scriptSource = "go.mod";
    return commands;
  }
  if (facts.hasCargo) {
    commands.build = "cargo build";
    commands.test = "cargo test";
    commands.scriptSource = "Cargo.toml";
    return commands;
  }
  if (facts.hasComposer) {
    commands.install = "composer install";
    commands.scriptSource = "composer.json";
    return commands;
  }
  if (facts.hasGemfile) {
    commands.install = "bundle install";
    commands.scriptSource = "Gemfile";
    return commands;
  }
  if (facts.hasMaven) {
    commands.build = "mvn package";
    commands.test = "mvn test";
    commands.scriptSource = "pom.xml";
    return commands;
  }
  if (facts.hasGradle) {
    commands.build = "gradle build";
    commands.test = "gradle test";
    commands.scriptSource = "build.gradle";
  }
  return commands;
}

const FRAMEWORK_SIGNALS: { name: string; deps?: string[]; files?: RegExp[] }[] = [
  { name: "React", deps: ["react"] },
  { name: "Next.js", deps: ["next"] },
  { name: "Vue", deps: ["vue"] },
  { name: "Nuxt", deps: ["nuxt"] },
  { name: "Svelte", deps: ["svelte", "@sveltejs/kit"] },
  { name: "Angular", deps: ["@angular/core"] },
  { name: "Express", deps: ["express"] },
  { name: "Fastify", deps: ["fastify"] },
  { name: "NestJS", deps: ["@nestjs/core"] },
  { name: "Prisma", deps: ["prisma", "@prisma/client"] },
  { name: "Mongoose", deps: ["mongoose"] },
  { name: "Drizzle ORM", deps: ["drizzle-orm"] },
  { name: "Tailwind CSS", deps: ["tailwindcss"] },
  { name: "Vite", deps: ["vite"] },
  { name: "Jest", deps: ["jest"] },
  { name: "Vitest", deps: ["vitest"] },
  { name: "Playwright", deps: ["@playwright/test", "playwright"] },
  { name: "Django", files: [/(^|\/)manage\.py$/] },
  { name: "Flask", files: [/(^|\/)app\.py$/], deps: [] },
  { name: "FastAPI", files: [/(^|\/)main\.py$/] },
  { name: "Docker", files: [/(^|\/)Dockerfile$/i] },
];

export function detectFrameworks(facts: ManifestFacts, allPaths: string[]): string[] {
  const deps = new Set([
    ...(facts.packageJson?.dependencies ?? []),
    ...(facts.packageJson?.devDependencies ?? []),
  ]);
  const detected: string[] = [];
  for (const signal of FRAMEWORK_SIGNALS) {
    const depMatch = signal.deps?.some((dep) => deps.has(dep)) ?? false;
    const fileMatch = signal.files?.some((pattern) => allPaths.some((path) => pattern.test(path))) ?? false;
    if (depMatch || fileMatch) detected.push(signal.name);
  }
  if (facts.hasPython) {
    const pythonFile = facts.files.find((file) => file.path.endsWith(".py"));
    if (pythonFile && /from\s+fastapi|import\s+fastapi/i.test(pythonFile.content) && !detected.includes("FastAPI")) {
      detected.push("FastAPI");
    }
  }
  return [...new Set(detected)];
}

export function detectEntryPoints(files: { path: string }[]): string[] {
  return files
    .map((file) => file.path)
    .filter((path) => isEntryCandidate(path) && !isTestPath(path))
    .slice(0, 10);
}

const ROUTE_PATTERNS: { pattern: RegExp; language: string }[] = [
  { pattern: /\b(?:app|router|server)\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g, language: "js" },
  { pattern: /@(?:app|router|blueprint)\.(get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]/g, language: "python" },
  { pattern: /@(?:app|bp)\.route\(\s*['"]([^'"]+)['"]/g, language: "python" },
  { pattern: /\bpath\(\s*['"]([^'"]+)['"]/g, language: "python" },
];

export interface DetectedRoute {
  method: string;
  path: string;
  source: string;
}

export function detectRoutes(files: { path: string; content: string }[]): DetectedRoute[] {
  const routes: DetectedRoute[] = [];
  const seen = new Set<string>();
  for (const file of files) {
    if (!languageOf(file.path) || !["TypeScript", "JavaScript", "Python"].includes(languageOf(file.path) ?? "")) {
      continue;
    }
    if (file.content.length > 200_000) continue;

    const nextRoute = file.path.match(/^(?:src\/)?app\/(?:api\/)?(.+)\/route\.(ts|js|tsx|jsx)$/);
    if (nextRoute) {
      const routePath = `/${nextRoute[1].replace(/\[([^\]]+)\]/g, ":$1")}`;
      const key = `GET ${routePath}`;
      if (!seen.has(key)) {
        seen.add(key);
        routes.push({ method: "GET", path: routePath, source: file.path });
      }
    }

    for (const { pattern } of ROUTE_PATTERNS) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(file.content)) !== null && routes.length < 60) {
        const method = (match[1] ?? "GET").toUpperCase();
        const routePath = match[2];
        if (!routePath || !routePath.startsWith("/")) continue;
        const key = `${method} ${routePath}`;
        if (seen.has(key)) continue;
        seen.add(key);
        routes.push({ method, path: routePath, source: file.path });
      }
    }
  }
  return routes.slice(0, 60);
}

export function detectCommandsFromScripts(scripts: Record<string, string>): DetectedCommand[] {
  return Object.entries(scripts).map(([name, command]) => ({
    name,
    command,
    source: "package.json",
  }));
}
