# Deployment

Target topology: Vercel (web), Railway (API + worker + Redis), MongoDB Atlas and
Convex. The repository ships `vercel.json`; `render.yaml` is kept only as an
alternative blueprint and is not used by the Railway path.

## 1. Provision dependencies

1. **MongoDB Atlas** — create a cluster and database user. Use a dedicated database
   (`commitscibble`) and allowlist Railway egress. Railway egress IPs are dynamic
   unless you buy static egress, so most deployments allow `0.0.0.0/0` with a strong
   password, or use private endpoints. A Railway MongoDB template is an alternative;
   use its connection string as `MONGO_URI`.
2. **Redis** — add a Redis database to the Railway project (see section 3). BullMQ
   requires the `noeviction` maxmemory policy, which is the Railway Redis default.
3. **Convex** — optional. `npx convex dev` once locally to create a deployment, then
   `npx convex deploy` for production. Note the deployment URL and set a long random
   `COMMITSCIBBLE_PUBLISH_TOKEN` for both API and worker. Without it the dashboard
   polls instead of using live updates.
4. **GitHub OAuth app** — callback `https://<web-host>/auth/github/callback` when
   using the Vercel proxy (recommended), or
   `https://<api-host>/auth/github/callback` when the API has its own custom domain.
   Homepage `https://<web-host>`.
5. **AI keys** — Gemini and/or Groq. Set model identifiers explicitly.

## 2. Environment

Production minimum. Add these to both Railway services (or as project-level shared
variables where the service can read them):

```
NODE_ENV=production
APP_URL=https://<web-host>
API_URL=https://<api-host>
CORS_ORIGINS=https://<web-host>
MONGO_URI=mongodb+srv://...
REDIS_URL=${{Redis.REDIS_URL}}
SESSION_SECRET=<48+ random chars>
TOKEN_ENCRYPTION_KEY=<base64 32 bytes>
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GITHUB_CALLBACK_URL=https://<web-host>/auth/github/callback
GITHUB_WEBHOOK_SECRET=<random>
# Optional GitHub App (installation-scoped writes)
GITHUB_APP_ID=...
GITHUB_APP_SLUG=...
GITHUB_APP_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
CONVEX_URL=https://<deployment>.convex.cloud
COMMITSCIBBLE_PUBLISH_TOKEN=<random 32+>
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3.5-flash
GROQ_API_KEY=...
GROQ_MODEL=openai/gpt-oss-120b
README_FILE_NAME=README.md
DOC_UPDATE_MODE=REVIEW
```

`AI_ALLOW_MOCK` must stay `false` in production; the config loader refuses mock
providers otherwise. Billing variables are reserved and unused. Email is optional:
set both `RESEND_API_KEY` and `EMAIL_FROM` to enable review-required, applied and
run-failed notifications; leave either empty to disable notifications.

`GEMINI_MODEL` must be a model id that is still served to the key's project. Google
retires ids without notice; a retired id returns HTTP 404 and surfaces as
`AI generation failed: gemini rejected the request`. List what a key can call with:

```bash
curl -sS "https://generativelanguage.googleapis.com/v1beta/models?key=$GEMINI_API_KEY" \
  | jq -r '.models[].name'
```

Set the bare id (for example `gemini-3.5-flash`), never a `models/` prefix. If the
configured id returns 404 or 503, the Gemini provider retries the next known-good
flash id, so a retired default does not stop generation.

Generate secrets with `openssl rand -base64 48` and `openssl rand -base64 32`, or:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Do not set `PORT` on Railway. The platform injects it and the API already reads it.

## 3. Railway

Create a project from the GitHub repository. Railway detects the pnpm workspace
and stages a service per deployable package. Delete the staged `web` service
(Vercel serves it), and keep the API and worker services. If the services are not
staged automatically, create two empty services from the same repository, leave
the root directory at `/`, and configure them manually:

| Setting | API service | Worker service |
| --- | --- | --- |
| Build command | `pnpm build:api` | `pnpm build:worker` |
| Start command | `pnpm start:api` | `pnpm start:worker` |
| Healthcheck | `/ready` | none |
| Public domain | required | none |

The `build:api`/`build:worker` scripts build the service **and** its workspace
dependencies in topological order. Do not replace them with
`pnpm --filter @commitscibble/api build`; that skips `packages/*`, whose `dist`
output the service imports at runtime.

Add a **Redis** database to the project, then reference its URL from both services:

```
REDIS_URL=${{Redis.REDIS_URL}}
```

Set the environment variables from section 2 on both services. The worker needs the
same Mongo, Redis, encryption, GitHub and AI values; it does not need a public
domain. Configure watch paths so unrelated changes do not rebuild both services:

- API: `services/api/**`, `packages/**`
- Worker: `services/worker/**`, `packages/**`

Expose only the API: **Settings → Networking → Public Networking → Generate
Domain**. Use that URL as `<api-host>` everywhere, for example
`https://commitscibble-api-production.up.railway.app`. Verify it with `/health`
and `/ready`.

Index creation runs at API and worker startup, so no separate migration step is
required. `pnpm db:indexes` remains available if you need to create them manually.

## 4. Vercel

Import the repository with the repository root as the project root. `vercel.json`
installs with the lockfile, builds `@commitscibble/shared` and `@commitscibble/web`,
serves `apps/web/dist`, rewrites SPA routes and sets security headers.

