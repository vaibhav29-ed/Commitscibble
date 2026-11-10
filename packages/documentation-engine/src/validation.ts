import {
  findDuplicateHeadings,
  findHeadingLevelJumps,
  findSecretsInText,
  extractRelativeLinks,
  parseHeadings,
  splitSections,
  type RepositoryAnalysis,
} from "@commitscibble/shared";

export type ValidationSeverity = "error" | "warning";

export interface ValidationIssue {
  severity: ValidationSeverity;
  code: string;
  message: string;
  path?: string;
}

export interface ValidationResult {
  issues: ValidationIssue[];
  hasBlockingErrors: boolean;
}

export interface ValidateReadmeOptions {
  analysis: RepositoryAnalysis;
  knownPaths: Set<string>;
  inventoryTruncated?: boolean;
  readmePath?: string;
}

const RESERVED_PACKAGE_COMMANDS = new Set([
  "install",
  "i",
  "ci",
  "add",
  "remove",
  "rm",
  "uninstall",
  "exec",
  "dlx",
  "init",
  "create",
  "publish",
  "link",
  "audit",
  "outdated",
  "update",
  "upgrade",
  "why",
  "config",
  "store",
  "prune",
  "approve-builds",
  "list",
  "ls",
  "help",
  "version",
]);

const IGNORED_ENV_TOKENS = new Set([
  "API",
  "URL",
  "URI",
  "HTTP",
  "HTTPS",
  "JSON",
  "YAML",
  "SQL",
  "README",
  "CLI",
  "SDK",
  "ID",
  "IDS",
  "REST",
  "JWT",
  "OS",
  "CI",
  "CD",
  "AWS",
  "GCP",
  "CPU",
  "RAM",
  "MIT",
  "ISC",
  "PDF",
  "HTML",
  "CSS",
  "JS",
  "TS",
  "UI",
  "UX",
  "API_KEY",
  "TODO",
  "NOTE",
  "IMPORTANT",
]);

const PLACEHOLDER_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /your[-_ ]?(org|organization|username|user|repo|project|deployment|domain)\b/i, label: "placeholder text" },
  { pattern: /<your[-_ ]?[a-z ]+>/i, label: "unreplaced placeholder" },
  { pattern: /\blorem ipsum\b/i, label: "lorem ipsum filler" },
  { pattern: /\bTODO:\s/i, label: "TODO marker" },
  { pattern: /\bexample\.com\b/i, label: "example.com URL" },
];

export function extractFencedBlocks(markdown: string): { language: string; lines: string[] }[] {
  const blocks: { language: string; lines: string[] }[] = [];
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let current: { language: string; lines: string[] } | null = null;
  let fenceChar = "";
  let fenceLength = 0;

  for (const line of lines) {
    const fence = line.match(/^\s*(`{3,}|~{3,})\s*([\w+-]*)\s*$/);
    if (fence) {
      if (!current) {
        current = { language: fence[2] ?? "", lines: [] };
        fenceChar = fence[1][0];
        fenceLength = fence[1].length;
      } else if (fence[1][0] === fenceChar && fence[1].length >= fenceLength) {
        blocks.push(current);
        current = null;
      }
      continue;
    }
    if (current) current.lines.push(line);
  }
  if (current) blocks.push(current);
  return blocks;
}

export function validateReadme(markdown: string, options: ValidateReadmeOptions): ValidationResult {
  const issues: ValidationIssue[] = [];
  const { analysis } = options;

  if (markdown.trim().length < 100) {
    issues.push({
      severity: "error",
      code: "empty_readme",
      message: "Generated README is too short to be useful.",
    });
  }

  const headings = parseHeadings(markdown);
  if (!headings.some((heading) => heading.level === 1)) {
    issues.push({
      severity: "warning",
      code: "missing_title",
      message: "README has no level-1 title heading.",
    });
  }

  const duplicates = findDuplicateHeadings(markdown);
  if (duplicates.length > 0) {
    issues.push({
      severity: "error",
      code: "duplicate_heading",
      message: `Duplicate section headings: ${duplicates.join(", ")}`,
    });
  }

  const jumps = findHeadingLevelJumps(markdown);
  for (const jump of jumps.slice(0, 5)) {
    issues.push({
      severity: "warning",
      code: "heading_jump",
      message: `Heading level jumps from "${jump.from}" to "${jump.to}".`,
    });
  }

  const secrets = findSecretsInText(markdown);
  if (secrets.length > 0) {
    issues.push({
      severity: "error",
      code: "secret_leak",
      message: "Generated README contains a value that looks like a credential.",
    });
  }

  for (const { pattern, label } of PLACEHOLDER_PATTERNS) {
    if (pattern.test(markdown)) {
      issues.push({
        severity: "error",
        code: "placeholder_content",
        message: `Generated README contains ${label}.`,
      });
    }
  }

  const scriptNames = new Set(Object.keys(analysis.commands.scripts));
  const commands = extractCommands(markdown);
  for (const command of commands) {
    const runMatch = command.match(/^(npm|pnpm|yarn|bun)\s+(?:run\s+)?([\w:-]+)/);
    if (runMatch) {
      const script = runMatch[2];
      if (!RESERVED_PACKAGE_COMMANDS.has(script) && analysis.commands.scriptSource === "package.json" && !scriptNames.has(script)) {
        issues.push({
          severity: "error",
          code: "unknown_script",
          message: `Documented command "${command}" references a script that does not exist in package.json.`,
        });
      }
    }
    const pipMatch = command.match(/^pip3?\s+install\s+-r\s+(\S+)/);
    if (pipMatch && !options.knownPaths.has(pipMatch[1])) {
      issues.push({
        severity: "warning",
        code: "unknown_requirements_file",
        message: `Documented requirements file "${pipMatch[1]}" was not found in the repository inventory.`,
        path: pipMatch[1],
      });
    }
  }

  const knownEnvVars = new Set(analysis.envVars);
  if (analysis.envVars.length > 0) {
    const configSection = splitSections(markdown).sections.find((section) =>
      /config|environment/i.test(section.heading),
    );
    if (configSection) {
      for (const token of new Set(configSection.body.match(/\b[A-Z][A-Z0-9_]{2,}\b/g) ?? [])) {
        if (IGNORED_ENV_TOKENS.has(token)) continue;
        if (!knownEnvVars.has(token)) {
          issues.push({
            severity: "warning",
            code: "unknown_env_var",
            message: `Configuration mentions "${token}", which is not present in the repository's environment template.`,
          });
        }
      }
    }
  }

  for (const link of extractRelativeLinks(markdown)) {
    if (link.href === options.readmePath) continue;
    if (options.knownPaths.has(link.href)) continue;
    const isPathLike = /\.[a-z0-9]+$/i.test(link.href) || link.href.includes("/");
    if (!isPathLike) continue;
    issues.push({
      severity: options.inventoryTruncated ? "warning" : "error",
      code: "broken_relative_link",
      message: `README links to "${link.href}", which was not found in the repository inventory.`,
      path: link.href,
    });
  }

  return {
    issues,
    hasBlockingErrors: issues.some((issue) => issue.severity === "error"),
  };
}

