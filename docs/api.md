# API

Base URL: `https://<api-host>`. Versioned routes live under `/api/v1`. The
authoritative OpenAPI 3.0 document is served at `GET /api/v1/openapi.json` and is
generated from `packages/shared/src/openapi.ts`.

## Conventions

- JSON request and response bodies. Responses are `{ "data": ... }` on success and
  `{ "error": { "code", "message", "requestId", "details?" } }` on failure.
- Authentication uses HTTP-only session cookies. Mutating requests must send
  `x-csrf-token`, matching the `cs_csrf` cookie; `/api/v1/auth/me` returns it.
- Pagination: `page` (1-based) and `pageSize` (max 100), returning `items`, `total`,
  `page`, `pageSize`, `hasMore`.
- Validation errors return 422 with field details. Unknown ids return 404.
- Rate limits are per IP/user and return 429 with `Retry-After`.

## Authentication

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/auth/github` | Sets an OAuth state cookie and redirects to GitHub |
| GET | `/auth/github/callback` | Validates state and code, creates a session, redirects to the app |
| GET | `/api/v1/auth/me` | `{ user, csrfToken, realtimeKey, github }` |
| GET | `/api/v1/auth/session` | Session metadata for the current cookie |
| POST | `/api/v1/auth/logout` | Revokes the current session (204) |
| POST | `/api/v1/auth/github/revoke` | Revokes the GitHub grant, all sessions and tracked repositories |

## Repositories

The `:id` path parameter for `connect` is the numeric GitHub repository id. All
other repository routes use the CommitScibble document id.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/v1/repositories` | Accessible repositories merged with tracking state, status and README info |
| POST | `/api/v1/repositories/:id/connect` | Verifies access, stores the repository, seeds settings (201) |
| GET | `/api/v1/repositories/:id` | Repository detail, section map and latest run |
| GET | `/api/v1/repositories/:id/runs` | Paginated runs for one repository |
| PATCH | `/api/v1/repositories/:id/settings` | README path, update mode, branch, ignored paths, provider preference |
| POST | `/api/v1/repositories/:id/tracking` | `{ "status": "CONNECTED" \| "PAUSED" }` |
| POST | `/api/v1/repositories/:id/disconnect` | Stops tracking and removes integration state |
| POST | `/api/v1/repositories/:id/generate` | Full README generation run (202) |
| POST | `/api/v1/repositories/:id/update` | Incremental run against the latest commit (202) |
| POST | `/api/v1/repositories/:id/cleanup` | Cleanup and restructuring run (202) |

## Runs and proposals

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/v1/runs/:runId` | Run detail plus correlated audit events |
| GET | `/api/v1/runs/:runId/proposal` | Proposal, base hash/commit, diff and validation findings |
| POST | `/api/v1/runs/:runId/retry` | Re-enqueues a failed run when the operation is safe (202) |
| POST | `/api/v1/proposals/:proposalId/approve` | Creates an apply run (202); 409 if already decided or stale |
| POST | `/api/v1/proposals/:proposalId/reject` | Records the decision and closes the review |

Approval never writes to GitHub synchronously. The apply worker re-reads the
README, compares it with `baseReadmeHash`, and refuses on drift.

## Activity

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/v1/activity` | Filters: `status`, `operation`, `repositoryId`, `page`, `pageSize` |
| GET | `/api/v1/activity/:logId` | One audit event with job/run context |

Event types: `STARTED`, `PROGRESS`, `SUCCESS`, `FAILED`, `RETRYING`, `CANCELLED`,
`APPROVAL_REQUIRED`, `APPLIED`. Messages are safe, redacted, and ordered by
timestamp; clients refetch this endpoint after reconnecting to recover from missed
events.

## Webhooks, health and metadata

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/v1/webhooks/github` | Requires a valid `X-Hub-Signature-256`; deduplicates deliveries; returns 202 |
| GET | `/health` | Liveness, no dependencies |
| GET | `/ready` | MongoDB and Redis readiness |
| GET | `/api/v1/meta` | Authenticated deployment defaults, provider names, retention, feature flags |
| GET | `/api/v1/openapi.json` | OpenAPI document (public) |

## Billing

Not implemented. No billing routes are registered and no prices, plans or quotas
are advertised. `BILLING_ENABLED` is reserved for a future isolated Razorpay
module; direct API calls cannot bypass quotas because none are enforced.
