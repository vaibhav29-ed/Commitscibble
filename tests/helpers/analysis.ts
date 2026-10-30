import type { RepositoryAnalysis } from "@commitscibble/shared";

export function makeAnalysis(overrides: Partial<RepositoryAnalysis> = {}): RepositoryAnalysis {
  const base: RepositoryAnalysis = {
    projectName: "widget-service",
    description: "A widget service",
    languages: [{ name: "TypeScript", fileCount: 12 }],
    frameworks: ["Express"],
    packageManagers: ["pnpm"],
    monorepo: false,
    manifests: ["package.json"],
    commands: {
      install: "pnpm install",
      dev: "pnpm dev",
      build: "pnpm build",
      test: "pnpm test",
      lint: "pnpm lint",
      scripts: { dev: "tsx watch src/index.ts", build: "tsc", test: "vitest run", lint: "eslint ." },
      scriptSource: "package.json",
    },
    envVars: ["PORT", "DATABASE_URL"],
    entryPoints: ["src/index.ts"],
    topLevelDirectories: [
      { path: "src", files: 12 },
      { path: ".github", files: 1 },
    ],
    routes: [{ method: "GET", path: "/health", source: "src/index.ts" }],
    docker: false,
    ci: [],
    license: "MIT",
    hasTests: true,
    hasReadme: true,
    unsupported: [],
    evidence: [
      { path: "package.json", reason: "manifest / project configuration" },
      { path: ".env.example", reason: "environment variable names (values are never read)" },
      { path: "LICENSE", reason: "license: MIT" },
    ],
    filesConsidered: 20,
    filesIncluded: 15,
    analyzedAt: new Date(0).toISOString(),
  };
  return { ...base, ...overrides };
}

export const VALID_README = `# Widget Service

A widget service that exposes health and user endpoints.

## Installation

\`\`\`bash
pnpm install
\`\`\`

## Configuration

| Variable | Description |
| --- | --- |
| \`PORT\` | HTTP port |
| \`DATABASE_URL\` | Database connection |

## API Reference

- \`GET /health\` — liveness probe

## License

MIT
`;
