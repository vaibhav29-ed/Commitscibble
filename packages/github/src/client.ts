import { z } from "zod";
import { AppError, ERROR_CODES } from "@commitscibble/shared";

export interface GitHubClientOptions {
  token: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  userAgent?: string;
  maxRetries?: number;
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

export const githubUserSchema = z
  .object({
    id: z.number().int(),
    login: z.string(),
    name: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    avatar_url: z.string().nullable().optional(),
  })
  .passthrough();

export const githubRepositorySchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    full_name: z.string(),
    private: z.boolean(),
    default_branch: z.string(),
    html_url: z.string(),
    description: z.string().nullable().optional(),
    owner: z.object({ login: z.string() }).passthrough(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const githubTreeSchema = z
  .object({
    sha: z.string(),
    truncated: z.boolean().optional().default(false),
    tree: z.array(
      z
        .object({
          path: z.string(),
          mode: z.string().optional(),
          type: z.enum(["blob", "tree", "commit"]),
          sha: z.string(),
          size: z.number().optional(),
        })
        .passthrough(),
    ),
  })
  .passthrough();

export const githubContentSchema = z
  .object({
    type: z.string(),
    name: z.string(),
    path: z.string(),
    sha: z.string(),
    size: z.number(),
    encoding: z.string().optional(),
    content: z.string().optional(),
  })
  .passthrough();

export const githubCompareSchema = z
  .object({
    status: z.string().optional(),
    ahead_by: z.number().optional(),
    behind_by: z.number().optional(),
    total_commits: z.number().optional(),
    files: z
      .array(
        z
          .object({
            filename: z.string(),
            status: z.string(),
            additions: z.number().default(0),
            deletions: z.number().default(0),
            changes: z.number().default(0),
            patch: z.string().optional(),
            previous_filename: z.string().optional(),
          })
          .passthrough(),
      )
      .optional()
      .default([]),
    commits: z
      .array(
        z
          .object({
            sha: z.string(),
            commit: z
              .object({
                message: z.string().default(""),
                author: z
                  .object({ name: z.string().optional(), email: z.string().optional() })
                  .passthrough()
                  .optional(),
              })
              .passthrough(),
          })
          .passthrough(),
      )
      .optional()
      .default([]),
  })
  .passthrough();

export type GitHubUser = z.infer<typeof githubUserSchema>;
export type GitHubRepository = z.infer<typeof githubRepositorySchema>;
export type GitHubTreeEntry = z.infer<typeof githubTreeSchema>["tree"][number];
export type GitHubCompare = z.infer<typeof githubCompareSchema>;

export interface GitHubFile {
  path: string;
  sha: string;
  size: number;
  content: string;
  encoding: "utf8" | "binary";
}

export interface GitHubBranch {
  name: string;
  sha: string;
}

export interface GitHubWriteResult {
  commitSha: string;
  contentSha: string;
  commitUrl: string | null;
}

export class GitHubError extends AppError {
  readonly status: number;
  readonly retryAfterSeconds: number | null;

  constructor(
    code: (typeof ERROR_CODES)[keyof typeof ERROR_CODES],
    status: number,
    message: string,
    options: { retryAfterSeconds?: number | null; retryable?: boolean; cause?: unknown } = {},
  ) {
    super(code, message, {
      httpStatus: status === 429 ? 429 : status === 401 ? 401 : status === 403 ? 403 : 502,
      retryable: options.retryable ?? false,
      cause: options.cause,
    });
    this.name = "GitHubError";
    this.status = status;
    this.retryAfterSeconds = options.retryAfterSeconds ?? null;
  }
}

const MAX_ATTEMPTS = 3;

/**
 * Minimal, dependency-free client for the GitHub REST API used by CommitScibble.
 * All responses that drive documentation output are schema validated so a
 * malformed upstream payload cannot silently become a wrong README claim.
 */
export class GitHubClient {
  private readonly token: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly userAgent: string;
  private readonly maxRetries: number;
  private readonly timeoutMs: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly random: () => number;

  constructor(options: GitHubClientOptions) {
    if (!options.token) throw new Error("GitHubClient requires a token");
    this.token = options.token;
    this.baseUrl = (options.baseUrl ?? "https://api.github.com").replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.userAgent = options.userAgent ?? "CommitScibble/0.1";
    this.maxRetries = options.maxRetries ?? MAX_ATTEMPTS - 1;
    this.timeoutMs = options.timeoutMs ?? 30000;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.random = options.random ?? Math.random;
  }

  private async request<T>(
    path: string,
    init: RequestInit = {},
    validate?: (payload: unknown) => T,
  ): Promise<T> {
    const url = path.startsWith("http") ? path : `${this.baseUrl}${path}`;
    let lastError: unknown = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const headers: Record<string, string> = {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": this.userAgent,
          Authorization: `Bearer ${this.token}`,
        };
        if (init.body) headers["Content-Type"] = "application/json";
        const response = await this.fetchImpl(url, {
          ...init,
          signal: controller.signal,
          headers: { ...headers, ...(init.headers as Record<string, string> | undefined) },
        });

        if (response.status === 204) return undefined as T;
        if (response.status === 304) {
          throw new GitHubError(ERROR_CODES.GITHUB_ERROR, 304, "Unexpected 304 response");
        }

        if (response.status === 401) {
          throw new GitHubError(
            ERROR_CODES.GITHUB_UNAUTHORIZED,
            401,
            "GitHub authorization is no longer valid. Reconnect your GitHub account.",
          );
        }

        const remaining = response.headers.get("x-ratelimit-remaining");
        if (response.status === 429 || (response.status === 403 && remaining === "0")) {
          const retryAfterHeader = response.headers.get("retry-after");
          const resetHeader = response.headers.get("x-ratelimit-reset");
          const retryAfter = retryAfterHeader
            ? Number(retryAfterHeader)
            : resetHeader
              ? Math.max(1, Number(resetHeader) - Math.floor(Date.now() / 1000))
              : 60;
          throw new GitHubError(
            ERROR_CODES.GITHUB_RATE_LIMITED,
            429,
            `GitHub rate limit reached. Retry in about ${retryAfter}s.`,
            { retryAfterSeconds: retryAfter, retryable: true },
          );
        }

        if (response.status === 403) {
          throw new GitHubError(
            ERROR_CODES.GITHUB_FORBIDDEN,
            403,
            "GitHub denied this operation. The token may lack the required repository scope.",
          );
        }
        if (response.status === 404) {
          throw new GitHubError(ERROR_CODES.GITHUB_NOT_FOUND, 404, "GitHub resource not found");
        }
        if (response.status === 409) {
          throw new GitHubError(
            ERROR_CODES.CONFLICT,
            409,
            "GitHub reported a conflict; the file may have changed. Re-fetch and retry.",
          );
        }
        if (response.status === 422) {
          const body = (await response.json().catch(() => null)) as { message?: string } | null;
          throw new GitHubError(
            ERROR_CODES.GITHUB_ERROR,
            422,
            body?.message ?? "GitHub rejected the request",
          );
        }
        if (!response.ok) {
          const retryable = response.status >= 500;
          throw new GitHubError(
            ERROR_CODES.GITHUB_ERROR,
            response.status,
            `GitHub API request failed with status ${response.status}`,
            { retryable },
          );
        }

        const payload: unknown = await response.json();
        return validate ? validate(payload) : (payload as T);
      } catch (error) {
        lastError = error;
        if (error instanceof GitHubError && error.name === "AbortError") {
          // fall through to retry logic below
        }
        const isAbort = error instanceof Error && error.name === "AbortError";
        const retryable =
          isAbort ||
          (error instanceof GitHubError &&
            (error.retryable || error.code === ERROR_CODES.GITHUB_RATE_LIMITED));
        if (!retryable || attempt >= this.maxRetries) break;
        const backoff = Math.min(8000, 400 * 2 ** attempt) * (0.5 + this.random());
        await this.sleep(backoff);
      } finally {
        clearTimeout(timeout);
      }
    }

    if (lastError instanceof GitHubError) throw lastError;
    if (lastError instanceof Error) {
      throw new GitHubError(
        ERROR_CODES.GITHUB_ERROR,
        502,
        `GitHub request failed: ${lastError.name === "AbortError" ? "timeout" : lastError.message}`,
        { retryable: true, cause: lastError },
      );
    }
    throw new GitHubError(ERROR_CODES.GITHUB_ERROR, 502, "GitHub request failed");
  }

