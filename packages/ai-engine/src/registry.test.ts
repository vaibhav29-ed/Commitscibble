import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AppError, ERROR_CODES } from "@commitscibble/shared";
import { AiOrchestrator } from "./registry.js";
import {
  AiProviderError,
  type AiJsonRequest,
  type AiProvider,
  type AiRawResponse,
} from "./types.js";

const schema = z.object({ ok: z.boolean(), message: z.string().optional() });

class FakeProvider implements AiProvider {
  calls = 0;
  constructor(
    readonly name: AiProvider["name"],
    readonly model: string,
    private readonly behaviour: (call: number) => AiRawResponse | Error,
  ) {}

  async generateJson(_request: AiJsonRequest): Promise<AiRawResponse> {
    this.calls += 1;
    const result = this.behaviour(this.calls);
    if (result instanceof Error) throw result;
    return result;
  }
}

function orchestrator(providers: AiProvider[], maxRetries = 2) {
  return new AiOrchestrator({
    providers,
    maxRetries,
    timeoutMs: 1000,
    maxConcurrency: 2,
    baseDelayMs: 1,
    maxDelayMs: 2,
    sleep: async () => undefined,
    random: () => 0,
  });
}

describe("AI orchestration", () => {
  it("retries retryable provider errors and records attempts", async () => {
    const provider = new FakeProvider("gemini", "gemini-test", (call) =>
      call === 1
        ? new AiProviderError("gemini", "RATE_LIMITED", "slow down")
        : { text: JSON.stringify({ ok: true }) },
    );
    const result = await orchestrator([provider]).generateStructured(
      { system: "s", prompt: "p", operation: "generate" },
      schema,
    );
    expect(result.data.ok).toBe(true);
    expect(result.attempt).toBe(2);
    expect(result.usage.map((record) => record.outcome)).toEqual(["RETRYABLE_FAILURE", "SUCCESS"]);
    expect(provider.calls).toBe(2);
  });

  it("falls back to the next provider on authentication failure", async () => {
    const primary = new FakeProvider("gemini", "gemini-test", () =>
      new AiProviderError("gemini", "AUTH", "bad key", { retryable: false }),
    );
    const fallback = new FakeProvider("groq", "groq-test", () => ({
      text: JSON.stringify({ ok: true }),
    }));
    const result = await orchestrator([primary, fallback]).generateStructured(
      { system: "s", prompt: "p", operation: "cleanup" },
      schema,
    );
    expect(result.provider).toBe("groq");
    expect(primary.calls).toBe(1);
    expect(result.usage.some((record) => record.outcome === "FALLBACK")).toBe(true);
  });

  it("retries malformed JSON once and then succeeds", async () => {
    const provider = new FakeProvider("groq", "groq-test", (call) =>
      call === 1 ? { text: "not json at all" } : { text: '```json\n{"ok":true}\n```' },
    );
    const result = await orchestrator([provider]).generateStructured(
      { system: "s", prompt: "p", operation: "generate" },
      schema,
    );
    expect(result.data.ok).toBe(true);
    expect(provider.calls).toBe(2);
  });

  it("does not fall back when the request itself is invalid", async () => {
    const primary = new FakeProvider("gemini", "gemini-test", () =>
      new AiProviderError("gemini", "INVALID_REQUEST", "model does not exist", {
        retryable: false,
        fallbackEligible: false,
      }),
    );
    const fallback = new FakeProvider("groq", "groq-test", () => ({
      text: JSON.stringify({ ok: true }),
    }));
    await expect(
      orchestrator([primary, fallback]).generateStructured(
        { system: "s", prompt: "p", operation: "generate" },
        schema,
      ),
    ).rejects.toThrow(/AI generation failed/);
    expect(fallback.calls).toBe(0);
  });

  it("rejects when every attempt returns an invalid payload", async () => {
    const provider = new FakeProvider("gemini", "gemini-test", () => ({
      text: JSON.stringify({ wrong: "shape" }),
    }));
    await expect(
      orchestrator([provider], 1).generateStructured(
        { system: "s", prompt: "p", operation: "generate" },
        schema,
      ),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("fails clearly when no provider is configured", async () => {
    await expect(
      orchestrator([]).generateStructured(
        { system: "s", prompt: "p", operation: "generate" },
        schema,
      ),
    ).rejects.toMatchObject({ code: ERROR_CODES.AI_NOT_CONFIGURED });
  });

  it("surfaces a safe error code without leaking prompt content", async () => {
    const provider = new FakeProvider("gemini", "gemini-test", () =>
      new AiProviderError("gemini", "SERVER", "upstream exploded", { retryable: false }),
    );
    try {
      await orchestrator([provider], 0).generateStructured(
        { system: "secret system", prompt: "SECRET PROMPT CONTENT", operation: "generate" },
        schema,
      );
      throw new Error("expected failure");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).message).not.toContain("SECRET PROMPT CONTENT");
      expect((error as AppError).details).toMatchObject({ safeCode: "SERVER" });
    }
  });
});
