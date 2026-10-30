import { z } from "zod";
import { AI_PROVIDER_NAMES, OPERATION_TYPES, SECTION_KEYS, UPDATE_MODES } from "./enums.js";

export const objectIdSchema = z
  .string()
  .regex(/^[a-f0-9]{24}$/i, "Expected a 24 character hex identifier");

export const githubRepoIdSchema = z.coerce.number().int().positive();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const readmePathSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .refine((value) => !value.startsWith("/") && !value.includes(".."), {
    message: "README path must be a relative repository path without '..' segments",
  })
  .refine((value) => /\.(md|markdown|mdx)$/i.test(value), {
    message: "README path must end with .md, .markdown or .mdx",
  });

export const branchNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9._/-]+$/, "Invalid branch name");

export const repoIdParamSchema = z.object({ id: objectIdSchema });
export const runIdParamSchema = z.object({ runId: objectIdSchema });
export const proposalIdParamSchema = z.object({ proposalId: objectIdSchema });
export const logIdParamSchema = z.object({ logId: z.string().min(1).max(80) });

export const repoSettingsUpdateSchema = z
  .object({
    readmePath: readmePathSchema.optional(),
    targetBranch: branchNameSchema.nullable().optional(),
    updateMode: z.enum(UPDATE_MODES).optional(),
    automationEnabled: z.boolean().optional(),
    ignoredPaths: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
    maintainedSections: z.array(z.enum(SECTION_KEYS)).max(SECTION_KEYS.length).optional(),
    commitMessageTemplate: z.string().trim().min(1).max(200).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: "No settings provided" });

export const connectRepositorySchema = z
  .object({
    readmePath: readmePathSchema.optional(),
    updateMode: z.enum(UPDATE_MODES).optional(),
  })
  .strict()
  .default({});

export const disconnectRepositorySchema = z
  .object({
    revokeAuthorization: z.boolean().default(false),
  })
  .strict()
  .default({ revokeAuthorization: false });

export const activityQuerySchema = paginationSchema.extend({
  repositoryId: objectIdSchema.optional(),
  status: z.enum(["ALL", "RUNNING", "SUCCEEDED", "FAILED", "QUEUED", "RETRYING", "CANCELLED"]).optional(),
  type: z.enum(["STARTED", "PROGRESS", "SUCCESS", "FAILED", "RETRYING", "CANCELLED", "APPROVAL_REQUIRED", "APPLIED"]).optional(),
  operation: z.enum(OPERATION_TYPES).optional(),
});

export const runQuerySchema = paginationSchema.extend({
  operation: z.enum(OPERATION_TYPES).optional(),
  status: z
    .enum(["QUEUED", "RUNNING", "SUCCEEDED", "FAILED", "RETRYING", "CANCELLED"])
    .optional(),
});

export const aiSettingsSchema = z
  .object({
    provider: z.enum(AI_PROVIDER_NAMES).optional(),
    model: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

/* -------------------------------------------------------------------------- */
/* Structured AI output contracts                                             */
/* -------------------------------------------------------------------------- */

export const evidencePathSchema = z.string().trim().min(1).max(400);

export const generatedSectionSchema = z.object({
  key: z.enum(SECTION_KEYS),
  heading: z.string().trim().min(1).max(120),
  level: z.number().int().min(2).max(4).default(2),
  body: z.string().min(1),
  evidence: z.array(evidencePathSchema).max(20).default([]),
  warnings: z.array(z.string().max(300)).max(10).default([]),
});

export const readmeDraftSchema = z.object({
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().min(1).max(2000),
  sections: z.array(generatedSectionSchema).min(1).max(20),
  warnings: z.array(z.string().max(300)).max(20).default([]),
});

export const sectionPatchSchema = z.object({
  key: z.enum(SECTION_KEYS),
  heading: z.string().trim().min(1).max(120),
  level: z.number().int().min(2).max(4).default(2),
  body: z.string().min(1),
  explanation: z.string().trim().min(1).max(600),
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
  warnings: z.array(z.string().max(300)).max(10).default([]),
});

export const incrementalPatchSchema = z.object({
  patches: z.array(sectionPatchSchema).max(10),
  summary: z.string().trim().max(1000).default(""),
  warnings: z.array(z.string().max(300)).max(20).default([]),
});

export const cleanupProposalSchema = z.object({
  markdown: z.string().min(1),
  changes: z
    .array(
      z.object({
        summary: z.string().trim().min(1).max(400),
        explanation: z.string().trim().min(1).max(800),
      }),
    )
    .max(30)
    .default([]),
  warnings: z.array(z.string().max(300)).max(20).default([]),
});

export type ReadmeDraft = z.infer<typeof readmeDraftSchema>;
export type GeneratedSection = z.infer<typeof generatedSectionSchema>;
export type SectionPatch = z.infer<typeof sectionPatchSchema>;
export type IncrementalPatch = z.infer<typeof incrementalPatchSchema>;
export type CleanupProposal = z.infer<typeof cleanupProposalSchema>;

/* -------------------------------------------------------------------------- */
/* Webhook payload (only the fields we rely on are validated)                 */
/* -------------------------------------------------------------------------- */

export const pushWebhookSchema = z.object({
  ref: z.string().min(1),
  before: z.string().min(7),
  after: z.string().min(7),
  created: z.boolean().optional(),
  deleted: z.boolean().optional(),
  forced: z.boolean().optional(),
  repository: z.object({
    id: z.number().int(),
    name: z.string(),
    full_name: z.string(),
    private: z.boolean().optional(),
    default_branch: z.string().optional(),
    owner: z.object({ login: z.string() }).optional(),
  }),
  installation: z.object({ id: z.number().int() }).optional(),
  commits: z
    .array(
      z.object({
        id: z.string(),
        message: z.string().default(""),
        added: z.array(z.string()).default([]),
        removed: z.array(z.string()).default([]),
        modified: z.array(z.string()).default([]),
      }),
    )
    .max(200)
    .default([]),
  head_commit: z
    .object({
      id: z.string(),
      message: z.string().default(""),
    })
    .nullable()
    .optional(),
});

export type PushWebhookPayload = z.infer<typeof pushWebhookSchema>;
