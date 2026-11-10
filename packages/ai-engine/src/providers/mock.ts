import type { AiJsonRequest, AiProvider, AiRawResponse } from "../types.js";

export class MockProvider implements AiProvider {
  readonly name = "mock" as const;
  readonly model = "mock-documentation-v1";
  private readonly enabled: boolean;

  constructor(options: { enabled: boolean }) {
    this.enabled = options.enabled;
  }

  async generateJson(request: AiJsonRequest): Promise<AiRawResponse> {
    if (!this.enabled) {
      throw new Error("Mock AI provider is disabled. Set AI_ALLOW_MOCK=true in development.");
    }
    const banner =
      "> **Mock provider output.** This content was produced by the development mock, not by a language model. Configure Gemini or Groq for real documentation.";

    if (request.operation === "cleanup") {
      return {
        text: JSON.stringify({
          markdown: `# Mock README\n\n${banner}\n\nNo repository analysis is available from the mock provider.\n`,
          changes: [{ summary: "Mock cleanup", explanation: "Mock provider echoed a placeholder document." }],
          warnings: ["Mock provider: cleanup content is not derived from the repository."],
        }),
      };
    }

    if (request.operation === "incremental") {
      return {
        text: JSON.stringify({
          patches: [],
          summary: "Mock provider: no patches generated.",
          warnings: ["Mock provider cannot analyse diffs."],
        }),
      };
    }

    return {
      text: JSON.stringify({
        title: "Mock Project",
        summary: `Mock summary. ${banner}`,
        sections: [
          {
            key: "overview",
            heading: "Overview",
            level: 2,
            body: `${banner}\n\nThis placeholder exists so the pipeline can be exercised without an AI key.`,
            evidence: [],
            warnings: ["Mock provider output is not grounded in repository files."],
          },
        ],
        warnings: ["Mock AI provider is enabled (development only)."],
      }),
    };
  }
}
