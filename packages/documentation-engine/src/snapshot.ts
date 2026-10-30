import { buildInventory, type Inventory } from "./inventory.js";

export interface SnapshotTreeEntry {
  path: string;
  type?: "blob" | "tree" | "commit";
  size?: number;
}

export interface SnapshotSource {
  readFile(path: string): Promise<string | null>;
}

export interface RepositorySnapshot {
  ref: string;
  inventory: Inventory;
  files: { path: string; content: string }[];
  readme: { path: string; content: string } | null;
  readmeCandidates: string[];
  truncated: boolean;
  readErrors: string[];
}

export interface SnapshotOptions {
  readmePath: string;
  ignoredPaths?: string[];
  gitignore?: string | null;
  maxFiles?: number;
  maxFileBytes?: number;
  concurrency?: number;
}

function isReadme(path: string): boolean {
  return /(^|\/)readme(\.(md|markdown|mdx))?$/i.test(path);
}

/**
 * Deterministically select and read repository files for analysis. Read failures
 * are surfaced instead of silently shrinking the evidence set.
 */
export async function buildRepositorySnapshot(
  source: SnapshotSource,
  entries: SnapshotTreeEntry[],
  options: SnapshotOptions,
): Promise<RepositorySnapshot> {
  const inventory = buildInventory(
    entries.map((entry) => ({
      path: entry.path,
      size: entry.size ?? 0,
      type: entry.type ?? "blob",
    })),
    {
      ignoredPaths: options.ignoredPaths ?? [],
      gitignore: options.gitignore ?? null,
      maxFiles: options.maxFiles ?? 60,
      maxFileBytes: options.maxFileBytes ?? 200_000,
    },
  );

  const normalizedReadmePath = options.readmePath.replace(/^\.\//, "");
  const readmeCandidates = entries
    .map((entry) => entry.path)
    .filter((path) => isReadme(path) && !path.includes("/"))
    .sort((a, b) => {
      if (a.toLowerCase() === normalizedReadmePath.toLowerCase()) return -1;
      if (b.toLowerCase() === normalizedReadmePath.toLowerCase()) return 1;
      return a.localeCompare(b);
    });

  const toRead = [...inventory.selected];
  if (readmeCandidates[0] && !toRead.some((entry) => entry.path === readmeCandidates[0])) {
    const readmeEntry = inventory.entries.find((entry) => entry.path === readmeCandidates[0]);
    if (readmeEntry) toRead.push({ ...readmeEntry, includeInContext: true });
  }

  const concurrency = Math.max(1, options.concurrency ?? 6);
  const files: { path: string; content: string }[] = [];
  const readErrors: string[] = [];
  let cursor = 0;

  const workers = Array.from({ length: Math.min(concurrency, toRead.length) }, async () => {
    while (cursor < toRead.length) {
      const index = cursor;
      cursor += 1;
      const entry = toRead[index];
      try {
        const content = await source.readFile(entry.path);
        if (content === null) {
          readErrors.push(`${entry.path}: file not available at this revision`);
          continue;
        }
        files.push({ path: entry.path, content });
      } catch (error) {
        readErrors.push(`${entry.path}: ${error instanceof Error ? error.message : "read failed"}`);
      }
    }
  });
  await Promise.all(workers);

  files.sort((a, b) => a.path.localeCompare(b.path));
  const readmeFile = files.find((file) => file.path === readmeCandidates[0]) ?? null;

  return {
    ref: "",
    inventory,
    files,
    readme: readmeFile,
    readmeCandidates,
    truncated: inventory.truncated,
    readErrors,
  };
}

/** In-memory source used by tests and local fixtures. */
export function createMemorySource(files: Record<string, string>): SnapshotSource {
  return {
    async readFile(path: string): Promise<string | null> {
      return Object.prototype.hasOwnProperty.call(files, path) ? files[path] : null;
    },
  };
}

export function snapshotEntriesFromFiles(files: Record<string, string>): SnapshotTreeEntry[] {
  return Object.entries(files).map(([path, content]) => ({
    path,
    type: "blob" as const,
    size: Buffer.byteLength(content, "utf8"),
  }));
}