export function extractCommands(markdown: string): string[] {
  const commands: string[] = [];
  for (const block of extractFencedBlocks(markdown)) {
    for (const line of block.lines) {
      const trimmed = line.replace(/^\$\s*/, "").trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      if (/^(npm|pnpm|yarn|bun|pip3?|poetry|go|cargo|composer|bundle|mvn|gradle|docker|make|uv)\b/.test(trimmed)) {
        commands.push(trimmed);
      }
    }
  }
  return [...new Set(commands)];
}

export interface CleanupGuardResult {
  blockers: ValidationIssue[];
  warnings: ValidationIssue[];
  changed: boolean;
}

export function guardCleanup(
  original: string,
  cleaned: string,
  analysis: RepositoryAnalysis,
): CleanupGuardResult {
  const blockers: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const originalCommands = extractCommands(original);
  const cleanedCommands = new Set(extractCommands(cleaned).map(normalizeCommand));
  for (const command of originalCommands) {
    if (!cleanedCommands.has(normalizeCommand(command))) {
      blockers.push({
        severity: "error",
        code: "cleanup_dropped_command",
        message: `Cleanup removed a documented command: ${command}`,
      });
    }
  }

  for (const variable of analysis.envVars) {
    if (original.includes(variable) && !cleaned.includes(variable)) {
      blockers.push({
        severity: "error",
        code: "cleanup_dropped_env_var",
        message: `Cleanup removed documented environment variable ${variable}.`,
      });
    }
  }

  if (/\blicen[cs]e\b/i.test(original) && !/\blicen[cs]e\b/i.test(cleaned)) {
    blockers.push({
      severity: "error",
      code: "cleanup_dropped_license",
      message: "Cleanup removed license information.",
    });
  }

  const originalUrls = new Set(original.match(/https?:\/\/[^\s)>\]]+/g) ?? []);
  for (const url of originalUrls) {
    if (!cleaned.includes(url)) {
      warnings.push({
        severity: "warning",
        code: "cleanup_dropped_url",
        message: `Cleanup removed URL ${url}. Confirm this was intentional.`,
      });
    }
  }

  if (cleaned.length < original.length * 0.4) {
    blockers.push({
      severity: "error",
      code: "cleanup_too_destructive",
      message: "Cleanup removed more than 60% of the README content.",
    });
  }

  const secrets = findSecretsInText(cleaned);
  if (secrets.length > 0) {
    blockers.push({
      severity: "error",
      code: "secret_leak",
      message: "Cleaned README contains a value that looks like a credential.",
    });
  }

  if (/\bTODO:\s/i.test(cleaned) && !/\bTODO:\s/i.test(original)) {
    blockers.push({
      severity: "warning",
      code: "placeholder_content",
      message: "Cleaned README introduced a TODO marker.",
    });
  }

  return {
    blockers,
    warnings,
    changed: normalizeCommand(original) !== normalizeCommand(cleaned),
  };
}

function normalizeCommand(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
