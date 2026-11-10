import { z } from "zod";
import type { AiJsonRequest, AiProvider, AiRawResponse } from "../types.js";
import { AiProviderError } from "../types.js";
import { postJson } from "./http.js";

const responseSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z
          .object({
            parts: z.array(z.object({ text: z.string().optional() })).default([]),
          })
          .optional(),
        finishReason: z.string().optional(),
      }),
    )
    .default([]),
  promptFeedback: z.object({ blockReason: z.string().optional() }).optional(),
});

export interface GeminiProviderOptions {
  apiKey: string;
  model: string;
  timeoutMs: number;
  maxOutputTokens: number;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

const MODEL_FALLBACKS = ["gemini-3.5-flash", "gemini-flash-latest"];

export class GeminiProvider implements AiProvider {
  readonly name = "gemini" as const;
  readonly model: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly maxOutputTokens: number;
  private readonly fetchImpl?: typeof fetch;
  private readonly baseUrl: string;

  constructor(options: GeminiProviderOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.timeoutMs = options.timeoutMs;
    this.maxOutputTokens = options.maxOutputTokens;
    this.fetchImpl = options.fetchImpl;
    this.baseUrl = options.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta";
  }

  async generateJson(request: AiJsonRequest): Promise<AiRawResponse> {
    const candidates = [...new Set([this.model, ...MODEL_FALLBACKS])];
    let lastError: unknown;
    for (const model of candidates) {
      try {
        return await this.request(model, request);
      } catch (error) {
        lastError = error;
        if (!isModelUnavailable(error)) throw error;
      }
    }
    throw lastError;
  }

  private async request(model: string, request: AiJsonRequest): Promise<AiRawResponse> {
    const payload = await postJson({
      provider: this.name,
      model,
      url: `${this.baseUrl}/models/${encodeURIComponent(model)}:generateContent`,
      headers: { "x-goog-api-key": this.apiKey },
      timeoutMs: this.timeoutMs,
      fetchImpl: this.fetchImpl,
      body: {
        systemInstruction: { parts: [{ text: request.system }] },
        contents: [{ role: "user", parts: [{ text: request.prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: this.maxOutputTokens,
          responseMimeType: "application/json",
          ...(model.includes("flash") ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      },
    });

    const parsed = responseSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AiProviderError(
        this.name,
        "INVALID_OUTPUT",
        `Gemini returned an unexpected payload (model ${model})`,
        { retryable: true, model },
      );
    }
    if (parsed.data.promptFeedback?.blockReason) {
      throw new AiProviderError(
        this.name,
        "INVALID_REQUEST",
        `Gemini blocked the request (${parsed.data.promptFeedback.blockReason})`,
        { retryable: false, fallbackEligible: false },
      );
    }
    const text = parsed.data.candidates[0]?.content?.parts.map((part) => part.text ?? "").join("") ?? "";
    if (!text.trim()) {
      throw new AiProviderError(
        this.name,
        "INVALID_OUTPUT",
        `Gemini returned an empty response (model ${model})`,
        { retryable: true, model },
      );
    }
    return { text, model };
  }
}

function isModelUnavailable(error: unknown): boolean {
  return error instanceof AiProviderError && (error.status === 404 || error.status === 503);
}
