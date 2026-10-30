import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

const eventValidator = v.object({
  eventId: v.string(),
  logId: v.string(),
  jobId: v.union(v.string(), v.null()),
  runId: v.union(v.string(), v.null()),
  userId: v.string(),
  repositoryId: v.union(v.string(), v.null()),
  repositoryFullName: v.union(v.string(), v.null()),
  type: v.string(),
  message: v.string(),
  progress: v.union(v.object({ step: v.number(), total: v.number() }), v.null()),
  createdAt: v.string(),
  readKey: v.string(),
});

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Append an activity event. Requires the deployment's publish token, and is
 * idempotent by eventId so retried outbox deliveries cannot duplicate events.
 */
export const append = mutationGeneric({
  args: { token: v.string(), event: eventValidator },
  handler: async (ctx, { token, event }) => {
    const expected = process.env.COMMITSCIBBLE_PUBLISH_TOKEN;
    if (!expected || !constantTimeEqual(token, expected)) {
      throw new Error("Unauthorized activity publish attempt");
    }
    if (event.readKey.length < 16) {
      throw new Error("Invalid activity read key");
    }
    const existing = await ctx.db
      .query("events")
      .withIndex("by_event_id", (q) => q.eq("eventId", event.eventId))
      .first();
    if (existing) return existing._id;
    return await ctx.db.insert("events", event);
  },
});

/** Latest events for one user, used to invalidate persisted API queries. */
export const recent = queryGeneric({
  args: { readKey: v.string(), limit: v.number() },
  handler: async (ctx, { readKey, limit }) => {
    if (readKey.length < 16) return [];
    const docs = await ctx.db
      .query("events")
      .withIndex("by_read_key_created", (q) => q.eq("readKey", readKey))
      .order("desc")
      .take(Math.max(1, Math.min(limit, 100)));
    return docs.map((doc) => ({
      eventId: doc.eventId,
      logId: doc.logId,
      jobId: doc.jobId,
      runId: doc.runId,
      repositoryId: doc.repositoryId,
      repositoryFullName: doc.repositoryFullName,
      type: doc.type,
      message: doc.message,
      progress: doc.progress,
      createdAt: doc.createdAt,
    }));
  },
});
