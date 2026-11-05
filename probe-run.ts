import { loadEnv } from "@commitscibble/config";
import {
  AuditLog,
  connectDatabase,
  disconnectDatabase,
  DocumentationRun,
  Repository,
} from "@commitscibble/persistence";

const env = loadEnv();
await connectDatabase({ uri: env.MONGO_URI as string });

const repo = await Repository.findOne({ fullName: "vaibhav29-ed/vaibhavprofile" }).lean();
console.log("REPO", repo ? String(repo._id) : null, repo?.trackingStatus, repo?.defaultBranch, repo?.settings);

const runs = await DocumentationRun.find({ repositoryId: repo?._id })
  .sort({ createdAt: -1 })
  .limit(5)
  .lean();

for (const run of runs) {
  console.log("\nRUN", String(run._id), run.operation, run.status, run.createdAt?.toISOString());
  console.log("  error:", run.errorCode, "|", run.errorMessage);
  console.log("  provider/model:", run.provider, run.model);
  console.log("  commit:", run.baseCommitSha, "->", run.targetCommitSha);
  console.log("  attempt:", run.attempt, "jobId:", run.jobId, "correlationId:", run.correlationId);
  console.log("  warnings:", JSON.stringify(run.warnings));
  console.log("  metadata:", JSON.stringify(run.metadata));
  if (run.analysis) console.log("  analysis keys:", Object.keys(run.analysis));

  const logs = await AuditLog.find({ runId: run._id }).sort({ createdAt: 1 }).lean();
  for (const log of logs) {
    console.log(
      `  [${log.createdAt?.toISOString()}] ${log.type} ${JSON.stringify(log.progress ?? null)} ${log.message} ${JSON.stringify(log.metadata ?? null)}`,
    );
  }
}

await disconnectDatabase();
process.exit(0);
