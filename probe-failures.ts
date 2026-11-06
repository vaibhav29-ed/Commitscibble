import dns from "node:dns";
dns.setServers(["1.1.1.1", "8.8.8.8"]);

import { loadEnv } from "@commitscibble/config";
import {
  AuditLog,
  connectDatabase,
  disconnectDatabase,
  DocumentationRun,
  Repository,
} from "@commitscibble/persistence";

const env = loadEnv();
console.log("resolved AI config:", { primary: env.AI_PROVIDER_PRIMARY, fallback: env.AI_PROVIDER_FALLBACK, geminiModel: env.GEMINI_MODEL, groqModel: env.GROQ_MODEL, geminiKey: Boolean(env.GEMINI_API_KEY), groqKey: Boolean(env.GROQ_API_KEY) });

await connectDatabase({ uri: env.MONGO_URI as string });

const runs = await DocumentationRun.find({ status: "FAILED" }).sort({ createdAt: -1 }).limit(5).lean();
console.log("failed runs:", runs.length);

for (const run of runs) {
  const repo = await Repository.findById(run.repositoryId).lean();
  console.log("\nRUN", String(run._id), run.operation, run.status, run.createdAt?.toISOString());
  console.log("  repo:", repo?.fullName);
  console.log("  error:", run.errorCode, "|", run.errorMessage);
  console.log("  provider/model:", run.provider, run.model, "attempt:", run.attempt);
  console.log("  metadata:", JSON.stringify(run.metadata));
  const logs = await AuditLog.find({ runId: run._id }).sort({ createdAt: 1 }).lean();
  for (const log of logs) {
    console.log(`  [${log.createdAt?.toISOString()}] ${log.type} ${JSON.stringify(log.progress ?? null)} ${log.message}`);
  }
}

await disconnectDatabase();
process.exit(0);
