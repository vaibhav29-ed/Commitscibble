import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@commitscibble/persistence", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@commitscibble/persistence")>();
  return {
    ...actual,
    Repository: { findOne: vi.fn(), findById: vi.fn(), updateOne: vi.fn() },
    DocumentationRun: {
      create: vi.fn(),
      findOne: vi.fn(),
      findOneAndUpdate: vi.fn(),
      updateOne: vi.fn(),
    },
    DocumentationProposal: {
      findOne: vi.fn(),
      findOneAndUpdate: vi.fn(),
      updateOne: vi.fn(),
    },
    recordActivity: vi.fn(),
  };
});

import {
  DocumentationProposal,
  DocumentationRun,
  Repository,
  recordActivity,
} from "@commitscibble/persistence";
import type { JobQueue } from "../lib/queue.js";
import { RunService } from "./runs.js";

const repository = {
  _id: "repo-1",
  userId: "user-1",
  fullName: "octo/example",
  trackingStatus: "CONNECTED",
};

const queuedRun = {
  _id: "run-1",
  userId: "user-1",
  repositoryId: "repo-1",
  operation: "GENERATE",
  status: "QUEUED",
  correlationId: "log_run-1",
  attempt: 1,
};

function failingQueue(): JobQueue {
  return {
    enqueueRun: vi.fn(async () => {
      throw new Error("connect ECONNREFUSED 127.0.0.1:6379");
    }),
    enqueueApply: vi.fn(async () => {
      throw new Error("connect ECONNREFUSED 127.0.0.1:6379");
    }),
  } as unknown as JobQueue;
}

describe("RunService when the queue is unreachable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Repository.findOne).mockResolvedValue(repository as never);
    vi.mocked(DocumentationRun.findOne).mockResolvedValue(null);
    vi.mocked(DocumentationRun.create).mockResolvedValue(queuedRun as never);
    vi.mocked(DocumentationRun.updateOne).mockResolvedValue({} as never);
    vi.mocked(recordActivity).mockResolvedValue({} as never);
  });

  it("reports a retryable 503 instead of hanging or returning a generic 500", async () => {
    const service = new RunService(failingQueue());

    await expect(service.start("user-1", "repo-1", "GENERATE")).rejects.toMatchObject({
      code: "NOT_READY",
      httpStatus: 503,
      retryable: true,
    });
  });

  it("does not leave the run stuck in QUEUED", async () => {
    const service = new RunService(failingQueue());

    await expect(service.start("user-1", "repo-1", "GENERATE")).rejects.toThrow();

    expect(DocumentationRun.updateOne).toHaveBeenCalledWith(
      { _id: "run-1", status: "QUEUED" },
      {
        $set: expect.objectContaining({
          status: "FAILED",
          errorCode: "NOT_READY",
        }),
      },
    );
    expect(recordActivity).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: "FAILED", runId: "run-1" }),
    );
  });

  it("returns the claimed proposal to PENDING when the apply job cannot be queued", async () => {
    const proposal = {
      _id: "proposal-1",
      userId: "user-1",
      repositoryId: "repo-1",
      status: "PENDING",
      baseCommitSha: "sha",
      baseReadmeHash: "hash",
    };
    vi.mocked(DocumentationProposal.findOne).mockResolvedValue(proposal as never);
    vi.mocked(DocumentationProposal.findOneAndUpdate).mockResolvedValue({
      ...proposal,
      status: "APPROVED",
    } as never);
    vi.mocked(DocumentationProposal.updateOne).mockResolvedValue({} as never);
    vi.mocked(DocumentationRun.create).mockResolvedValue({
      ...queuedRun,
      operation: "PROPOSAL_APPLY",
    } as never);

    const service = new RunService(failingQueue());

    await expect(service.approve("user-1", "proposal-1")).rejects.toMatchObject({
      code: "NOT_READY",
      httpStatus: 503,
    });
    expect(DocumentationProposal.updateOne).toHaveBeenCalledWith(
      { _id: "proposal-1", status: "APPROVED" },
      { $set: { status: "PENDING", reviewedAt: null, reviewedBy: null } },
    );
  });
});
