import { decryptSecret, encryptSecret } from "@commitscibble/shared/node";

export function encryptGitHubToken(token: string, encryptionKey: string): string {
  return encryptSecret(token, encryptionKey);
}

export function decryptGitHubToken(payload: string, encryptionKey: string): string {
  return decryptSecret(payload, encryptionKey);
}
