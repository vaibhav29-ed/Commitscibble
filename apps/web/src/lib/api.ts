import type {
  ActivityEvent,
  AvailableRepository,
  Paginated,
  ProposalSummary,
  RepoSettings,
  RepositoryRecord,
  RunSummary,
  SessionUser,
  UsageRecord,
} from "@commitscibble/shared";

const configuredApiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "");

/**
 * Only a browser actually running on localhost talks to the local API. This is a
 * runtime hostname check rather than `import.meta.env.DEV`: if a host injects
 * `NODE_ENV=development` into a production build, Vite sets DEV=true and the old
 * check baked `http://localhost:4000` into the deployed app.
 *
 * A configured localhost URL is ignored on a real host too, so a stray
 * `VITE_API_URL=http://localhost:4000` in the hosting dashboard cannot break the
 * deployed site. Everywhere else an empty string means same-origin requests,
 * which is what the Vercel proxy setup in docs/deployment.md expects.
 */
const localHostnames = new Set(["localhost", "127.0.0.1", "[::1]"]);
const localUrlPattern = /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i;
const isLocalHost =
  typeof window !== "undefined" && localHostnames.has(window.location.hostname);
const configuredIsLocal = Boolean(configuredApiUrl && localUrlPattern.test(configuredApiUrl));

export const API_URL =
  configuredApiUrl && !(configuredIsLocal && !isLocalHost)
    ? configuredApiUrl
    : isLocalHost
      ? "http://localhost:4000"
      : "";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface MeResponse {
  user: SessionUser;
  realtimeKey: string | null;
}

export interface ConnectedRepositoryView extends RepositoryRecord {
  pendingProposalId: string | null;
  pendingProposalRunId: string | null;
  lastRun: RunSummary | null;
  readmeUrl: string;
}

export interface RepositoryListResponse {
  available: AvailableRepository[];
  connected: ConnectedRepositoryView[];
  githubError: string | null;
}

export interface RepositoryDetailResponse {
  repository: ConnectedRepositoryView;
  runs: RunSummary[];
  pendingProposal: ProposalSummary | null;
}

export interface ActivityRecord extends ActivityEvent {
  id: string;
  metadata: Record<string, string | number | boolean> | null;
}

export interface ProposalDetail extends ProposalSummary {
  originalContent: string;
  proposedContent: string;
  diff: string;
  explanations: { summary: string; explanation: string }[];
  provider: string | null;
  model: string | null;
  appliedCommitSha: string | null;
}

export interface RunDetailResponse {
  run: RunSummary;
  repositoryFullName: string | null;
  proposal: ProposalSummary | null;
  usage: UsageRecord[];
  warnings: string[];
  analysisUnsupported: string[];
  events: ActivityRecord[];
}

export interface MetaResponse {
  readmeFileName: string;
  defaultUpdateMode: "AUTOMATIC" | "REVIEW";
  aiProviders: string[];
  realtime: { convex: boolean };
  githubApp: { configured: boolean; slug: string | null; installUrl: string | null };
  billingEnabled: boolean;
  retention: { auditDays: number; webhookDays: number };
}

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const token = readCookie("cs_csrf");
    if (token) headers["X-CSRF-Token"] = token;
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      credentials: "include",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      "The CommitScibble API is unreachable. Check that the API service is running.",
    );
  }

  if (response.status === 204) return undefined as T;
  const payload = (await response.json().catch(() => null)) as
    | { data?: T; error?: { code: string; message: string; details?: unknown }; requestId?: string }
    | null;

  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.error?.code ?? "REQUEST_FAILED",
      payload?.error?.message ?? `Request failed with status ${response.status}`,
      payload?.error?.details,
      payload?.requestId,
    );
  }

  return payload?.data as T;
}

export const api = {
  me: () => request<MeResponse>("/api/v1/auth/me"),
  meta: () => request<MetaResponse>("/api/v1/meta"),
  logout: () => request<void>("/api/v1/auth/logout", { method: "POST" }),
  revokeGithubAuthorization: () =>
    request<{ revoked: boolean }>("/api/v1/auth/github/revoke", { method: "POST" }),

  listRepositories: () => request<RepositoryListResponse>("/api/v1/repositories"),
  connectRepository: (githubRepoId: number, body: { readmePath?: string } = {}) =>
    request<{ repository: ConnectedRepositoryView }>(
      `/api/v1/repositories/${githubRepoId}/connect`,
      { method: "POST", body },
    ),
  getRepository: (id: string) =>
    request<RepositoryDetailResponse>(`/api/v1/repositories/${id}`),
  updateRepositorySettings: (id: string, patch: Partial<RepoSettings>) =>
    request<{ repository: RepositoryRecord }>(`/api/v1/repositories/${id}/settings`, {
      method: "PATCH",
      body: patch,
    }),
  setTracking: (id: string, status: "CONNECTED" | "PAUSED") =>
    request<{ repository: RepositoryRecord }>(`/api/v1/repositories/${id}/tracking`, {
      method: "POST",
      body: { status },
    }),
  disconnectRepository: (id: string, revokeAuthorization = false) =>
    request<{ repository: RepositoryRecord; authorizationRevoked: boolean }>(
      `/api/v1/repositories/${id}/disconnect`,
      { method: "POST", body: { revokeAuthorization } },
    ),
  listRuns: (id: string, page = 1, pageSize = 20) =>
    request<Paginated<RunSummary>>(`/api/v1/repositories/${id}/runs?page=${page}&pageSize=${pageSize}`),

  generate: (id: string) =>
    request<{ run: RunSummary }>(`/api/v1/repositories/${id}/generate`, { method: "POST" }),
  update: (id: string) =>
    request<{ run: RunSummary }>(`/api/v1/repositories/${id}/update`, { method: "POST" }),
  cleanup: (id: string) =>
    request<{ run: RunSummary }>(`/api/v1/repositories/${id}/cleanup`, { method: "POST" }),

  getRun: (runId: string) => request<RunDetailResponse>(`/api/v1/runs/${runId}`),
  getProposal: (runId: string) =>
    request<{ proposal: ProposalDetail }>(`/api/v1/runs/${runId}/proposal`),
  retryRun: (runId: string) =>
    request<{ run: RunSummary }>(`/api/v1/runs/${runId}/retry`, { method: "POST" }),
  cancelRun: (runId: string) =>
    request<{ run: RunSummary }>(`/api/v1/runs/${runId}/cancel`, { method: "POST" }),
  approveProposal: (proposalId: string) =>
    request<{ run: RunSummary }>(`/api/v1/proposals/${proposalId}/approve`, { method: "POST" }),
  rejectProposal: (proposalId: string) =>
    request<{ proposal: ProposalSummary }>(`/api/v1/proposals/${proposalId}/reject`, {
      method: "POST",
    }),

  listActivity: (params: {
    page?: number;
    pageSize?: number;
    repositoryId?: string;
    status?: string;
    operation?: string;
  }) => {
    const search = new URLSearchParams();
    search.set("page", String(params.page ?? 1));
    search.set("pageSize", String(params.pageSize ?? 20));
    if (params.repositoryId) search.set("repositoryId", params.repositoryId);
    if (params.status && params.status !== "ALL") search.set("status", params.status);
    if (params.operation) search.set("operation", params.operation);
    return request<Paginated<ActivityRecord>>(`/api/v1/activity?${search.toString()}`);
  },
  getActivity: (logId: string) =>
    request<{ event: ActivityRecord }>(`/api/v1/activity/${encodeURIComponent(logId)}`),
};
