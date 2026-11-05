import { describe, expect, it } from "vitest";
import { JobQueue, queueJobId } from "./queue.js";

// Port 1 is never a Redis server, so every command must fail fast.
const UNREACHABLE_REDIS = "redis://127.0.0.1:1";

const job = {
  runId: "run-1",
  repositoryId: "repo-1",
  userId: "user-1",
  operation: "GENERATE" as const,
  correlationId: "log_test",
  attempt: 1,
};

describe("queueJobId", () => {
  it("never contains ':', which BullMQ rejects in custom job ids", () => {
    const ids = [
      queueJobId("run", "run-1"),
      queueJobId("apply", "proposal-1"),
      queueJobId("webhook", "delivery-1"),
      queueJobId("outbox", Date.now()),
    ];

    for (const id of ids) {
      expect(id).not.toContain(":");
    }
    expect(ids[0]).toBe("run-run-1");
  });
});

describe("JobQueue when Redis is unreachable", () => {
  it("rejects enqueueRun promptly instead of buffering the command forever", async () => {
    const queue = new JobQueue(UNREACHABLE_REDIS);
    const startedAt = Date.now();

    await expect(queue.enqueueRun(job)).rejects.toThrow(/not reachable/);
    expect(Date.now() - startedAt).toBeLessThan(5_000);

    await queue.close().catch(() => undefined);
  }, 15_000);

  it("reports unhealthy without blocking the readiness probe", async () => {
    const queue = new JobQueue(UNREACHABLE_REDIS);

    await expect(queue.health()).resolves.toBe(false);

    await queue.close().catch(() => undefined);
  }, 15_000);

  it("gives up waiting for readiness after the timeout", async () => {
    const queue = new JobQueue(UNREACHABLE_REDIS);

    await expect(queue.waitUntilReady(200)).resolves.toBe(false);

    await queue.close().catch(() => undefined);
  }, 15_000);
});
