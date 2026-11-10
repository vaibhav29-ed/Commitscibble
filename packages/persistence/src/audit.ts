import type { Types } from "mongoose";
import {
  buildActivityEvent,
  redactSecrets,
  type ActivityEvent,
  type ActivityEventType,
} from "@commitscibble/shared";
import { newId } from "@commitscibble/shared/node";
import { AuditLog, type AuditLogShape } from "./models.js";

export interface RecordActivityInput {
  userId: Types.ObjectId | string;
  repositoryId?: Types.ObjectId | string | null;
  repositoryFullName?: string | null;
  runId?: Types.ObjectId | string | null;
  jobId?: string | null;
  type: ActivityEventType;
  message: string;
  progress?: { step: number; total: number } | null;
  metadata?: Record<string, string | number | boolean> | null;
  logId?: string;
  eventId?: string;
}

export async function recordActivity(input: RecordActivityInput): Promise<AuditLogShape> {
  const doc = await AuditLog.create({
    logId: input.logId ?? `log_${newId()}`,
    eventId: input.eventId ?? `evt_${newId()}`,
    jobId: input.jobId ?? null,
    runId: input.runId ?? null,
    userId: input.userId,
    repositoryId: input.repositoryId ?? null,
    repositoryFullName: input.repositoryFullName ?? null,
    type: input.type,
    message: redactSecrets(input.message).slice(0, 500),
    progress: input.progress ?? null,
    metadata: input.metadata ?? null,
    delivery: {
      status: "PENDING",
      attempts: 0,
      lastError: null,
      publishedAt: null,
      nextAttemptAt: new Date(),
      lockUntil: null,
    },
  });
  return doc.toObject();
}

export function auditDocToEvent(doc: AuditLogShape & { _id?: Types.ObjectId }): ActivityEvent {
  return buildActivityEvent({
    eventId: doc.eventId,
    logId: doc.logId,
    jobId: doc.jobId,
    runId: doc.runId ? String(doc.runId) : null,
    userId: String(doc.userId),
    repositoryId: doc.repositoryId ? String(doc.repositoryId) : null,
    repositoryFullName: doc.repositoryFullName,
    type: doc.type,
    message: doc.message,
    progress: doc.progress,
    createdAt: doc.createdAt,
  });
}

export async function listActivity(options: {
  userId: string;
  repositoryId?: string;
  type?: string;
  limit: number;
  page: number;
}): Promise<{ items: AuditLogShape[]; total: number }> {
  const filter: Record<string, unknown> = { userId: options.userId };
  if (options.repositoryId) filter.repositoryId = options.repositoryId;
  if (options.type) filter.type = options.type;
  const [items, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((options.page - 1) * options.limit)
      .limit(options.limit)
      .lean(),
    AuditLog.countDocuments(filter),
  ]);
  return { items: items as AuditLogShape[], total };
}
