import { Schema, model, type HydratedDocument, type Types } from "mongoose";
import {
  DOCUMENTATION_STATUSES,
  OPERATION_TYPES,
  PROPOSAL_STATUSES,
  RUN_STATUSES,
  SECTION_KEYS,
  TRACKING_STATUSES,
  UPDATE_MODES,
  WEBHOOK_PROCESSING_STATUSES,
  ACTIVITY_EVENT_TYPES,
  type RepositoryAnalysis,
  type UsageRecord,
} from "@commitscibble/shared";

export interface UserShape {
  githubId: number;
  githubLogin: string;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  githubTokenEncrypted: string | null;
  githubInstallationId: number | null;
  tokenScopes: string[];
  tokenUpdatedAt: Date | null;
  status: "ACTIVE" | "DISCONNECTED";
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<UserShape>(
  {
    githubId: { type: Number, required: true, unique: true, index: true },
    githubLogin: { type: String, required: true },
    displayName: { type: String, default: null },
    email: { type: String, default: null },
    avatarUrl: { type: String, default: null },
    githubTokenEncrypted: { type: String, default: null, select: false },
    githubInstallationId: { type: Number, default: null },
    tokenScopes: { type: [String], default: [] },
    tokenUpdatedAt: { type: Date, default: null },
    status: { type: String, enum: ["ACTIVE", "DISCONNECTED"], default: "ACTIVE" },
  },
  { timestamps: true, collection: "users" },
);

export const User = model<UserShape>("User", UserSchema);
export type UserDocument = HydratedDocument<UserShape>;

export interface SessionShape {
  tokenHash: string;
  userId: Types.ObjectId;
  expiresAt: Date;
  revokedAt: Date | null;
  lastUsedAt: Date;
  userAgentHash: string | null;
  ipHash: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const SessionSchema = new Schema<SessionShape>(
  {
    tokenHash: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    lastUsedAt: { type: Date, required: true },
    userAgentHash: { type: String, default: null },
    ipHash: { type: String, default: null },
  },
  { timestamps: true, collection: "sessions" },
);

SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
SessionSchema.index({ userId: 1, revokedAt: 1 });

export const Session = model<SessionShape>("Session", SessionSchema);
export type SessionDocument = HydratedDocument<SessionShape>;

export interface RepositorySettingsShape {
  readmePath: string;
  targetBranch: string | null;
  updateMode: (typeof UPDATE_MODES)[number];
  automationEnabled: boolean;
  ignoredPaths: string[];
  maintainedSections: (typeof SECTION_KEYS)[number][];
  commitMessageTemplate: string;
}

export interface RepositoryShape {
  userId: Types.ObjectId;
  githubRepoId: number;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  private: boolean;
  htmlUrl: string;
  description: string | null;
  trackingStatus: (typeof TRACKING_STATUSES)[number];
  githubInstallationId: number | null;
  settings: RepositorySettingsShape;
  lastProcessedCommitSha: string | null;
  lastAppliedCommitSha: string | null;
  lastSuccessfulRunAt: Date | null;
  documentationStatus: (typeof DOCUMENTATION_STATUSES)[number];
  lastAnalysis: RepositoryAnalysis | null;
  disconnectedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const RepositorySettingsSchema = new Schema<RepositorySettingsShape>(
  {
    readmePath: { type: String, required: true, default: "README.md" },
    targetBranch: { type: String, default: null },
    updateMode: { type: String, enum: UPDATE_MODES, default: "REVIEW" },
    automationEnabled: { type: Boolean, default: true },
    ignoredPaths: { type: [String], default: [] },
    maintainedSections: { type: [String], enum: SECTION_KEYS, default: [] },
    commitMessageTemplate: {
      type: String,
      default: "docs: update {readmePath} [commitscibble]",
    },
  },
  { _id: false },
);

const RepositorySchema = new Schema<RepositoryShape>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    githubRepoId: { type: Number, required: true, index: true },
    owner: { type: String, required: true },
    name: { type: String, required: true },
    fullName: { type: String, required: true },
    defaultBranch: { type: String, required: true },
    private: { type: Boolean, required: true },
    htmlUrl: { type: String, required: true },
    description: { type: String, default: null },
    trackingStatus: { type: String, enum: TRACKING_STATUSES, default: "CONNECTED", index: true },
    githubInstallationId: { type: Number, default: null },
    settings: { type: RepositorySettingsSchema, required: true, default: () => ({}) },
    lastProcessedCommitSha: { type: String, default: null },
    lastAppliedCommitSha: { type: String, default: null },
    lastSuccessfulRunAt: { type: Date, default: null },
    documentationStatus: { type: String, enum: DOCUMENTATION_STATUSES, default: "NONE" },
    lastAnalysis: { type: Schema.Types.Mixed, default: null },
    disconnectedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "repositories" },
);

RepositorySchema.index({ userId: 1, githubRepoId: 1 }, { unique: true });
RepositorySchema.index({ trackingStatus: 1, githubRepoId: 1 });
RepositorySchema.index({ userId: 1, createdAt: -1 });

export const Repository = model<RepositoryShape>("Repository", RepositorySchema);
export type RepositoryDocument = HydratedDocument<RepositoryShape>;

export interface DocumentationRunShape {
  userId: Types.ObjectId;
  repositoryId: Types.ObjectId;
  operation: (typeof OPERATION_TYPES)[number];
  status: (typeof RUN_STATUSES)[number];
  baseCommitSha: string | null;
  targetCommitSha: string | null;
  baseReadmeHash: string | null;
  provider: string | null;
  model: string | null;
  attempt: number;
  startedAt: Date | null;
  completedAt: Date | null;
  errorCode: string | null;
  errorMessage: string | null;
  /** Set once when the failure notification is claimed, so it is sent at most once per run. */
  notifiedFailureAt: Date | null;
  proposalId: Types.ObjectId | null;
  appliedCommitSha: string | null;
  correlationId: string;
  jobId: string | null;
  analysis: RepositoryAnalysis | null;
  usage: UsageRecord[];
  warnings: string[];
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

const DocumentationRunSchema = new Schema<DocumentationRunShape>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    repositoryId: { type: Schema.Types.ObjectId, ref: "Repository", required: true, index: true },
    operation: { type: String, enum: OPERATION_TYPES, required: true },
    status: { type: String, enum: RUN_STATUSES, required: true, default: "QUEUED" },
    baseCommitSha: { type: String, default: null },
    targetCommitSha: { type: String, default: null },
    baseReadmeHash: { type: String, default: null },
    provider: { type: String, default: null },
    model: { type: String, default: null },
    attempt: { type: Number, default: 1 },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    errorCode: { type: String, default: null },
    errorMessage: { type: String, default: null },
    notifiedFailureAt: { type: Date, default: null },
    proposalId: { type: Schema.Types.ObjectId, ref: "DocumentationProposal", default: null },
    appliedCommitSha: { type: String, default: null },
    correlationId: { type: String, required: true, index: true },
    jobId: { type: String, default: null },
    analysis: { type: Schema.Types.Mixed, default: null },
    usage: { type: Schema.Types.Mixed, default: [] },
    warnings: { type: [String], default: [] },
    metadata: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true, collection: "documentation_runs" },
);

