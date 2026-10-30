import { z } from "zod";
import type { AiJsonRequest, AiProvider, AiRawResponse } from "../types.js";
import { AiProviderError } from "../types.js";
import { postJson } from "./http.js";

const responseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({ content: z.string().nullable().optional() }).optional(),
        finish_reason: z.string().optional(),
      }),
    )
    .default([]),
});

export interface GroqProviderOptions {
  apiKey: string;
  model: string;
  timeoutMs: number;
  maxOutputTokens: number;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

/** Groq via the OpenAI-compatible chat completions API. */
export class GroqProvider implements AiProvider {
  readonly name = "groq" as const;
  readonly model: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly maxOutputTokens: number;
  private readonly fetchImpl?: typeof fetch;
  private readonly baseUrl: string;

  constructor(options: GroqProviderOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.timeoutMs = options.timeoutMs;
    this.maxOutputTokens = options.maxOutputTokens;
    this.fetchImpl = options.fetchImpl;
    this.baseUrl = options.baseUrl ?? "https://api.groq.com/openai/v1";
  }

  async generateJson(request: AiJsonRequest): Promise<AiRawResponse> {
    const payload = await postJson({
      provider: this.name,
      url: `${this.baseUrl}/chat/completions`,
      headers: { Authorization: `Bearer ${this.apiKey}` },
      timeoutMs: this.timeoutMs,
      fetchImpl: this.fetchImpl,
      body: {
        model: this.model,
        temperature: 0.2,
        max_tokens: this.maxOutputTokens,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: request.system },
          { role: "user", content: request.prompt },
        ],
      },
    });

    const parsed = responseSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AiProviderError(this.name, "INVALID_OUTPUT", "Groq returned an unexpected payload", {
        retryable: true,
      });
    }
    const text = parsed.data.choices[0]?.message?.content ?? "";
    if (!text.trim()) {
      throw new AiProviderError(this.name, "INVALID_OUTPUT", "Groq returned an empty response", {
        retryable: true,
      });
    }
    return { text };
  }
}
