import type {
  ActivityEventType,
  AiProviderName,
  DocumentationStatus,
  OperationType,
  ProposalStatus,
  RunStatus,
  SectionKey,
  TrackingStatus,
  UpdateMode,
} from "./enums.js";

export interface EvidenceRef {
  path: string;
  startLine?: number;
  endLine?: number;
  reason: string;
}

export interface DetectedCommand {
  name: string;
  command: string;
  source: string;
}

export interface RepositoryAnalysis {
  projectName: string;
  description: string | null;
  languages: { name: string; fileCount: number }[];
  frameworks: string[];
  packageManagers: string[];
  monorepo: boolean;
  manifests: string[];
  commands: {
    install: string | null;
    dev: string | null;
    build: string | null;
    test: string | null;
    lint: string | null;
    scripts: Record<string, string>;
    /** Raw script commands as declared in manifests, used to validate generated docs. */
    scriptSource: string | null;
  };
  envVars: string[];
  entryPoints: string[];
  topLevelDirectories: { path: string; files: number }[];
  routes: { method: string; path: string; source: string }[];
  docker: boolean;
  ci: string[];
  license: string | null;
  hasTests: boolean;
  hasReadme: boolean;
  unsupported: string[];
  evidence: EvidenceRef[];
  filesConsidered: number;
  filesIncluded: number;
  analyzedAt: string;
}

export interface RepoSettings {
  readmePath: string;
  targetBranch: string | null;
  updateMode: UpdateMode;
  automationEnabled: boolean;
  ignoredPaths: string[];
  maintainedSections: SectionKey[];
  commitMessageTemplate: string;
}

export interface RepositoryRecord {
  id: string;
  githubRepoId: number;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  private: boolean;
  htmlUrl: string;
  description: string | null;
  trackingStatus: TrackingStatus;
  settings: RepoSettings;
  lastProcessedCommitSha: string | null;
  lastSuccessfulRunAt: string | null;
  documentationStatus: DocumentationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AvailableRepository {
  githubRepoId: number;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  private: boolean;
  htmlUrl: string;
  description: string | null;
  connectedRepositoryId: string | null;
}

export interface RunSummary {
  id: string;
  repositoryId: string;
  operation: OperationType;
  status: RunStatus;
  baseCommitSha: string | null;
  targetCommitSha: string | null;
  provider: AiProviderName | null;
  model: string | null;
  startedAt: string | null;
  completedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  proposalId: string | null;
  appliedCommitSha: string | null;
  correlationId: string;
  attempt: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProposalSummary {
  id: string;
  runId: string;
  repositoryId: string;
  summary: string;
  sections: string[];
  warnings: string[];
  validationIssues: { severity: "error" | "warning"; message: string; path?: string }[];
  status: ProposalStatus;
  baseCommitSha: string;
  baseReadmeHash: string;
  additions: number;
  deletions: number;
  createdAt: string;
  reviewedAt: string | null;
}

export interface ActivityEvent {
  eventId: string;
  logId: string;
  jobId: string | null;
  runId: string | null;
  userId: string;
  repositoryId: string | null;
  repositoryFullName: string | null;
  type: ActivityEventType;
  message: string;
  progress: { step: number; total: number } | null;
  createdAt: string;
}

export interface AuditLogRecord extends ActivityEvent {
  id: string;
  metadata: Record<string, string | number | boolean> | null;
}

export interface SessionUser {
  id: string;
  githubLogin: string;
  githubId: number;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export interface ApiEnvelope<T> {
  data: T;
  requestId: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  requestId: string;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export interface UsageRecord {
  provider: AiProviderName;
  model: string;
  operation: string;
  attempt: number;
  latencyMs: number;
  promptChars: number;
  completionChars: number;
  outcome: "SUCCESS" | "FAILED" | "RETRYABLE_FAILURE" | "FALLBACK";
  errorCode: string | null;
  /** HTTP status returned by the provider, when it responded. */
  status?: number | null;
  /** Redacted provider message for failed attempts; safe to persist and log. */
  providerMessage?: string | null;
}
