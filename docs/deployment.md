# Deployment

Target topology: Vercel (web), Render (API + worker + managed Redis), MongoDB
Atlas, Convex. The repository ships `vercel.json` and `render.yaml`; no secrets are
stored in either.

## 1. Provision dependencies

1. **MongoDB Atlas** — create a cluster and database user. Use a dedicated database
   (`commitscibble`) and allowlist Render egress (or use private endpoints).
2. **Redis** — Render Redis (blueprint) or another managed Redis with `noeviction`
   and persistence enabled. BullMQ requires maxmemory policy `noeviction`.
3. **Convex** — `npx convex dev` once locally to create a deployment, then
   `npx convex deploy` for production. Note the deployment URL and set a long random
   `COMMITSCIBBLE_PUBLISH_TOKEN` for both API and worker.
4. **GitHub OAuth app** — callback
   `https://<api-host>/auth/github/callback`, homepage `https://<web-host>`.
5. **AI keys** — Gemini and/or Groq. Set model identifiers explicitly.

## 2. Environment

Create a Render environment group `commitscibble-secrets` containing the variables
from `.env.example`. Production minimum:

```
NODE_ENV=production
APP_URL=https://<web-host>
API_URL=https://<api-host>
CORS_ORIGINS=https://<web-host>
MONGO_URI=mongodb+srv://...
REDIS_URL=rediss://...
SESSION_SECRET=<48+ random chars>
TOKEN_ENCRYPTION_KEY=<base64 32 bytes>
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GITHUB_CALLBACK_URL=https://<api-host>/auth/github/callback
GITHUB_WEBHOOK_SECRET=<random>
# Optional GitHub App (installation-scoped writes)
GITHUB_APP_ID=...
GITHUB_APP_SLUG=...
GITHUB_APP_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
CONVEX_URL=https://<deployment>.convex.cloud
COMMITSCIBBLE_PUBLISH_TOKEN=<random 32+>
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash
GROQ_API_KEY=...
GROQ_MODEL=openai/gpt-oss-120b
README_FILE_NAME=README.md
DOC_UPDATE_MODE=REVIEW
```

`AI_ALLOW_MOCK` must stay `false` in production; the config loader refuses mock
providers otherwise. Billing variables are reserved and unused. Email is optional:
set both `RESEND_API_KEY` and `EMAIL_FROM` to enable review-required, applied and
run-failed notifications (failure mail is sent at most once per run); leave either
empty to disable notifications without affecting the pipeline.

Generate secrets with `openssl rand -base64 48` and `openssl rand -base64 32`.

## 3. Render

Apply the blueprint (New → Blueprint → repository). It builds shared packages, then
the API and worker, starts `node services/api/dist/server.js` and
`node services/worker/dist/index.js`, and health-checks `/ready` on the API.

Manual equivalent:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm --filter "./packages/**" build
pnpm --filter @commitscibble/api build
pnpm --filter @commitscibble/worker build
```

Both processes need the same `MONGO_URI`, `REDIS_URL`, `TOKEN_ENCRYPTION_KEY`,
GitHub and AI configuration. The worker additionally needs `CONVEX_URL` and the
publish token to deliver realtime events. Scale API and worker independently; the
worker concurrency is bounded by `AI_MAX_CONCURRENCY` and BullMQ worker settings.

After the first deploy, run index creation once from a machine with database access:

```bash
MONGO_URI=... pnpm db:indexes
```

## 4. Vercel

Import the repository with the repository root as the project root. `vercel.json`
installs with the lockfile, builds `@commitscibble/shared` and `@commitscibble/web`,
serves `apps/web/dist`, rewrites SPA routes and sets security headers. Configure:

```
VITE_API_URL=https://<api-host>
VITE_CONVEX_URL=https://<deployment>.convex.cloud
```

`VITE_API_URL` must match the API's `CORS_ORIGINS` and cookie domain expectations.
Cross-site cookies require HTTPS, `SameSite=Lax` and an API on a sibling domain; if
the API is on a different registrable domain, use a custom domain so cookies are
first-party, or the browser will block them.

## 5. GitHub webhook

Repository or organization webhook:

- Payload URL: `https://<api-host>/api/v1/webhooks/github`
- Content type: `application/json`
- Secret: same as `GITHUB_WEBHOOK_SECRET`
- Events: pushes (GitHub sends `ping` on creation; it is acknowledged and ignored)

Verify with a test delivery: expect `202`. A `401` means the secret or raw body
handling is wrong.

## 6. GitHub App (optional)

Create an app at <https://github.com/settings/apps> with repository permissions
`Contents: read and write`, `Metadata: read`, and the setup URL
`https://<api-host>/auth/github/app/callback`. Install it on the repositories you
track. Set `GITHUB_APP_ID`, `GITHUB_APP_SLUG` and `GITHUB_APP_PRIVATE_KEY`; store
the PEM with escaped newlines (`\n`) if the platform collapses multiline values.
The API verifies an installation belongs to the signed-in user before storing it,
and repository reads/writes prefer installation tokens. Without these values the
OAuth token is used and the dashboard reports the app as not configured.

## 7. Post-deploy checks

```bash
curl -fsS https://<api-host>/health
curl -fsS https://<api-host>/ready
curl -fsS https://<api-host>/api/v1/openapi.json > /dev/null
```

Then sign in, connect a scratch repository, run generation in review mode, inspect
the diff and approve. Check `/dashboard/activity` for the correlated event stream.

## 7. Operations

- **Logs** — structured JSON on stdout with request, run and correlation ids.
  Redaction is applied before emission. Render captures stdout.
- **Retries** — failed runs expose `POST /api/v1/runs/:runId/retry` when safe.
  BullMQ retries use exponential backoff; the worker also sweeps stale `RUNNING`
  runs at startup.
- **Backups** — enable Atlas continuous backups and test a restore into a staging
  cluster. Redis holds only transient queues; losing it loses queued work, which
  can be re-enqueued from runs stuck in `QUEUED`/`RETRYING`.
- **Key rotation** — rotate `GITHUB_WEBHOOK_SECRET` by updating both GitHub and the
  environment. Rotate `SESSION_SECRET` to invalidate sessions. Replacing
  `TOKEN_ENCRYPTION_KEY` requires users to reauthorize GitHub. Rotate
  `COMMITSCIBBLE_PUBLISH_TOKEN` in API and worker together; clients refetch
  `/auth/me`.
- **Scaling** — API is stateless; add replicas behind the platform. Rate limits
  use a shared Redis counter whenever `REDIS_URL` is set, so replicas enforce one
  budget; without Redis reachable they fall back to per-process counters. Worker
  replicas are safe because job ids and state transitions are atomic.

## 8. Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| `/ready` 503 | MongoDB or Redis unreachable, or wrong credentials |
| OAuth `state` mismatch | Callback URL or cookie domain misconfigured; cookies blocked cross-site |
| 403 on mutations | Missing/incorrect `x-csrf-token`, or CORS origin not allowlisted |
| Webhook 401 | Secret mismatch or a proxy altering the raw body |
| Runs stay `QUEUED` | Worker not running or pointed at a different Redis |
| Generation fails with provider error | Missing/invalid key, model id retired, or quota exhausted |
| "unconfigured" realtime banner | `CONVEX_URL` / publish token absent or mismatched |
| Proposal cannot apply | Branch moved; regenerate the proposal (stale protection) |
| No README commit | Proposal still in review mode, or content was already current |
