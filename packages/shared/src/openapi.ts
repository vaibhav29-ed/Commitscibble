const errorResponse = {
  description: "Error",
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/ApiError" },
    },
  },
};

const repoIdParam = {
  name: "id",
  in: "path" as const,
  required: true,
  schema: { type: "string", pattern: "^[a-f0-9]{24}$" },
  description: "CommitScibble repository identifier",
};

const runIdParam = {
  name: "runId",
  in: "path" as const,
  required: true,
  schema: { type: "string", pattern: "^[a-f0-9]{24}$" },
};

const proposalIdParam = {
  name: "proposalId",
  in: "path" as const,
  required: true,
  schema: { type: "string", pattern: "^[a-f0-9]{24}$" },
};

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "CommitScibble API",
    version: "1.0.0",
    description:
      "AI-powered GitHub documentation automation. All /api/v1 routes require a session cookie. " +
      "Mutating requests additionally require the X-CSRF-Token header matching the cs_csrf cookie. " +
      "The GitHub webhook endpoint is authenticated with an HMAC signature instead.",
  },
  servers: [{ url: "/", description: "Same origin" }],
  components: {
    securitySchemes: {
      sessionCookie: { type: "apiKey", in: "cookie", name: "cs_session" },
      csrfHeader: { type: "apiKey", in: "header", name: "X-CSRF-Token" },
    },
    schemas: {
      ApiError: {
        type: "object",
        required: ["error", "requestId"],
        properties: {
          error: {
            type: "object",
            required: ["code", "message"],
            properties: {
              code: { type: "string" },
              message: { type: "string" },
              details: { type: "object", additionalProperties: true },
            },
          },
          requestId: { type: "string" },
        },
      },
      Repository: {
        type: "object",
        properties: {
          id: { type: "string" },
          githubRepoId: { type: "integer" },
          owner: { type: "string" },
          name: { type: "string" },
          defaultBranch: { type: "string" },
          private: { type: "boolean" },
          trackingStatus: { type: "string", enum: ["CONNECTED", "PAUSED", "DISCONNECTED"] },
          documentationStatus: {
            type: "string",
            enum: ["NONE", "CURRENT", "STALE", "PENDING_REVIEW"],
          },
          lastProcessedCommitSha: { type: "string", nullable: true },
          lastSuccessfulRunAt: { type: "string", nullable: true },
        },
      },
      Run: {
        type: "object",
        properties: {
          id: { type: "string" },
          repositoryId: { type: "string" },
          operation: {
            type: "string",
            enum: ["GENERATE", "INCREMENTAL_UPDATE", "CLEANUP", "RESYNC", "PROPOSAL_APPLY"],
          },
          status: {
            type: "string",
            enum: ["QUEUED", "RUNNING", "SUCCEEDED", "FAILED", "RETRYING", "CANCELLED"],
          },
          proposalId: { type: "string", nullable: true },
          appliedCommitSha: { type: "string", nullable: true },
          correlationId: { type: "string" },
        },
      },
      Proposal: {
        type: "object",
        properties: {
          id: { type: "string" },
          runId: { type: "string" },
          status: {
            type: "string",
            enum: ["PENDING", "APPROVED", "REJECTED", "APPLIED", "STALE"],
          },
          summary: { type: "string" },
          additions: { type: "integer" },
          deletions: { type: "integer" },
        },
      },
      ActivityEvent: {
        type: "object",
        properties: {
          eventId: { type: "string" },
          logId: { type: "string" },
          type: {
            type: "string",
            enum: [
              "STARTED",
              "PROGRESS",
              "SUCCESS",
              "FAILED",
              "RETRYING",
              "CANCELLED",
              "APPROVAL_REQUIRED",
              "APPLIED",
            ],
          },
          message: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
    },
  },
  security: [{ sessionCookie: [] }],
  paths: {
    "/health": {
      get: {
        summary: "Liveness probe",
        security: [],
        responses: { "200": { description: "Process is alive" } },
      },
    },
    "/ready": {
      get: {
        summary: "Readiness probe (MongoDB + Redis)",
        security: [],
        responses: {
          "200": { description: "Dependencies reachable" },
          "503": { description: "Dependency unavailable" },
        },
      },
    },
    "/auth/github": {
      get: {
        summary: "Begin GitHub OAuth",
        security: [],
        parameters: [
          { name: "redirect", in: "query", schema: { type: "string" }, required: false },
        ],
        responses: { "302": { description: "Redirect to GitHub" } },
      },
    },
    "/auth/github/callback": {
      get: {
        summary: "GitHub OAuth callback",
        security: [],
        parameters: [
          { name: "code", in: "query", schema: { type: "string" } },
          { name: "state", in: "query", schema: { type: "string" } },
          { name: "error", in: "query", schema: { type: "string" } },
        ],
        responses: { "302": { description: "Redirect to app with session cookie" } },
      },
    },
    "/api/v1/auth/me": {
      get: {
        summary: "Current session user",
        responses: {
          "200": { description: "Authenticated user" },
          "401": errorResponse,
        },
      },
    },
    "/api/v1/auth/logout": {
      post: {
        summary: "Revoke current session",
        responses: { "204": { description: "Session revoked" } },
      },
    },
    "/api/v1/auth/github/revoke": {
      post: {
        summary: "Revoke the GitHub authorization, end all sessions and disconnect repositories",
        responses: { "200": { description: "Authorization revoked" } },
      },
    },
    "/api/v1/meta": {
      get: {
        summary: "Safe deployment configuration (no secrets)",
        responses: { "200": { description: "Defaults, provider names, retention and feature flags" } },
      },
    },
    "/api/v1/repositories": {
      get: {
        summary: "Connected repositories with availability state",
        responses: { "200": { description: "Repository list" }, "401": errorResponse },
      },
    },
    "/api/v1/repositories/{id}/connect": {
      post: {
        summary: "Connect a repository by GitHub repository id",
        description:
          "The id is the numeric GitHub repository id. Access is verified against the " +
          "authenticated user's GitHub permissions before connecting.",
        parameters: [{ ...repoIdParam, description: "GitHub repository id" }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  readmePath: { type: "string" },
                  updateMode: { type: "string", enum: ["AUTOMATIC", "REVIEW"] },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Connected" }, "403": errorResponse },
      },
    },
    "/api/v1/repositories/{id}": {
      get: {
        summary: "Repository detail including settings and latest runs",
        parameters: [repoIdParam],
        responses: { "200": { description: "Repository" }, "404": errorResponse },
      },
    },
    "/api/v1/repositories/{id}/settings": {
      patch: {
        summary: "Update repository documentation settings",
        parameters: [repoIdParam],
        responses: { "200": { description: "Updated" }, "422": errorResponse },
      },
    },
    "/api/v1/repositories/{id}/tracking": {
      post: {
        summary: "Pause or resume webhook-driven tracking",
        parameters: [repoIdParam],
        requestBody: {
          content: {
            "application/json": {
              schema: { type: "object", required: ["status"], properties: { status: { type: "string", enum: ["CONNECTED", "PAUSED"] } } },
            },
          },
        },
        responses: { "200": { description: "Tracking updated" }, "404": errorResponse },
      },
    },
    "/api/v1/repositories/{id}/disconnect": {
      post: {
        summary: "Disconnect repository and optionally revoke the GitHub authorization",
        parameters: [repoIdParam],
        responses: { "200": { description: "Disconnected" } },
      },
    },
    "/api/v1/repositories/{id}/generate": {
      post: {
        summary: "Queue a full README generation run",
        parameters: [repoIdParam],
        responses: { "202": { description: "Run queued" }, "409": errorResponse },
      },
    },
    "/api/v1/repositories/{id}/update": {
      post: {
        summary: "Queue an incremental update against the latest commit",
        parameters: [repoIdParam],
        responses: { "202": { description: "Run queued" } },
      },
    },
    "/api/v1/repositories/{id}/cleanup": {
      post: {
        summary: "Queue a README cleanup run",
        parameters: [repoIdParam],
        responses: { "202": { description: "Run queued" } },
      },
    },
    "/api/v1/repositories/{id}/runs": {
      get: {
        summary: "Runs for a repository",
        parameters: [
          repoIdParam,
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "pageSize", in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: { "200": { description: "Paginated runs" } },
      },
    },
    "/api/v1/runs/{runId}": {
      get: {
        summary: "Run detail with audit events",
        parameters: [runIdParam],
        responses: { "200": { description: "Run" }, "404": errorResponse },
      },
    },
    "/api/v1/runs/{runId}/proposal": {
      get: {
        summary: "Proposal for a run, including unified diff",
        parameters: [runIdParam],
        responses: { "200": { description: "Proposal" }, "404": errorResponse },
      },
    },
    "/api/v1/runs/{runId}/retry": {
      post: {
        summary: "Retry or regenerate a failed run",
        parameters: [runIdParam],
        responses: { "202": { description: "New run queued" }, "409": errorResponse },
      },
    },
    "/api/v1/runs/{runId}/cancel": {
      post: {
        summary: "Cancel a queued or running documentation run",
        parameters: [runIdParam],
        responses: { "200": { description: "Run cancelled" }, "409": errorResponse },
      },
    },
    "/api/v1/proposals/{proposalId}/approve": {
      post: {
        summary: "Approve a pending proposal and apply it to the target branch",
        parameters: [proposalIdParam],
        responses: { "202": { description: "Apply queued" }, "409": errorResponse },
      },
    },
    "/api/v1/proposals/{proposalId}/reject": {
      post: {
        summary: "Reject a pending proposal",
        parameters: [proposalIdParam],
        responses: { "200": { description: "Rejected" } },
      },
    },
    "/api/v1/activity": {
      get: {
        summary: "Persisted activity/audit history",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "pageSize", in: "query", schema: { type: "integer", default: 20 } },
          { name: "repositoryId", in: "query", schema: { type: "string" } },
          { name: "status", in: "query", schema: { type: "string" } },
        ],
        responses: { "200": { description: "Paginated activity" } },
      },
    },
    "/api/v1/activity/{logId}": {
      get: {
        summary: "Single audit event",
        parameters: [{ name: "logId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Audit event" }, "404": errorResponse },
      },
    },
    "/api/v1/webhooks/github": {
      post: {
        summary: "GitHub webhook receiver",
        security: [],
        description:
          "Verifies X-Hub-Signature-256 with HMAC-SHA256 over the raw body and deduplicates by delivery id.",
        responses: {
          "202": { description: "Accepted" },
          "401": { description: "Invalid signature" },
        },
      },
    },
    "/api/v1/openapi.json": {
      get: { summary: "This document", security: [], responses: { "200": { description: "OpenAPI" } } },
    },
  },
} as const;

export type OpenApiDocument = typeof openApiDocument;
