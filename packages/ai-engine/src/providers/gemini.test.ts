import { describe, expect, it } from "vitest";
import { AiProviderError } from "../types.js";
import { GeminiProvider } from "./gemini.js";

type Responder = (url: string) => { status: number; payload?: unknown };

const ok = (text = '{"ok":true}') => ({
  status: 200,
  payload: { candidates: [{ content: { parts: [{ text }] } }] },
});

function stubFetch(respond: Responder) {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    const target = String(url);
    calls.push({ url: target, body: JSON.parse(String(init?.body ?? "{}")) });
    const { status, payload } = respond(target);
    return new Response(JSON.stringify(payload ?? {}), {
      status,
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
    const { calls, fetchImpl } = stubFetch(() => ok());
    const result = await provider("gemini-3.5-flash", fetchImpl).generateJson(request);

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(
      "https://example.test/v1beta/models/gemini-3.5-flash:generateContent",
    );
    expect(calls[0].body.generationConfig).toMatchObject({
      responseMimeType: "application/json",
      thinkingConfig: { thinkingBudget: 0 },
    });
    expect(result.model).toBe("gemini-3.5-flash");
  });

  it("leaves thinking enabled for models that reject a zero budget", async () => {
    const { calls, fetchImpl } = stubFetch(() => ok());
    await provider("gemini-3.5-pro", fetchImpl).generateJson(request);

    expect(calls[0].body.generationConfig).not.toHaveProperty("thinkingConfig");
  });

  it("returns the concatenated candidate text", async () => {
    const { fetchImpl } = stubFetch(() => ({
      status: 200,
      payload: { candidates: [{ content: { parts: [{ text: '{"ok":' }, { text: "true}" }] } }] },
    }));

    const result = await provider("gemini-3.5-flash", fetchImpl).generateJson(request);
    expect(result.text).toBe('{"ok":true}');
  });

  it("falls back to a served model when the configured id is retired", async () => {
    const { calls, fetchImpl } = stubFetch((url) =>
      url.includes("gemini-2.5-flash") ? { status: 404 } : ok(),
    );

    const result = await provider("gemini-2.5-flash", fetchImpl).generateJson(request);

    expect(calls.map((call) => call.url)).toEqual([
      "https://example.test/v1beta/models/gemini-2.5-flash:generateContent",
      "https://example.test/v1beta/models/gemini-3.5-flash:generateContent",
    ]);
    expect(result.model).toBe("gemini-3.5-flash");
  });

  it("does not fall back when the request or key is rejected", async () => {
    const { calls, fetchImpl } = stubFetch(() => ({ status: 400 }));

    await expect(provider("gemini-3.5-flash", fetchImpl).generateJson(request)).rejects.toMatchObject(
      { code: "INVALID_REQUEST" } satisfies Partial<AiProviderError>,
    );
    expect(calls).toHaveLength(1);
  });

  it("reports the last failure when every candidate is unavailable", async () => {
    const { fetchImpl } = stubFetch(() => ({ status: 503 }));

    await expect(provider("gemini-2.5-flash", fetchImpl).generateJson(request)).rejects.toMatchObject(
      { code: "SERVER" } satisfies Partial<AiProviderError>,
    );
  });
});
