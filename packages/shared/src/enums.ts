export const OPERATION_TYPES = [
  "GENERATE",
  "INCREMENTAL_UPDATE",
  "CLEANUP",
  "RESYNC",
  "PROPOSAL_APPLY",
] as const;
export type OperationType = (typeof OPERATION_TYPES)[number];

export const RUN_STATUSES = [
  "QUEUED",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "RETRYING",
  "CANCELLED",
] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const JOB_TRANSITIONS: Record<RunStatus, RunStatus[]> = {
  QUEUED: ["RUNNING", "CANCELLED", "FAILED"],
  RUNNING: ["SUCCEEDED", "FAILED", "RETRYING", "CANCELLED"],
  RETRYING: ["RUNNING", "FAILED", "CANCELLED"],
  SUCCEEDED: [],
  FAILED: ["QUEUED", "CANCELLED"],
  CANCELLED: [],
};

export function canTransition(from: RunStatus, to: RunStatus): boolean {
  return JOB_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: RunStatus, to: RunStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal job state transition: ${from} -> ${to}`);
  }
}

export const TERMINAL_RUN_STATUSES: RunStatus[] = ["SUCCEEDED", "FAILED", "CANCELLED"];

export const ACTIVITY_EVENT_TYPES = [
  "STARTED",
  "PROGRESS",
  "SUCCESS",
  "FAILED",
  "RETRYING",
  "CANCELLED",
  "APPROVAL_REQUIRED",
  "APPLIED",
] as const;
export type ActivityEventType = (typeof ACTIVITY_EVENT_TYPES)[number];

export const UPDATE_MODES = ["AUTOMATIC", "REVIEW"] as const;
export type UpdateMode = (typeof UPDATE_MODES)[number];

export const TRACKING_STATUSES = ["CONNECTED", "PAUSED", "DISCONNECTED"] as const;
export type TrackingStatus = (typeof TRACKING_STATUSES)[number];

export const DOCUMENTATION_STATUSES = ["NONE", "CURRENT", "STALE", "PENDING_REVIEW"] as const;
export type DocumentationStatus = (typeof DOCUMENTATION_STATUSES)[number];

export const PROPOSAL_STATUSES = ["PENDING", "APPROVED", "REJECTED", "APPLIED", "STALE"] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export const AI_PROVIDER_NAMES = ["gemini", "groq", "mock"] as const;
export type AiProviderName = (typeof AI_PROVIDER_NAMES)[number];

export const WEBHOOK_PROCESSING_STATUSES = [
  "RECEIVED",
  "QUEUED",
  "PROCESSED",
  "IGNORED",
  "FAILED",
  "DUPLICATE",
] as const;
export type WebhookProcessingStatus = (typeof WEBHOOK_PROCESSING_STATUSES)[number];

export const OUTBOX_STATUSES = ["PENDING", "PUBLISHED", "SKIPPED", "FAILED"] as const;
export type OutboxStatus = (typeof OUTBOX_STATUSES)[number];

export const QUEUE_NAMES = {
  documentation: "commitscibble.documentation",
  webhooks: "commitscibble.webhooks",
  outbox: "commitscibble.outbox",
} as const;

export const JOB_NAMES = {
  GENERATE: "generate",
  INCREMENTAL_UPDATE: "incremental-update",
  CLEANUP: "cleanup",
  RESYNC: "resync",
  PROPOSAL_APPLY: "proposal-apply",
  WEBHOOK_PUSH: "webhook-push",
  OUTBOX_DELIVER: "outbox-deliver",
} as const;

/** Marker written into commits created by CommitScibble; used for loop prevention. */
export const DOC_COMMIT_MARKER = "[commitscibble]";

/** Standard README section keys used by the documentation engine. */
export const SECTION_KEYS = [
  "overview",
  "features",
  "architecture",
  "tech-stack",
  "prerequisites",
  "installation",
  "configuration",
  "usage",
  "api-reference",
  "testing",
  "deployment",
  "troubleshooting",
  "security",
  "contributing",
  "license",
] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export const SECTION_TITLES: Record<SectionKey, string> = {
  overview: "Overview",
  features: "Features",
  architecture: "Architecture",
  "tech-stack": "Technology Stack",
  prerequisites: "Prerequisites",
  installation: "Installation",
  configuration: "Configuration",
  usage: "Usage",
  "api-reference": "API Reference",
  testing: "Testing",
  deployment: "Deployment",
  troubleshooting: "Troubleshooting",
  security: "Security",
  contributing: "Contributing",
  license: "License",
};

export function isSectionKey(value: string): value is SectionKey {
  return (SECTION_KEYS as readonly string[]).includes(value);
}
