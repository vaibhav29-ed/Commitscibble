import type { Env } from "@commitscibble/config";
import {
  DocumentationProposal,
  DocumentationRun,
  Repository,
  recordActivity,
} from "@commitscibble/persistence";
import type { Logger } from "./lib/logger.js";

/**
 * Runs interrupted by a worker crash stay RUNNING forever. On startup we mark
 * them FAILED (never silently retry a GitHub write), and return approved-but-
 * unapplied proposals to PENDING so a reviewer can approve them again.
 */
export async function recoverStaleRuns(env: Env, logger: Logger): Promise<number> {
  const cutoff = new Date(Date.now() - env.STALE_RUN_MINUTES * 60_000);
  const staleRuns = await DocumentationRun.find({
    status: "RUNNING",
    updatedAt: { $lt: cutoff },
  }).limit(200);

  let recovered = 0;
  for (const run of staleRuns) {
    const updated = await DocumentationRun.findOneAndUpdate(
      { _id: run._id, status: "RUNNING" },
      {
        $set: {
          status: "FAILED",
          errorCode: "WORKER_INTERRUPTED",
          errorMessage:
            "The worker process stopped before this run completed. Re-run the operation to continue.",
          completedAt: new Date(),
        },
      },
      { new: true },
    );
    if (!updated) continue;
    recovered += 1;

    const repository = await Repository.findById(run.repositoryId);
    await recordActivity({
      userId: run.userId,
      repositoryId: run.repositoryId,
      repositoryFullName: repository?.fullName ?? null,
      runId: run._id,
      jobId: run.jobId,
      type: "FAILED",
      message: "Run was interrupted by a worker restart and marked failed. Re-run to continue.",
      logId: run.correlationId,
      metadata: { errorCode: "WORKER_INTERRUPTED" },
    });

    if (run.operation === "PROPOSAL_APPLY" && run.proposalId) {
      await DocumentationProposal.updateOne(
        { _id: run.proposalId, status: "APPROVED" },
        { $set: { status: "PENDING", reviewedAt: null, reviewedBy: null } },
      );
    }
  }

  // Approved proposals whose apply job never ran can otherwise never be applied.
  const orphaned = await DocumentationProposal.find({ status: "APPROVED" }).limit(200);
  let requeuedProposals = 0;
  for (const proposal of orphaned) {
    const hasActiveApply = await DocumentationRun.exists({
      proposalId: proposal._id,
      status: { $in: ["QUEUED", "RUNNING", "RETRYING"] },
    });
    if (hasActiveApply) continue;
    await DocumentationProposal.updateOne(
      { _id: proposal._id },
      { $set: { status: "PENDING", reviewedAt: null, reviewedBy: null } },
    );
    requeuedProposals += 1;
  }

  if (recovered > 0 || requeuedProposals > 0) {
    logger.warn("Recovered stale documentation state", { staleRuns: recovered, requeuedProposals });
  }
  return recovered + requeuedProposals;
}