  private async paginate<T>(path: string, maxItems: number, validateItem: (payload: unknown) => T): Promise<T[]> {
    const items: T[] = [];
    let next: string | null = `${this.baseUrl}${path}`;
    while (next && items.length < maxItems) {
      const page: { items: T[]; next: string | null } = await this.requestPage(next, validateItem);
      items.push(...page.items);
      next = page.next;
    }
    return items.slice(0, maxItems);
  }

  private async requestPage<T>(
    url: string,
    validateItem: (payload: unknown) => T,
  ): Promise<{ items: T[]; next: string | null }> {
    const response = await this.fetchImpl(url, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": this.userAgent,
        Authorization: `Bearer ${this.token}`,
      },
    });
    if (!response.ok) {
      if (response.status === 401) {
        throw new GitHubError(
          ERROR_CODES.GITHUB_UNAUTHORIZED,
          401,
          "GitHub authorization is no longer valid. Reconnect your GitHub account.",
        );
      }
      throw new GitHubError(
        ERROR_CODES.GITHUB_ERROR,
        response.status,
        `GitHub API request failed with status ${response.status}`,
        { retryable: response.status >= 500 },
      );
    }
    const payload = await response.json();
    if (!Array.isArray(payload)) {
      throw new GitHubError(ERROR_CODES.GITHUB_ERROR, 502, "Expected a paginated array from GitHub");
    }
    const link = response.headers.get("link");
    let next: string | null = null;
    if (link) {
      const match = link.match(/<([^>]+)>;\s*rel="next"/);
      if (match) next = match[1];
    }
    return { items: payload.map(validateItem), next };
  }

  async getAuthenticatedUser(): Promise<GitHubUser> {
    return this.request("/user", {}, (payload) => githubUserSchema.parse(payload));
  }

  async listRepositories(limit = 500): Promise<GitHubRepository[]> {
    return this.paginate(
      "/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member",
      limit,
      (payload) => githubRepositorySchema.parse(payload),
    );
  }

  /** Installation ids the user has granted, used to verify install callbacks. */
  async listUserInstallations(): Promise<number[]> {
    const parsed = await this.request(
      "/user/installations?per_page=100",
      {},
      (payload) =>
        z
          .object({
            installations: z
              .array(z.object({ id: z.number().int() }).passthrough())
              .default([]),
          })
          .passthrough()
          .parse(payload),
    );
    return parsed.installations.map((installation) => installation.id);
  }

  async getRepository(owner: string, repo: string): Promise<GitHubRepository> {
    return this.request(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
      {},
      (payload) => githubRepositorySchema.parse(payload),
    );
  }

  async getBranch(owner: string, repo: string, branch: string): Promise<GitHubBranch> {
    return this.request(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches/${encodeURIComponent(branch)}`,
      {},
      (payload) => {
        const parsed = z
          .object({ name: z.string(), commit: z.object({ sha: z.string() }).passthrough() })
          .passthrough()
          .parse(payload);
        return { name: parsed.name, sha: parsed.commit.sha };
      },
    );
  }

  async getTree(owner: string, repo: string, ref: string): Promise<{ sha: string; truncated: boolean; entries: GitHubTreeEntry[] }> {
    const parsed = await this.request(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(ref)}?recursive=1`,
      {},
      (payload) => githubTreeSchema.parse(payload),
    );
    return { sha: parsed.sha, truncated: parsed.truncated, entries: parsed.tree };
  }

  async getFile(owner: string, repo: string, path: string, ref: string): Promise<GitHubFile | null> {
    try {
      const parsed = await this.request(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`,
        {},
        (payload) => githubContentSchema.parse(payload),
      );
      if (parsed.type !== "file" || typeof parsed.content !== "string") {
        throw new GitHubError(ERROR_CODES.GITHUB_ERROR, 422, `Path ${path} is not a file`);
      }
      const buffer = Buffer.from(parsed.content.replace(/\n/g, ""), (parsed.encoding ?? "base64") as BufferEncoding);
      const isBinary = buffer.includes(0);
      return {
        path: parsed.path,
        sha: parsed.sha,
        size: buffer.byteLength,
        content: isBinary ? "" : buffer.toString("utf8"),
        encoding: isBinary ? "binary" : "utf8",
      };
    } catch (error) {
      if (error instanceof GitHubError && error.code === ERROR_CODES.GITHUB_NOT_FOUND) return null;
      throw error;
    }
  }

  async compareCommits(
    owner: string,
    repo: string,
    baseSha: string,
    headSha: string,
  ): Promise<GitHubCompare> {
    return this.request(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/compare/${baseSha}...${headSha}`,
      {},
      (payload) => githubCompareSchema.parse(payload),
    );
  }

  async getCommit(owner: string, repo: string, sha: string): Promise<{ sha: string; message: string }> {
    return this.request(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${sha}`,
      {},
      (payload) => {
        const parsed = z
          .object({ sha: z.string(), commit: z.object({ message: z.string() }).passthrough() })
          .passthrough()
          .parse(payload);
        return { sha: parsed.sha, message: parsed.commit.message };
      },
    );
  }

  async createOrUpdateFile(input: {
    owner: string;
    repo: string;
    path: string;
    branch: string;
    message: string;
    content: string;
    sha?: string | null;
  }): Promise<GitHubWriteResult> {
    const body: Record<string, unknown> = {
      message: input.message,
      content: Buffer.from(input.content, "utf8").toString("base64"),
      branch: input.branch,
    };
    if (input.sha) body.sha = input.sha;

    return this.request(
      `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/contents/${encodePath(input.path)}`,
      { method: "PUT", body: JSON.stringify(body) },
      (payload) => {
        const parsed = z
          .object({
            content: z.object({ sha: z.string() }).passthrough().nullable().optional(),
            commit: z
              .object({ sha: z.string(), html_url: z.string().optional() })
              .passthrough(),
          })
          .passthrough()
          .parse(payload);
        return {
          commitSha: parsed.commit.sha,
          contentSha: parsed.content?.sha ?? "",
          commitUrl: parsed.commit.html_url ?? null,
        };
      },
    );
  }
}

function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

/** Revoke an OAuth app token (used when a user disconnects the integration). */
export async function revokeGitHubOAuthToken(options: {
  clientId: string;
  clientSecret: string;
  token: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}): Promise<boolean> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const baseUrl = options.baseUrl ?? "https://api.github.com";
  const credentials = Buffer.from(`${options.clientId}:${options.clientSecret}`).toString("base64");
  const response = await fetchImpl(`${baseUrl}/applications/${encodeURIComponent(options.clientId)}/token`, {
    method: "DELETE",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Basic ${credentials}`,
      "User-Agent": "CommitScibble/0.1",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ access_token: options.token }),
  });
  if (response.status === 204) return true;
  if (response.status === 404) return false;
  throw new GitHubError(
    ERROR_CODES.GITHUB_ERROR,
    response.status,
    "Failed to revoke GitHub authorization",
  );
}