> **Do not set `NODE_ENV` in the Vercel project**, and do not paste `.env.example`
> into the dashboard. Vercel sets `NODE_ENV=production` itself. An inherited
> `NODE_ENV=development` makes Vite compile in development mode: the site ships the
> React dev bundle and `import.meta.env.DEV` is `true` at build time, which is how
> `http://localhost:4000` used to end up in a production bundle. `vercel.json` now
> forces `NODE_ENV=production` for install and build and runs
> `scripts/verify-web-build.mjs`, which fails the deployment if the bundle is a
> development build or is missing the runtime localhost guard.

Session cookies are `SameSite=Lax`, so an API on a different registrable domain
(for example a `*.vercel.app` web app with a `*.up.railway.app` API) will not
receive the cookie on cross-site `fetch` calls. Choose **one** of these:

### Option A — proxy the API through Vercel (no custom domain required)

Leave `VITE_API_URL` unset (or remove it from the Vercel project) so production
builds use same-origin requests. Add these rewrites to `vercel.json` before the SPA
fallback:

```json
"rewrites": [
  { "source": "/api/:path*", "destination": "https://<api-host>/api/:path*" },
  { "source": "/auth/:path*", "destination": "https://<api-host>/auth/:path*" },
  { "source": "/(.*)", "destination": "/index.html" }
]
```

Set `GITHUB_CALLBACK_URL=https://<web-host>/auth/github/callback` so GitHub returns
the browser to the web host and the callback cookie stays first-party.

### Option B — custom domain on the same registrable domain

Use `https://app.example.com` and `https://api.example.com`, set
`VITE_API_URL=https://api.example.com`, and set
`GITHUB_CALLBACK_URL=https://api.example.com/auth/github/callback`. Configure
`CORS_ORIGINS=https://app.example.com`.

A rebuild is required after changing Vercel environment variables or
`vercel.json`. Vercel only applies new values to a new deployment.

## 5. GitHub webhook

Repository or organization webhook:

- Payload URL: `https://<api-host>/api/v1/webhooks/github`
- Content type: `application/json`
- Secret: same as `GITHUB_WEBHOOK_SECRET`
- Events: pushes (GitHub sends `ping` on creation; it is acknowledged and ignored)

Point the webhook at the Railway API directly, not the Vercel proxy. Verify with a
test delivery: expect `202`. A `401` means the secret or raw body handling is wrong.

## 6. GitHub App (optional)

Create an app at <https://github.com/settings/apps> with repository permissions
`Contents: read and write`, `Metadata: read`, and the setup URL matching the mode
chosen in section 4: `https://<web-host>/auth/github/app/callback` for the proxy,
or `https://<api-host>/auth/github/app/callback` for a custom domain. Install it on
the repositories you track. Set `GITHUB_APP_ID`, `GITHUB_APP_SLUG` and
`GITHUB_APP_PRIVATE_KEY`; store the PEM with escaped newlines (`\n`) if the platform
collapses multiline values. The API verifies an installation belongs to the
signed-in user before storing it, and repository reads/writes prefer installation
tokens. Without these values the OAuth token is used and the dashboard reports the
app as not configured.

## 7. Post-deploy checks

```bash
curl -fsS https://<api-host>/health
curl -fsS https://<api-host>/ready
curl -fsS https://<api-host>/api/v1/openapi.json > /dev/null
# proxy mode only:
curl -fsS https://<web-host>/api/v1/meta > /dev/null
```

Then sign in, connect a scratch repository, run generation in review mode, inspect
the diff and approve. Check `/dashboard/activity` for the correlated event stream.

## 8. Operations

- **Logs** — structured JSON on stdout with request, run and correlation ids.
  Redaction is applied before emission. Railway captures stdout.
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
- **Scaling** — API is stateless; add replicas behind Railway. Rate limits use a
  shared Redis counter whenever `REDIS_URL` is set, so replicas enforce one budget.
  Worker replicas are safe because job ids and state transitions are atomic.

## 9. Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Connect GitHub opens `localhost` | The Vercel project has `NODE_ENV=development` (or a localhost `VITE_API_URL`). Remove both, then redeploy; the build now fails fast if the bundle is a development build |
| After GitHub sign-in the browser lands on `localhost:5173` | `APP_URL` on the API service is unset or still the localhost default. Set `APP_URL=https://<web-host>`; until then the API derives it from `GITHUB_CALLBACK_URL` in production |
| Build fails with "refusing to ship this bundle" | The bundle was built in development mode or from a stale commit; check the Vercel environment variables and the build log above the error |
| `/ready` 503 | MongoDB or Redis unreachable, or wrong credentials |
| OAuth `state` mismatch | Callback URL or cookie domain misconfigured; cookies blocked cross-site |
| Signed in, then immediately signed out | Web and API are on different registrable domains; use the Vercel proxy or a shared custom domain |
| 403 on mutations | Missing/incorrect `x-csrf-token`, or CORS origin not allowlisted |
| Webhook 401 | Secret mismatch or a proxy altering the raw body |
| Runs stay `QUEUED` | Worker not running or pointed at a different Redis |
| Build cannot find `tsc` | Dev dependencies were skipped; build with `pnpm install --frozen-lockfile --prod=false` before the build script |
| Generation fails with provider error | Missing/invalid key, model id retired, or quota exhausted. A retired Gemini id returns 404 even though it still appears in the model list; set `GEMINI_MODEL` to a currently served id (for example `gemini-3.5-flash`) on **both** the API and worker services |
| "unconfigured" realtime banner | `CONVEX_URL` / publish token absent or mismatched |
| Proposal cannot apply | Branch moved; regenerate the proposal (stale protection) |
| No README commit | Proposal still in review mode, or content was already current |
