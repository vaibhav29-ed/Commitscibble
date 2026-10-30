# Architecture

## Components

| Component | Runtime | Responsibility |
| --- | --- | --- |
| `apps/web` | Browser | Landing page, dashboard, repository settings, review diff, live activity |
| `services/api` | Node 20 / Express 5 | OAuth, sessions, CSRF, repositories, run creation, proposals, activity, webhook intake |
| `services/worker` | Node 20 / BullMQ | Generation, incremental patching, cleanup, apply, webhook processing, recovery |
| MongoDB | Managed | Authoritative users, repositories, runs, proposals, section maps, audit, deliveries, sessions |
| Redis | Managed | BullMQ queues, rate-limit counters, API readiness check |
| Convex | Managed | Read-only realtime projection of audit events |
| GitHub | External | OAuth identity, repository metadata, trees/blobs, diffs, commits |
| AI providers | External | Gemini primary, Groq fallback, mock for local development |

The API never performs long AI or GitHub work inline. It writes a run, enqueues a
job with a deterministic job id, and returns `202`. The worker owns state
transitions and GitHub writes.

## Generation flow

1. `POST /api/v1/repositories/:id/generate` validates ownership and tracking state,
   creates a `DocumentationRun` (`QUEUED`), writes a `STARTED` audit event and
   enqueues `doc.generate`.
2. The worker claims the run with an atomic `QUEUED|RETRYING -> RUNNING` update,
   loads the repository and refreshes its GitHub token from encrypted storage.
3. It reads the default branch head, fetches the tree, filters the inventory
   (manifests, entry points, CI, env examples, source, tests, docs; excludes build
   output, dependencies, binaries, real env values and secrets), and enforces a
   context budget.
4. Manifests are parsed to facts: package scripts, dependency stacks, Python
   requirements/pyproject, Docker/Compose, CI workflows, env variable names.
5. `packages/ai-engine` asks the primary provider for schema-validated structured
   output. On timeout, rate limit or 5xx it retries with jitter, then falls back to
   the next provider. Invalid requests and auth failures are not retried.
6. `packages/documentation-engine` assembles a README deterministically from the
   validated model output, then validates commands, paths, env names, links,
   duplicate headings and unsupported claims against the inventory.
7. The proposal is stored with `baseReadmeHash`, `baseCommitSha`, diff and
   validation findings. In review mode the repository becomes `PENDING_REVIEW`; in
   automatic mode an apply job is enqueued immediately.

## Incremental flow

1. `POST /api/v1/webhooks/github` verifies `X-Hub-Signature-256` against the raw
   body with a constant-time comparison, deduplicates on `X-GitHub-Delivery`, and
   enqueues `github.webhook` with the delivery id.
2. The worker checks the event is a push on the tracked branch, the repository is
   connected and not paused, and the after-SHA differs from the last processed SHA.
3. Docs commits created by CommitScibble are recognised by marker and by recorded
   apply SHA, so the pipeline does not loop on its own output.
4. `compareCommits` produces changed paths; missing base commits or force pushes
   downgrade to a bounded resynchronisation/full generation instead of guessing.
5. `impact.ts` maps changes to README sections using path classes (manifest, env
   example, route file, CI, docs, license) and the persisted section-to-source map.
   Content hashes decide whether a mapped section's sources actually changed;
   hashes alone never decide semantics.
6. Only impacted sections are regenerated. Unchanged sections (including
   hand-written prose) are carried over verbatim. Uncertain mappings produce a
   review flag, not an invented edit.
7. Validation runs, a unified diff is produced, and the proposal is applied
   automatically or queued for review. `lastProcessedCommitSha` advances only after
   a successful apply or a no-op, never merely because a job ran.

## Apply and concurrency

Apply jobs re-fetch the README from the configured branch and compare
`hashContent(current)` with the proposal's `baseReadmeHash`.

- If the README moved, the proposal is marked `STALE`, the run fails with a 409
  style error and the user is asked to regenerate. Nothing is overwritten.
