import { decryptSecret } from "@commitscibble/shared/node";

export function decryptGitHubToken(payload: string, encryptionKey: string): string {
  return decryptSecret(payload, encryptionKey);
}
