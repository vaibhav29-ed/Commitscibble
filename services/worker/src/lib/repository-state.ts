import type { RepositoryAnalysis } from "@commitscibble/shared";
import type { RepositoryDocument } from "@commitscibble/persistence";
import type { GitHubClient } from "@commitscibble/github";
import {
  analyzeRepository,
  buildRepositorySnapshot,
  type RepositorySnapshot,
} from "@commitscibble/documentation-engine";

export interface RepositoryState {
  snapshot: RepositorySnapshot;
  analysis: RepositoryAnalysis;
  readme: { path: string; content: string; sha: string } | null;
}

/**
 * Load a bounded, filtered snapshot at an exact commit. The configured README
 * path is always read even when it lives outside the root directory or would
 * otherwise be filtered out by ignore rules.
 */
export async function loadRepositoryState(
  client: GitHubClient,
  repository: RepositoryDocument,
  ref: string,
): Promise<RepositoryState> {
  const owner = repository.owner;
  const name = repository.name;

  const [tree, gitignoreFile, readmeFile] = await Promise.all([
    client.getTree(owner, name, ref),
    client.getFile(owner, name, ".gitignore", ref).catch(() => null),
    client.getFile(owner, name, repository.settings.readmePath, ref).catch(() => null),
  ]);

  const snapshot = await buildRepositorySnapshot(
    {
      async readFile(path: string): Promise<string | null> {
        const file = await client.getFile(owner, name, path, ref);
        return file ? file.content : null;
      },
    },
    tree.entries,
    {
      readmePath: repository.settings.readmePath,
      ignoredPaths: repository.settings.ignoredPaths,
      gitignore: gitignoreFile?.content ?? null,
      maxFiles: 60,
      maxFileBytes: 200_000,
    },
  );

  if (readmeFile) {
    if (!snapshot.files.some((file) => file.path === readmeFile.path)) {
      snapshot.files.push({ path: readmeFile.path, content: readmeFile.content });
      snapshot.files.sort((a, b) => a.path.localeCompare(b.path));
    }
    snapshot.readme = { path: readmeFile.path, content: readmeFile.content };
  }
  snapshot.ref = ref;

  const analysis = analyzeRepository(snapshot, { fallbackName: repository.name });

  return {
    snapshot,
    analysis,
    readme: readmeFile
      ? { path: readmeFile.path, content: readmeFile.content, sha: readmeFile.sha }
      : null,
  };
}

export function knownPaths(state: RepositoryState): Set<string> {
  const paths = new Set(state.snapshot.inventory.entries.map((entry) => entry.path));
  if (state.readme) paths.add(state.readme.path);
  return paths;
}
