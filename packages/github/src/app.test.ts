import { createVerify, generateKeyPairSync } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearInstallationTokenCache,
  createAppJwt,
  getInstallationToken,
  normalizePrivateKey,
} from "./app.js";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

const signedAt = Date.parse("2026-01-01T00:00:00.000Z");

function tokenResponse(expiresAt: number) {
  return new Response(
    JSON.stringify({ token: "ghs_test_token", expires_at: new Date(expiresAt).toISOString() }),
    { status: 201, headers: { "content-type": "application/json" } },
  );
}

describe("GitHub App authentication", () => {
  afterEach(() => clearInstallationTokenCache());

  it("signs a verifiable RS256 JWT with bounded lifetime", () => {
    const jwt = createAppJwt({ appId: "12345", privateKey }, signedAt);
    const [header, payload, signature] = jwt.split(".");

    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${header}.${payload}`);
    verifier.end();
    expect(verifier.verify(publicKey, Buffer.from(signature, "base64url"))).toBe(true);

    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      iss: string;
      iat: number;
      exp: number;
    };
    expect(claims.iss).toBe("12345");
    expect(claims.iat).toBeLessThanOrEqual(signedAt / 1000);
    expect(claims.exp - claims.iat).toBeLessThanOrEqual(600);
  });

  it("normalizes escaped newlines in a PEM key", () => {
    const escaped = privateKey.replace(/\n/g, "\\n");
    expect(normalizePrivateKey(escaped)).toContain("\n-----END PRIVATE KEY-----");
    expect(() => createAppJwt({ appId: "1", privateKey: escaped }, signedAt)).not.toThrow();
  });

  it("caches installation tokens and refreshes them before expiry", async () => {
    let now = signedAt;
    const fetchMock = vi.fn(async () => tokenResponse(now + 3_600_000));

    const options = {
      appId: "12345",
      privateKey,
      installationId: 77,
      fetchImpl: fetchMock as unknown as typeof fetch,
      now: () => now,
    };

    expect(await getInstallationToken(options)).toBe("ghs_test_token");
    expect(await getInstallationToken(options)).toBe("ghs_test_token");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    now += 3_600_000;
    expect(await getInstallationToken(options)).toBe("ghs_test_token");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("surfaces a rejected installation token request as a typed error", async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ message: "Bad credentials" }), { status: 401 })) as typeof fetch;

    await expect(
      getInstallationToken({ appId: "1", privateKey, installationId: 5, fetchImpl }),
    ).rejects.toThrow(/installation token/i);
  });
});
