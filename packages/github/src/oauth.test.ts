import { describe, expect, it } from "vitest";
import { buildAuthorizeUrl, createOAuthState, verifyOAuthState } from "./oauth.js";

const SECRET = "oauth-state-secret-that-is-long-enough";

describe("OAuth helpers", () => {
  it("builds an authorize URL with minimal scopes and CSRF state", () => {
    const url = new URL(
      buildAuthorizeUrl({
        clientId: "client-id",
        redirectUri: "http://localhost:4000/auth/github/callback",
        state: "state-token",
      }),
    );
    expect(url.searchParams.get("client_id")).toBe("client-id");
    expect(url.searchParams.get("state")).toBe("state-token");
    expect(url.searchParams.get("scope")).toBe("read:user user:email repo");
  });

  it("verifies a state it created", () => {
    const state = createOAuthState(SECRET, "nonce-value", Date.now());
    expect(verifyOAuthState(SECRET, state).valid).toBe(true);
  });

  it("rejects tampered or expired state", () => {
    const issuedAt = Date.now() - 11 * 60 * 1000;
    const state = createOAuthState(SECRET, "nonce-value", issuedAt);
    expect(verifyOAuthState(SECRET, state).valid).toBe(false);

    const fresh = createOAuthState(SECRET, "nonce-value", Date.now());
    expect(verifyOAuthState(SECRET, `${fresh}x`).valid).toBe(false);
    expect(verifyOAuthState("different-secret-value-that-is-long", fresh).valid).toBe(false);
  });

  it("rejects malformed state values", () => {
    expect(verifyOAuthState(SECRET, undefined).valid).toBe(false);
    expect(verifyOAuthState(SECRET, "not-a-state").valid).toBe(false);
    expect(verifyOAuthState(SECRET, "a.b.c").valid).toBe(false);
  });
});
