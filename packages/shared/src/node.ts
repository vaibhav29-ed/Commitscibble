import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export function sha256Hex(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

export function normalizeText(text: string): string {
  return text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function hashContent(text: string): string {
  return sha256Hex(normalizeText(text));
}

export function shortHash(text: string, length = 12): string {
  return hashContent(text).slice(0, length);
}

export function hmacSha256Hex(secret: string, payload: string | Buffer): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function safeEqualString(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function verifyHmacSha256(
  secret: string,
  payload: string | Buffer,
  signature: string | undefined | null,
): boolean {
  if (!secret || !signature) return false;
  const provided = signature.startsWith("sha256=") ? signature.slice(7) : signature;
  if (!/^[a-f0-9]{64}$/i.test(provided)) return false;
  const expected = hmacSha256Hex(secret, payload);
  return safeEqualString(expected.toLowerCase(), provided.toLowerCase());
}

export function parseEncryptionKey(keyBase64: string): Buffer {
  const key = Buffer.from(keyBase64, "base64");
  if (key.length !== 32) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY must be a base64 encoded 32-byte key (openssl rand -base64 32)",
    );
  }
  return key;
}

const AAD = Buffer.from("commitscibble:github-token:v1", "utf8");

export function encryptSecret(plaintext: string, keyBase64: string): string {
  const key = parseEncryptionKey(keyBase64);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(AAD);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptSecret(payload: string, keyBase64: string): string {
  const parts = payload.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Unsupported encrypted payload format");
  }
  const key = parseEncryptionKey(keyBase64);
  const iv = Buffer.from(parts[1], "base64url");
  const tag = Buffer.from(parts[2], "base64url");
  const data = Buffer.from(parts[3], "base64url");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(AAD);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(token: string): string {
  return sha256Hex(`commitscibble.session.${token}`);
}

export function newId(): string {
  return randomBytes(16).toString("hex");
}

export function deriveRealtimeReadKey(secret: string, userId: string): string {
  return createHmac("sha256", secret)
    .update(`commitscibble.realtime:${userId}`)
    .digest("base64url")
    .slice(0, 40);
}

export function randomInt(maxExclusive: number): number {
  if (maxExclusive <= 0) return 0;
  return randomBytes(4).readUInt32BE(0) % maxExclusive;
}
