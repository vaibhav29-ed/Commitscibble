import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Convex is a realtime delivery channel only. MongoDB remains authoritative.
 * `readKey` is a per-user HMAC-derived bearer value returned only to that user's
 * authenticated browser session; the query rejects any request without it.
 */
export default defineSchema({
  events: defineTable({
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
  })
    .index("by_event_id", ["eventId"])
    .index("by_read_key_created", ["readKey", "createdAt"])
    .index("by_repository_created", ["repositoryId", "createdAt"]),
});
