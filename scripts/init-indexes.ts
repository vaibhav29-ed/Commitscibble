/**
 * Creates the declared Mongoose indexes plus the retention TTL indexes.
 * Safe to run repeatedly. Usage: pnpm db:indexes
 */
import { assertServiceEnv, loadEnv } from "@commitscibble/config";
import {
  ALL_MODELS,
  connectDatabase,
  disconnectDatabase,
  initializeIndexes,
} from "@commitscibble/persistence";

async function main(): Promise<void> {
  const env = loadEnv();
  assertServiceEnv(env, { role: "worker" });
  await connectDatabase({ uri: env.MONGO_URI as string });

  for (const model of ALL_MODELS) {
    await model.syncIndexes();
    process.stdout.write(`synced indexes for ${model.collection.name}\n`);
  }

  await initializeIndexes({
    auditRetentionDays: env.AUDIT_RETENTION_DAYS,
    webhookRetentionDays: env.WEBHOOK_RETENTION_DAYS,
  });
  process.stdout.write("retention TTL indexes created\n");

  await disconnectDatabase();
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
