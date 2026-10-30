import { AppError, ERROR_CODES, type ActivityEventType, type AuditLogRecord } from "@commitscibble/shared";
import { AuditLog, DocumentationRun, listActivity, type AuditLogShape } from "@commitscibble/persistence";

function toRecord(doc: AuditLogShape & { _id?: unknown }): AuditLogRecord {
  return {
    id: String(doc._id),
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
    metadata: (doc.metadata as AuditLogRecord["metadata"]) ?? null,
    createdAt: doc.createdAt.toISOString(),
  };
}

/** Maps a run-status filter onto the activity event types that represent it. */
const STATUS_TO_EVENT_TYPES: Record<string, ActivityEventType[]> = {
  QUEUED: ["STARTED"],
  RUNNING: ["STARTED", "PROGRESS"],
  RETRYING: ["RETRYING"],
  SUCCEEDED: ["SUCCESS", "APPLIED", "APPROVAL_REQUIRED"],
  FAILED: ["FAILED"],
  CANCELLED: ["CANCELLED"],
};

export class ActivityService {
  async list(options: {
    userId: string;
    page: number;
    pageSize: number;
    repositoryId?: string;
    type?: ActivityEventType;
    status?: string;
    operation?: string;
  }): Promise<{ items: AuditLogRecord[]; total: number }> {
    const types = options.status ? STATUS_TO_EVENT_TYPES[options.status] : undefined;
    if (options.status && !types) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, `Unknown status filter: ${options.status}`, {
        httpStatus: 422,
      });
    }

    let runIds: unknown[] | undefined;
    if (options.operation) {
      const runs = await DocumentationRun.find({ userId: options.userId, operation: options.operation }).select("_id");
      runIds = runs.map((run) => run._id);
    }

    const baseFilter: Record<string, unknown> = { userId: options.userId };
    if (options.repositoryId) baseFilter.repositoryId = options.repositoryId;
    if (options.type) baseFilter.type = options.type;
    else if (types) baseFilter.type = { $in: types };
    if (runIds) baseFilter.runId = { $in: runIds };

    const skip = (options.page - 1) * options.pageSize;
    const [docs, total] = await Promise.all([
      AuditLog.find(baseFilter).sort({ createdAt: -1 }).skip(skip).limit(options.pageSize).lean(),
      AuditLog.countDocuments(baseFilter),
    ]);

    // Fall back to the generic helper when no post-filtering was required.
    if (
      !options.status &&
      !options.operation &&
      docs.length === 0 &&
      total === 0 &&
      !options.type
    ) {
      const fallback = await listActivity({
        userId: options.userId,
        repositoryId: options.repositoryId,
        limit: options.pageSize,
        page: options.page,
      });
      return { items: fallback.items.map(toRecord), total: fallback.total };
    }

    return { items: docs.map((doc) => toRecord(doc as AuditLogShape)), total };
  }

  async get(userId: string, logId: string): Promise<AuditLogRecord> {
    const doc = await AuditLog.findOne({ logId, userId }).lean();
    if (!doc) throw new AppError(ERROR_CODES.NOT_FOUND, "Activity event not found", { httpStatus: 404 });
    return toRecord(doc as AuditLogShape);
  }

  async forRun(userId: string, runId: string): Promise<AuditLogRecord[]> {
    const docs = await AuditLog.find({ runId, userId }).sort({ createdAt: 1 }).lean();
    return docs.map((doc) => toRecord(doc as AuditLogShape));
  }
}
