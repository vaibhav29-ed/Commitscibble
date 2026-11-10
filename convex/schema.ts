import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

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