- If the proposed content equals current content, no commit is created.
- Otherwise the worker writes through the Contents API with the blob SHA it just
  read, so GitHub rejects a concurrent change. The resulting commit SHA is stored.
- Proposal status transitions are conditional (`PENDING -> APPROVED`), preventing
  double approval from creating two commits.
- Jobs are idempotent: deterministic job ids, delivery deduplication, active-run
  deduplication and a recorded `appliedCommitSha` guard retries.

## Realtime and the outbox

Every authoritative state change writes an audit document in MongoDB. The audit
collection doubles as the outbox: each event carries delivery state
(`PENDING/DELIVERED/FAILED`) and a read key for Convex. The publisher (API for
fast feedback, worker after pipeline steps) forwards events and marks them
delivered; failures are retried by a scheduled delivery-recovery job rather than
dropped. Audit writes never fail a run.

Convex stores only a safe projection: id, correlation id, user, repository, type,
message, timestamp. No tokens, file contents, prompts or diffs are published.
Clients subscribe with a hashed read key derived from the publish token; `/auth/me`
returns it only to the authenticated user. If Convex is not configured, the client
polls `/api/v1/activity`, and reconnection always refetches persisted history so
out-of-order or missed events self-heal.

## Job state machine

```
QUEUED -> RUNNING -> SUCCEEDED
              |  \-> FAILED -> RETRYING -> RUNNING
              \-> CANCELLED (not exposed for in-flight runs)
```

Legal transitions are enforced in the persistence layer. Retries increment
`attempts`, keep the same run and correlation id, use exponential backoff, and are
bounded. On startup the worker detects `RUNNING` runs older than
`STALE_RUN_MINUTES` and marks them failed (or requeues only when the operation is
safe), so an interrupted process cannot leave a permanently spinning UI.

## Data model

| Collection | Key fields and indexes |
| --- | --- |
| `users` | unique `githubId`, login, email, encrypted token record, status, timestamps |
| `repositories` | unique `(userId, githubRepoId)`, owner/name, default branch, tracking status, README path, update mode, settings, last processed SHA, last successful run |
| `documentationruns` | run id, user, repository, operation, status, base/target SHA, provider/model, timings, safe error, proposal ref, applied SHA, correlation id; indexes on `(repositoryId, createdAt)` and status |
| `documentationproposals` | run, repository, base hash, base commit, proposed content, diff, validation, status, reviewer/decision, applied SHA; unique per run |
| `readmesections` | `(repositoryId, sectionId)` unique, source paths, content hashes, verified SHA, updatedAt |
| `auditlogs` | log id, correlation id, job/run, user, repository, type, status, safe message, delivery state; indexes for activity feeds and outbox sweeps |
| `webhookdeliveries` | unique delivery id, repository, event, status, timestamps; TTL by retention |
| `sessions` | hashed token, user, CSRF secret, expiry, revokedAt; TTL index |

Proposals keep the proposed content (bounded) rather than entire repositories or
prompts. Audit and delivery records expire per `AUDIT_RETENTION_DAYS` and
`WEBHOOK_RETENTION_DAYS`.

## Design decisions

- **Deterministic assembly around the model.** The model supplies structured
  section content and evidence; code assembles the document, owns section
  boundaries and validates claims. This keeps diffs stable and removes whole
  categories of hallucinated structure.
- **MongoDB as the source of truth, Convex as a projection.** Realtime is
  best-effort and replayable; correctness never depends on a subscription.
- **No GitHub App in this build.** OAuth is simpler to operate and sufficient for
  per-user repository access; installation tokens remain the documented next step.
- **Provider-neutral AI layer.** Prompts and schemas live in one package; adding a
  provider means implementing one interface and registering it.
- **Safe defaults.** Review mode, no silent README overwrite, no commit on no-op,
  redaction at log boundaries and refusal to run destructive cleanup when the
  document cannot be parsed.
