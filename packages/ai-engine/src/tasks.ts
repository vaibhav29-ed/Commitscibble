import {
  cleanupProposalSchema,
  incrementalPatchSchema,
  readmeDraftSchema,
  type CleanupProposal,
  type IncrementalPatch,
  type ReadmeDraft,
  type RepositoryAnalysis,
} from "@commitscibble/shared";
import type { AiOrchestrator, StructuredAiResult } from "./registry.js";
import {
  SYSTEM_PROMPT,
  buildCleanupPrompt,
  buildDocumentationPrompt,
  buildIncrementalPrompt,
  truncate,
  type FileContext,
} from "./prompts.js";

export interface DocumentationTaskInput {
  analysis: RepositoryAnalysis;
  files: FileContext[];
  existingReadme: string | null;
  maintainedSections: string[];
  maxContextChars: number;
  /** Validation failures from a previous attempt; bounded to a single repair pass. */
  validationFeedback?: string[];
}

export interface IncrementalTaskInput {
  analysis: RepositoryAnalysis;
  files: FileContext[];
  existingReadme: string;
  changedFiles: { path: string; status: string; additions: number; deletions: number; patch: string | null }[];
  affectedSections: { key: string; heading: string; body: string; reason: string }[];
  maxContextChars: number;
}

export interface CleanupTaskInput {
  analysis: RepositoryAnalysis;
  files: FileContext[];
  readme: string;
  maxContextChars: number;
}

/**
 * Task-level façade over the provider orchestrator. Prompts are bounded before
 * they are sent so a large repository cannot silently blow a provider's context
 * window; the clipped amount is reported in the result warnings.
 */
export class DocumentationAi {
  constructor(private readonly orchestrator: AiOrchestrator) {}

  get providerNames(): string[] {
    return this.orchestrator.providers.map((provider) => provider.name);
  }

  async generateDocumentation(
    input: DocumentationTaskInput,
  ): Promise<StructuredAiResult<ReadmeDraft>> {
    const files = boundFiles(input.files, input.maxContextChars);
    let prompt = buildDocumentationPrompt({
      analysis: input.analysis,
      files: files.files,
      existingReadme: input.existingReadme,
      maintainedSections: input.maintainedSections,
    });
    if (input.validationFeedback && input.validationFeedback.length > 0) {
      prompt += `\n\nA previous attempt at this README failed validation. Fix these problems and return the full corrected JSON object:\n${input.validationFeedback
        .slice(0, 12)
        .map((issue) => `- ${issue}`)
        .join("\n")}`;
    }
    const result = await this.orchestrator.generateStructured(
      { system: SYSTEM_PROMPT, prompt, operation: "generate" },
      readmeDraftSchema,
    );
    return { ...result, warnings: [...result.warnings, ...files.warnings] };
  }

  async generateIncrementalPatch(
    input: IncrementalTaskInput,
  ): Promise<StructuredAiResult<IncrementalPatch>> {
    const files = boundFiles(input.files, input.maxContextChars);
    const prompt = buildIncrementalPrompt({
      analysis: input.analysis,
      files: files.files,
      existingReadme: input.existingReadme,
      changedFiles: input.changedFiles,
      affectedSections: input.affectedSections,
    });
    const result = await this.orchestrator.generateStructured(
      { system: SYSTEM_PROMPT, prompt, operation: "incremental" },
      incrementalPatchSchema,
    );
    return { ...result, warnings: [...result.warnings, ...files.warnings] };
  }

  async cleanupDocumentation(
    input: CleanupTaskInput,
  ): Promise<StructuredAiResult<CleanupProposal>> {
    const files = boundFiles(input.files, Math.floor(input.maxContextChars / 2));
    const prompt = buildCleanupPrompt({
      readme: input.readme,
      analysis: input.analysis,
      files: files.files,
    });
    const result = await this.orchestrator.generateStructured(
      { system: SYSTEM_PROMPT, prompt, operation: "cleanup" },
      cleanupProposalSchema,
    );
    return { ...result, warnings: [...result.warnings, ...files.warnings] };
  }
}

function boundFiles(
  files: FileContext[],
  maxChars: number,
): { files: FileContext[]; warnings: string[] } {
  const warnings: string[] = [];
  const selected: FileContext[] = [];
  let used = 0;
  for (const file of files) {
    const content = truncate(file.content, Math.min(12000, Math.max(1000, maxChars - used)));
    const cost = content.length + file.path.length + 40;
    if (used + cost > maxChars) {
      warnings.push(
        `Repository context was clipped at ${maxChars} characters; ${file.path} and later files were not sent to the model.`,
      );
      break;
    }
    selected.push({ ...file, content });
    used += cost;
  }
  return { files: selected, warnings };
}
