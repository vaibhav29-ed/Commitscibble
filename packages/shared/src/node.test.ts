import { describe, expect, it } from "vitest";
import {
  decryptSecret,
  deriveRealtimeReadKey,
  encryptSecret,
  hashContent,
  hmacSha256Hex,
  normalizeText,
  safeEqualString,
  verifyHmacSha256,
} from "./node.js";

const KEY = Buffer.alloc(32, 7).toString("base64");

describe("token encryption (AES-256-GCM)", () => {
  it("round-trips a GitHub token", () => {
    const token = "gho_abcdefghijklmnopqrstuvwxyz0123456789";
    const encrypted = encryptSecret(token, KEY);
    expect(encrypted.startsWith("v1.")).toBe(true);
    expect(encrypted).not.toContain(token);
    expect(decryptSecret(encrypted, KEY)).toBe(token);
  });

  it("produces a different ciphertext for the same plaintext (random IV)", () => {
    const first = encryptSecret("same-token", KEY);
    const second = encryptSecret("same-token", KEY);
    expect(first).not.toBe(second);
  });

  it("rejects tampered ciphertext", () => {
    const encrypted = encryptSecret("token-value", KEY);
    const parts = encrypted.split(".");
    const tampered = `${parts[0]}.${parts[1]}.${parts[2]}.${Buffer.from("tampered").toString("base64url")}`;
    expect(() => decryptSecret(tampered, KEY)).toThrow();
  });

  it("rejects an invalid key length", () => {
    expect(() => encryptSecret("x", Buffer.alloc(16).toString("base64"))).toThrow(
      /32-byte key/,
    );
  });
});

describe("normalized hashing", () => {
  it("ignores CRLF and trailing whitespace", () => {
    expect(hashContent("line one  \r\nline two\r\n")).toBe(hashContent("line one\nline two\n"));
  });

  it("collapses excessive blank lines before hashing", () => {
    expect(hashContent("a\n\n\n\nb")).toBe(hashContent("a\n\nb"));
  });

  it("changes when content changes", () => {
    expect(hashContent("a")).not.toBe(hashContent("b"));
  });

  it("trims leading byte order marks", () => {
    expect(normalizeText("\uFEFFhello")).toBe("hello");
  });
});

describe("HMAC verification", () => {
  it("accepts a valid sha256 signature with prefix", () => {
    const body = JSON.stringify({ hello: "world" });
    const signature = `sha256=${hmacSha256Hex("webhook-secret-value", body)}`;
    expect(verifyHmacSha256("webhook-secret-value", body, signature)).toBe(true);
  });

  it("rejects a modified body", () => {
    const signature = `sha256=${hmacSha256Hex("webhook-secret-value", "original")}`;
    expect(verifyHmacSha256("webhook-secret-value", "modified", signature)).toBe(false);
  });

  it("rejects missing or malformed signatures without throwing", () => {
    expect(verifyHmacSha256("secret", "body", undefined)).toBe(false);
    expect(verifyHmacSha256("secret", "body", "not-a-signature")).toBe(false);
    expect(verifyHmacSha256("", "body", "a".repeat(64))).toBe(false);
  });

  it("compares strings in constant time semantics", () => {
    expect(safeEqualString("abc", "abc")).toBe(true);
    expect(safeEqualString("abc", "abd")).toBe(false);
    expect(safeEqualString("abc", "abcd")).toBe(false);
  });
});

describe("realtime read keys", () => {
  it("derives a stable per-user key", () => {
    const key = deriveRealtimeReadKey("server-secret", "user-1");
    expect(key).toBe(deriveRealtimeReadKey("server-secret", "user-1"));
    expect(key).not.toBe(deriveRealtimeReadKey("server-secret", "user-2"));
    expect(key).not.toBe(deriveRealtimeReadKey("other-secret", "user-1"));
    expect(key.length).toBeGreaterThanOrEqual(16);
  });
});
