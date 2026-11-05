import { loadEnv } from "@commitscibble/config";
import { connectDatabase, disconnectDatabase, Repository, User } from "@commitscibble/persistence";
import { decryptSecret } from "@commitscibble/shared/node";
import { GitHubClient } from "@commitscibble/github";

const env = loadEnv();
await connectDatabase({ uri: env.MONGO_URI as string });

const repo = await Repository.findOne({ fullName: "vaibhav29-ed/vaibhavprofile" }).lean();
if (!repo) throw new Error("repo missing");
const user = await User.findById(repo.userId).select("+githubTokenEncrypted").lean();
console.log("user:", String(user?._id), user?.githubLogin);
console.log("installId:", repo.githubInstallationId);
console.log(
  "token stored:",
  Boolean(user?.githubTokenEncrypted),
  user?.githubTokenEncrypted ? `${user.githubTokenEncrypted.length} chars` : "",
);
console.log("enc key length:", env.TOKEN_ENCRYPTION_KEY?.length);
console.log("api base:", env.GITHUB_API_BASE_URL);

let token: string | null = null;
try {
  token = decryptSecret(user!.githubTokenEncrypted as string, env.TOKEN_ENCRYPTION_KEY as string);
  console.log("decrypt OK, length", token.length, "prefix", token.slice(0, 4));
} catch (error) {
  const err = error as Error & { code?: string };
  console.log("DECRYPT FAILED", err.constructor?.name, err.name, err.code, err.message);
}

if (token) {
  const client = new GitHubClient({ token, baseUrl: env.GITHUB_API_BASE_URL });
  try {
    const me = await client.getAuthenticatedUser();
    console.log("getAuthenticatedUser OK", me.login);
  } catch (error) {
    const err = error as Error & { code?: string; status?: number; cause?: unknown };
    console.log("GETUSER FAILED", err.constructor?.name, err.name, err.code, err.status, err.message);
    if (err.cause) console.log("cause:", (err.cause as Error).message ?? err.cause);
  }
  try {
    const branch = repo.settings.targetBranch ?? repo.defaultBranch;
    const info = await client.getBranch(repo.owner, repo.name, branch);
    console.log("getBranch OK", branch, info.sha);
  } catch (error) {
    const err = error as Error & { code?: string; status?: number; cause?: unknown };
    console.log("GETBRANCH FAILED", err.constructor?.name, err.name, err.code, err.status, err.message);
    if (err.cause) console.log("cause:", (err.cause as Error).message ?? err.cause);
  }
}

await disconnectDatabase();
process.exit(0);