DocumentationRunSchema.index({ repositoryId: 1, createdAt: -1 });
DocumentationRunSchema.index({ userId: 1, createdAt: -1 });
DocumentationRunSchema.index({ status: 1, updatedAt: 1 });
DocumentationRunSchema.index({ repositoryId: 1, operation: 1, createdAt: -1 });

export const DocumentationRun = model<DocumentationRunShape>(
  "DocumentationRun",
  DocumentationRunSchema,
);
export type DocumentationRunDocument = HydratedDocument<DocumentationRunShape>;

export interface ProposalValidationIssueShape {
  severity: "error" | "warning";
  code: string;
  message: string;
  path?: string;
}

export interface DocumentationProposalShape {
  runId: Types.ObjectId;
  repositoryId: Types.ObjectId;
  userId: Types.ObjectId;
  status: (typeof PROPOSAL_STATUSES)[number];
  summary: string;
  sections: string[];
  warnings: string[];
  explanations: { summary: string; explanation: string }[];
  baseCommitSha: string;
  baseReadmeHash: string;
  originalContent: string;
  proposedContent: string;
  diff: string;
  validationIssues: ProposalValidationIssueShape[];
  additions: number;
  deletions: number;
  provider: string | null;
  model: string | null;
  reviewedAt: Date | null;
  reviewedBy: Types.ObjectId | null;
  appliedCommitSha: string | null;
  appliedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const DocumentationProposalSchema = new Schema<DocumentationProposalShape>(
  {
    runId: { type: Schema.Types.ObjectId, ref: "DocumentationRun", required: true, unique: true },
    repositoryId: { type: Schema.Types.ObjectId, ref: "Repository", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: { type: String, enum: PROPOSAL_STATUSES, default: "PENDING", index: true },
    summary: { type: String, default: "" },
    sections: { type: [String], default: [] },
    warnings: { type: [String], default: [] },
    explanations: { type: Schema.Types.Mixed, default: [] },
    baseCommitSha: { type: String, required: true },
    baseReadmeHash: { type: String, required: true },
    originalContent: { type: String, required: true },
    proposedContent: { type: String, required: true },
    diff: { type: String, required: true },
    validationIssues: { type: Schema.Types.Mixed, default: [] },
    additions: { type: Number, default: 0 },
    deletions: { type: Number, default: 0 },
    provider: { type: String, default: null },
    model: { type: String, default: null },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    appliedCommitSha: { type: String, default: null },
    appliedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "documentation_proposals" },
);

DocumentationProposalSchema.index({ repositoryId: 1, status: 1, createdAt: -1 });

export const DocumentationProposal = model<DocumentationProposalShape>(
  "DocumentationProposal",
  DocumentationProposalSchema,
);
export type DocumentationProposalDocument = HydratedDocument<DocumentationProposalShape>;

export interface SectionMappingShape {
  repositoryId: Types.ObjectId;
  userId: Types.ObjectId;
  sectionKey: string;
  heading: string;
  evidencePaths: string[];
  sourceHashes: Record<string, string>;
  lastVerifiedCommitSha: string | null;
  updatedAt: Date;
  createdAt: Date;
}

const SectionMappingSchema = new Schema<SectionMappingShape>(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: "Repository", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    sectionKey: { type: String, required: true },
    heading: { type: String, required: true },
    evidencePaths: { type: [String], default: [] },
    sourceHashes: { type: Schema.Types.Mixed, default: {} },
    lastVerifiedCommitSha: { type: String, default: null },
  },
  { timestamps: true, collection: "section_mappings" },
);

SectionMappingSchema.index({ repositoryId: 1, sectionKey: 1 }, { unique: true });

export const SectionMapping = model<SectionMappingShape>("SectionMapping", SectionMappingSchema);

export interface AuditLogShape {
  logId: string;
  eventId: string;
  jobId: string | null;
  runId: Types.ObjectId | null;
  userId: Types.ObjectId;
  repositoryId: Types.ObjectId | null;
  repositoryFullName: string | null;
  type: (typeof ACTIVITY_EVENT_TYPES)[number];
  message: string;
  progress: { step: number; total: number } | null;
  metadata: Record<string, unknown> | null;
  delivery: {
    status: "PENDING" | "PUBLISHED" | "SKIPPED" | "FAILED";
    attempts: number;
    lastError: string | null;
    publishedAt: Date | null;
    nextAttemptAt: Date;
    lockUntil: Date | null;
  };
  createdAt: Date;
  updatedAt: Date;
}

const AuditLogSchema = new Schema<AuditLogShape>(
  {
    // Shared by every audit event of a run (the run's correlation id), so it
    // must not be unique. `eventId` is the unique identifier of a single event.
    logId: { type: String, required: true, index: true },
    eventId: { type: String, required: true, unique: true },
    jobId: { type: String, default: null },
    runId: { type: Schema.Types.ObjectId, ref: "DocumentationRun", default: null, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    repositoryId: { type: Schema.Types.ObjectId, ref: "Repository", default: null },
    repositoryFullName: { type: String, default: null },
    type: { type: String, enum: ACTIVITY_EVENT_TYPES, required: true },
    message: { type: String, required: true, maxlength: 500 },
    progress: {
      type: new Schema({ step: Number, total: Number }, { _id: false }),
      default: null,
    },
    metadata: { type: Schema.Types.Mixed, default: null },
    delivery: {
      status: { type: String, enum: ["PENDING", "PUBLISHED", "SKIPPED", "FAILED"], default: "PENDING" },
      attempts: { type: Number, default: 0 },
      lastError: { type: String, default: null },
      publishedAt: { type: Date, default: null },
      nextAttemptAt: { type: Date, default: () => new Date() },
      lockUntil: { type: Date, default: null },
    },
  },
  { timestamps: true, collection: "audit_logs" },
);

AuditLogSchema.index({ userId: 1, createdAt: -1 });
AuditLogSchema.index({ repositoryId: 1, createdAt: -1 });
AuditLogSchema.index({ runId: 1, createdAt: 1 });
AuditLogSchema.index({ "delivery.status": 1, "delivery.nextAttemptAt": 1 });

export const AuditLog = model<AuditLogShape>("AuditLog", AuditLogSchema);
export type AuditLogDocument = HydratedDocument<AuditLogShape>;

export interface WebhookDeliveryShape {
  deliveryId: string;
  event: string;
  repositoryGithubId: number;
  repositoryId: Types.ObjectId | null;
  processingStatus: (typeof WEBHOOK_PROCESSING_STATUSES)[number];
  payloadSummary: {
    ref: string;
    before: string;
    after: string;
    commitCount: number;
    forced: boolean;
    deleted: boolean;
  } | null;
  jobId: string | null;
  runId: Types.ObjectId | null;
  errorCode: string | null;
  receivedAt: Date;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const WebhookDeliverySchema = new Schema<WebhookDeliveryShape>(
  {
    deliveryId: { type: String, required: true, unique: true, index: true },
    event: { type: String, required: true },
    repositoryGithubId: { type: Number, required: true, index: true },
    repositoryId: { type: Schema.Types.ObjectId, ref: "Repository", default: null },
    processingStatus: { type: String, enum: WEBHOOK_PROCESSING_STATUSES, default: "RECEIVED" },
    payloadSummary: { type: Schema.Types.Mixed, default: null },
    jobId: { type: String, default: null },
    runId: { type: Schema.Types.ObjectId, ref: "DocumentationRun", default: null },
    errorCode: { type: String, default: null },
    receivedAt: { type: Date, required: true },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "webhook_deliveries" },
);

WebhookDeliverySchema.index({ repositoryGithubId: 1, receivedAt: -1 });

export const WebhookDelivery = model<WebhookDeliveryShape>(
  "WebhookDelivery",
  WebhookDeliverySchema,
);
export type WebhookDeliveryDocument = HydratedDocument<WebhookDeliveryShape>;

export const ALL_MODELS = [
  User,
  Session,
  Repository,
  DocumentationRun,
  DocumentationProposal,
  SectionMapping,
  AuditLog,
  WebhookDelivery,
];
