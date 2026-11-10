import { AuditLog } from "./models.js";
import { auditDocToEvent } from "./audit.js";
import type { ActivityPublisher } from "./publisher.js";

export interface DrainResult {
  published: number;
  skipped: number;
  failed: number;
}

const MAX_ATTEMPTS = 6;

export async function drainOutbox(
  publisher: ActivityPublisher,
  options: { limit?: number; now?: Date } = {},
): Promise<DrainResult> {
  const now = options.now ?? new Date();
  const result: DrainResult = { published: 0, skipped: 0, failed: 0 };
  const limit = options.limit ?? 50;

  for (let index = 0; index < limit; index += 1) {
    const claimed = await AuditLog.findOneAndUpdate(
      {
        "delivery.status": "PENDING",
        "delivery.nextAttemptAt": { $lte: now },
        $or: [{ "delivery.lockUntil": null }, { "delivery.lockUntil": { $lt: now } }],
      },
      { $set: { "delivery.lockUntil": new Date(now.getTime() + 60_000) } },
      { sort: { createdAt: 1 }, new: true },
    ).lean();

    if (!claimed) break;

    const event = auditDocToEvent(claimed);
    try {
      const published = await publisher.publish(event);
      if (published.status === "PUBLISHED") {
        await AuditLog.updateOne(
          { _id: claimed._id },
          {
            $set: {
              "delivery.status": "PUBLISHED",
              "delivery.publishedAt": new Date(),
              "delivery.lastError": null,
              "delivery.lockUntil": null,
            },
            $inc: { "delivery.attempts": 1 },
          },
        );
        result.published += 1;
      } else {
        await AuditLog.updateOne(
          { _id: claimed._id },
          {
            $set: {
              "delivery.status": "SKIPPED",
              "delivery.lastError": published.reason ?? "publisher skipped",
              "delivery.lockUntil": null,
            },
            $inc: { "delivery.attempts": 1 },
          },
        );
        result.skipped += 1;
      }
    } catch (error) {
      const attempts = (claimed.delivery?.attempts ?? 0) + 1;
      const dead = attempts >= MAX_ATTEMPTS;
      const backoffMs = Math.min(60_000, 1_000 * 2 ** attempts);
      await AuditLog.updateOne(
        { _id: claimed._id },
        {
          $set: {
            "delivery.status": dead ? "FAILED" : "PENDING",
            "delivery.lastError": error instanceof Error ? error.message.slice(0, 300) : "publish failed",
            "delivery.nextAttemptAt": new Date(now.getTime() + backoffMs),
            "delivery.lockUntil": null,
          },
          $inc: { "delivery.attempts": 1 },
        },
      );
      if (dead) result.failed += 1;
    }
  }

  return result;
}

export async function pendingDeliveryCount(): Promise<number> {
  return AuditLog.countDocuments({ "delivery.status": "PENDING" });
}
