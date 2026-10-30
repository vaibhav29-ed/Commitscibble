import { decryptSecret, encryptSecret } from "@commitscibble/shared/node";

/** GitHub tokens are encrypted with AES-256-GCM before they touch MongoDB. */
export function encryptGitHubToken(token: string, encryptionKey: string): string {
  return encryptSecret(token, encryptionKey);
}

export function decryptGitHubToken(payload: string, encryptionKey: string): string {
  return decryptSecret(payload, encryptionKey);
}
