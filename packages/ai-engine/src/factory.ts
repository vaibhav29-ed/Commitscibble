import type { AiProviderName, UsageRecord } from "@commitscibble/shared";
import { GeminiProvider } from "./providers/gemini.js";
import { GroqProvider } from "./providers/groq.js";
import { MockProvider } from "./providers/mock.js";
import { AiOrchestrator } from "./registry.js";
import type { AiProvider } from "./types.js";

export interface AiEngineSettings {
  primary: AiProviderName;
  fallback: AiProviderName | null;
  providers: {
    gemini: { apiKey: string | null; model: string };
    groq: { apiKey: string | null; model: string };
    mock: { enabled: boolean };
  };
  maxRetries: number;
  timeoutMs: number;
  maxOutputTokens: number;
  maxConcurrency: number;
}

export function createProviderChain(settings: AiEngineSettings): AiProvider[] {
  const order: AiProviderName[] = [settings.primary];
  if (settings.fallback && settings.fallback !== settings.primary) order.push(settings.fallback);

  const providers: AiProvider[] = [];
  for (const name of order) {
    if (name === "gemini" && settings.providers.gemini.apiKey) {
      providers.push(
        new GeminiProvider({
          apiKey: settings.providers.gemini.apiKey,
          model: settings.providers.gemini.model,
          timeoutMs: settings.timeoutMs,
          maxOutputTokens: settings.maxOutputTokens,
        }),
      );
    }
    if (name === "groq" && settings.providers.groq.apiKey) {
      providers.push(
        new GroqProvider({
          apiKey: settings.providers.groq.apiKey,
          model: settings.providers.groq.model,
          timeoutMs: settings.timeoutMs,
          maxOutputTokens: settings.maxOutputTokens,
        }),
      );
    }
    if (name === "mock" && settings.providers.mock.enabled) {
      providers.push(new MockProvider({ enabled: true }));
    }
  }
  return providers;
}

export function createOrchestrator(
  settings: AiEngineSettings,
  options: {
    onUsage?: (record: UsageRecord) => void;
    sleep?: (ms: number) => Promise<void>;
    random?: () => number;
  } = {},
): AiOrchestrator {
  return new AiOrchestrator({
    providers: createProviderChain(settings),
    maxRetries: settings.maxRetries,
    timeoutMs: settings.timeoutMs,
    maxConcurrency: settings.maxConcurrency,
    onUsage: options.onUsage,
    sleep: options.sleep,
    random: options.random,
  });
}
