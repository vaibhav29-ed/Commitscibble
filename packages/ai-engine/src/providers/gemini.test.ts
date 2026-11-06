import { describe, expect, it } from "vitest";
import { GeminiProvider } from "./gemini.js";

function stubFetch(payload: unknown = { candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] }) {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body ?? "{}")) });
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return { calls, fetchImpl };
}

function provider(model: string, fetchImpl: typeof fetch) {
  return new GeminiProvider({
    apiKey: "test-key",
    model,
    timeoutMs: 5_000,
    maxOutputTokens: 1_024,
    baseUrl: "https://example.test/v1beta",
    fetchImpl,
  });
}

const request = { system: "be terse", prompt: "say ok", operation: "generate" };

describe("GeminiProvider", () => {
  it("calls the configured model id without a models/ prefix", async () => {
    const { calls, fetchImpl } = stubFetch();
    await provider("gemini-3.5-flash", fetchImpl).generateJson(request);

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(
      "https://example.test/v1beta/models/gemini-3.5-flash:generateContent",
    );
    expect(calls[0].body.generationConfig).toMatchObject({
      responseMimeType: "application/json",
      thinkingConfig: { thinkingBudget: 0 },
    });
  });

  it("leaves thinking enabled for models that reject a zero budget", async () => {
    const { calls, fetchImpl } = stubFetch();
    await provider("gemini-3.5-pro", fetchImpl).generateJson(request);

    expect(calls[0].body.generationConfig).not.toHaveProperty("thinkingConfig");
  });

  it("returns the concatenated candidate text", async () => {
    const { fetchImpl } = stubFetch({
      candidates: [{ content: { parts: [{ text: '{"ok":' }, { text: "true}" }] } }],
    });

    const result = await provider("gemini-3.5-flash", fetchImpl).generateJson(request);
    expect(result.text).toBe('{"ok":true}');
  });
});
