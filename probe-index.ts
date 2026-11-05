import { loadEnv } from "@commitscibble/config";
import { AuditLog, connectDatabase, disconnectDatabase } from "@commitscibble/persistence";

const env = loadEnv();
await connectDatabase({ uri: env.MONGO_URI as string });
const indexes = await AuditLog.collection.indexes();
for (const index of indexes) {
  console.log(index.name, JSON.stringify(index.key), "unique:", Boolean(index.unique), "ttl:", index.expireAfterSeconds);
}
await disconnectDatabase();
process.exit(0);
