import { describe, expect, it } from "vitest";
import { findSecretsInText, redactObject, redactSecrets } from "./redact.js";

describe("secret redaction", () => {
  it("redacts GitHub and provider tokens", () => {
    const text =
      "token gho_abcdefghijklmnopqrstuvwxyz0123456789 and AIzaSyA1234567890abcdefghijklmnopqrstu and gsk_abcdefghijklmnopqrstuvwxyz";
    const output = redactSecrets(text);
    expect(output).not.toContain("gho_");
    expect(output).not.toContain("AIzaSy");
    expect(output).not.toContain("gsk_");
    expect(output).toContain("[REDACTED_GITHUB_TOKEN]");
  });

  it("redacts bearer headers and assignment style secrets", () => {
    const text = "Authorization: Bearer abcdefghijklmnopqrstuvwxyz\npassword=hunter2hunter2\nclient_secret: shhhh12345";
    const output = redactSecrets(text);
    expect(output).toContain("Bearer [REDACTED]");
    expect(output).not.toContain("hunter2hunter2");
    expect(output).not.toContain("shhhh12345");
  });

  it("redacts credentials inside connection strings", () => {
    const output = redactSecrets("mongodb+srv://user:supersecret@cluster.example.net/db");
    expect(output).toBe("mongodb+srv://user:[REDACTED]@cluster.example.net/db");
  });

  it("redacts private key blocks", () => {
    const output = redactSecrets(
      "-----BEGIN RSA PRIVATE KEY-----\nMIIEow\n-----END RSA PRIVATE KEY-----",
    );
    expect(output).toBe("[REDACTED_PRIVATE_KEY]");
  });

  it("deep-redacts sensitive object keys for logging", () => {
    const redacted = redactObject({
      ok: true,
      nested: { accessToken: "abc", githubTokenEncrypted: "v1.x", safe: "value" },
      headers: { authorization: "Bearer xyz" },
    }) as Record<string, any>;
    expect(redacted.nested.accessToken).toBe("[REDACTED]");
    expect(redacted.nested.githubTokenEncrypted).toBe("[REDACTED]");
    expect(redacted.headers.authorization).toBe("[REDACTED]");
    expect(redacted.nested.safe).toBe("value");
    expect(redacted.ok).toBe(true);
  });

  it("detects leaked credentials in generated documentation", () => {
    expect(findSecretsInText("# ok\n\nno secrets")).toEqual([]);
    expect(findSecretsInText("key: ghp_abcdefghijklmnopqrstuvwxyz0123456789").length).toBe(1);
  });
});
