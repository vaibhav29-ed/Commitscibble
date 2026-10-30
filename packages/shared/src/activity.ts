import { z } from "zod";
import type { ActivityEvent } from "./types.js";
import { ACTIVITY_EVENT_TYPES, type ActivityEventType } from "./enums.js";

export const activityEventSchema = z.object({
  eventId: z.string().min(1).max(80),
  logId: z.string().min(1).max(80),
  jobId: z.string().max(120).nullable(),
  runId: z.string().max(80).nullable(),
  userId: z.string().min(1).max(80),
  repositoryId: z.string().max(80).nullable(),
  repositoryFullName: z.string().max(200).nullable(),
  type: z.enum(ACTIVITY_EVENT_TYPES),
  message: z.string().min(1).max(500),
  progress: z.object({ step: z.number().int().min(0), total: z.number().int().min(1) }).nullable(),
  createdAt: z.string(),
});

export interface BuildActivityEventInput {
  eventId: string;
  logId: string;
  jobId?: string | null;
  runId?: string | null;
  userId: string;
  repositoryId?: string | null;
  repositoryFullName?: string | null;
  type: ActivityEventType;
  message: string;
  progress?: { step: number; total: number } | null;
  createdAt?: Date | string;
}

/** Build a size-bounded, display-safe activity event. */
export function buildActivityEvent(input: BuildActivityEventInput): ActivityEvent {
  return {
    eventId: input.eventId,
    logId: input.logId,
    jobId: input.jobId ?? null,
    runId: input.runId ?? null,
    userId: input.userId,
    repositoryId: input.repositoryId ?? null,
    repositoryFullName: input.repositoryFullName ?? null,
    type: input.type,
    message: input.message.slice(0, 500),
    progress: input.progress ?? null,
    createdAt:
      input.createdAt instanceof Date
        ? input.createdAt.toISOString()
        : (input.createdAt ?? new Date().toISOString()),
  };
}

/**
 * Merge a live event stream with authoritative history, dropping duplicates and
 * ordering by creation time so reconnecting clients converge on one timeline.
 */
export function mergeActivityEvents(
  history: ActivityEvent[],
  live: ActivityEvent[],
): ActivityEvent[] {
  const byId = new Map<string, ActivityEvent>();
  for (const event of [...history, ...live]) {
    if (!byId.has(event.eventId)) byId.set(event.eventId, event);
  }
  return [...byId.values()].sort((a, b) => {
    const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return diff !== 0 ? diff : a.eventId.localeCompare(b.eventId);
  });
}
