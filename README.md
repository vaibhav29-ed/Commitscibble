# CommitScibble
<<<<<<< HEAD

<p align="center">
  <img src="apps/web/public/brand/logo.png" alt="CommitScibble logo" width="140" />
</p>

**Your code evolves. Your docs follow.**

CommitScibble is a GitHub documentation automation service. It reads a repository's
real files, drafts a README that is grounded in those files, then keeps that README
in step with future commits by proposing targeted section updates instead of
rewriting the whole document.

It is a working application: GitHub OAuth, repository discovery, background
generation, incremental patching, cleanup, review/approval, live activity and an
audit trail are implemented. Where an external credential is missing the affected
integration is reported as unconfigured rather than faked.

## What it does

- **Connect GitHub** with OAuth and account-scoped sessions. Tokens are encrypted
  with AES-256-GCM and never leave the server.
- **Generate a README** from a filtered repository inventory: manifests, source
  files, CI, environment examples, tests and existing docs. The generated
  instructions are validated against the files that were actually read, and the
  evidence each section cites is checked against the inventory; an invented path
  triggers one repair pass before a proposal is created.
- **Update incrementally** on push. Changed paths are classified by documentation
  impact, only affected README sections are regenerated, and unrelated sections are
  preserved byte-for-byte.
- **Clean up** an existing README: duplicate headings, contradictory sections,
  stale commands and filler are proposed as a reviewable diff.
- **Review before applying** (default) or apply automatically. Automatic apply is
  withheld when the change was classified as needing review or the model reported
  low confidence, and the proposal is queued instead. Proposals store the base
  README hash and base commit; if the branch moved, the apply step refuses and
  marks the proposal stale instead of overwriting newer work.
- **Watch it happen live** with a Convex-backed activity stream. MongoDB is the
  authoritative record; a transactional outbox in the audit collection makes
  realtime delivery retryable, and the UI falls back to persisted history.
- **Inspect everything** through per-repository run history, correlated audit logs,
  developer-readable error details and safe retries.

## Architecture

```
apps/web (React 19 + Vite)          Convex (realtime read model)
        |                                   ^
        | REST + cookies                    | outbox publisher
        v                                   |
services/api (Express 5) ------------------+
        |  enqueue                        |
        v                                 |
Redis + BullMQ queues                     |
        |                                 |
        v                                 |
services/worker --------------------------+
   |        |             |
   |        |             +--> GitHub REST/Git Data API
   |        +----------------> AI providers (Gemini, Groq, fallback chain)
   +-------------------------> MongoDB (authoritative state, audit, proposals)
```

Packages:

| Path | Responsibility |
| --- | --- |
| `apps/web` | Dashboard, review UI, public landing page |
| `services/api` | OAuth, sessions, repositories, runs, proposals, activity, webhooks |
| `services/worker` | Generation, incremental patching, cleanup, apply, recovery |
| `packages/shared` | Contracts, Zod schemas, enums, diff/markdown/redaction helpers, OpenAPI |
| `packages/config` | Startup environment validation and configuration |
| `packages/github` | OAuth client, REST/tree/blob access, webhook signature verification |
| `packages/ai-engine` | Provider-agnostic structured output, prompts, fallback policy |
| `packages/documentation-engine` | Inventory, manifests, section mapping, validation, README assembly, impact |
| `packages/persistence` | Mongoose models, repositories, audit outbox, Convex publisher |
| `convex` | Realtime schema, publish mutation and read query |

See [docs/architecture.md](docs/architecture.md) for request flows, data model and
failure handling, [docs/security.md](docs/security.md) for the threat model, and
[docs/api.md](docs/api.md) for the HTTP contract.

## Quick start

Prerequisites: Node.js >= 20.12, pnpm 10 (`npm install -g pnpm@10` or
`corepack enable`), Docker (for local MongoDB and Redis), and a GitHub OAuth app.
This is a pnpm workspace: `npm install` is not supported.

```bash
cp .env.example .env                # PowerShell: Copy-Item .env.example .env
# Fill SESSION_SECRET (48 random bytes, base64) and TOKEN_ENCRYPTION_KEY (32 random bytes, base64)
docker compose up -d                # MongoDB 7 + Redis 7
pnpm install --frozen-lockfile
pnpm db:indexes                     # create MongoDB indexes
pnpm dev                            # API :4000, worker, web :5173
```

The repository `.env` is loaded automatically by `@commitscibble/config` for local
runs; real environment variables take precedence. Generate the two secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Open http://localhost:5173. `GET /health` is liveness, `GET /ready` checks MongoDB
and Redis.

Without Docker, you can still run the web app on its own
(`pnpm --filter @commitscibble/web dev`), which serves the landing page and docs.
The API, worker and `pnpm db:indexes` require reachable MongoDB and Redis
instances. `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` and `pnpm e2e`
need no infrastructure; `pnpm e2e` starts the web dev server itself.

### GitHub OAuth app

Create an OAuth app at <https://github.com/settings/developers>:

- Homepage: `http://localhost:5173`
- Callback: `http://localhost:4000/auth/github/callback`

Set `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` and `GITHUB_CALLBACK_URL`. The app
requests `read:user`, `user:email` and `repo` (needed to read and write README files
in private repositories you grant).

Optionally create a GitHub App for installation-scoped repository access: set
`GITHUB_APP_ID`, `GITHUB_APP_SLUG` and `GITHUB_APP_PRIVATE_KEY`, and use
`<API_URL>/auth/github/app/callback` as the setup URL. When configured, reads and
writes for repositories covered by the installation use short-lived installation
tokens; OAuth remains the identity and repository-listing path.

### Webhooks

Add a repository or organization webhook to
`https://<api-host>/api/v1/webhooks/github` with content type `application/json`,
the push event, and the secret in `GITHUB_WEBHOOK_SECRET`. Deliveries are verified
with HMAC-SHA256 over the raw body, deduplicated by `X-GitHub-Delivery`, and only
repositories that are connected and actively tracked enqueue work.

### AI providers

`AI_PROVIDER_PRIMARY=gemini` and `AI_PROVIDER_FALLBACK=groq` by default. Set
`GEMINI_API_KEY`/`GEMINI_MODEL` and `GROQ_API_KEY`/`GROQ_MODEL`. Model identifiers
are environment configuration, not compiled-in constants. The default Gemini id is
`gemini-3.5-flash`; Google retires ids without notice, and a retired id fails with
`AI generation failed: gemini rejected the request`. Check the ids a key can call
with `GET https://generativelanguage.googleapis.com/v1beta/models` and update
`GEMINI_MODEL` on both the API and worker. Timeouts, bounded retries
with jitter, rate-limit handling, concurrency limits and provider fallback live in
`packages/ai-engine`; usage records (provider, model, attempt, latency) are stored
per run.

A deterministic mock provider exists for local development only. It requires
`AI_ALLOW_MOCK=true`, is refused in production, and is labelled as mock in the UI
and audit trail.

### Realtime (optional)

Create a Convex deployment, then set `CONVEX_URL` and a shared
`COMMITSCIBBLE_PUBLISH_TOKEN` for both API and worker. Deploy `convex/` with
`npx convex deploy`. Without these values the dashboard polls the API and the
activity stream says so; nothing is fabricated.

## Configuration

All variables are documented in [.env.example](.env.example). The API and worker
call `loadEnv()` at startup and fail with a list of missing or invalid variables
instead of booting half-configured.

Required in production: `NODE_ENV`, `APP_URL`, `API_URL`, `MONGO_URI`,
`REDIS_URL`, `SESSION_SECRET` (32+ chars), `TOKEN_ENCRYPTION_KEY` (base64 32 bytes),
`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_CALLBACK_URL`,
`GITHUB_WEBHOOK_SECRET`, and at least one AI provider key unless a mock is
explicitly allowed. Optional: Convex, Razorpay (reserved), Resend (reserved),
retention windows, README defaults and `CORS_ORIGINS`.

## API

Versioned under `/api/v1`, JSON responses, cookie sessions plus an `x-csrf-token`
header for mutating requests. The served contract is available at
`/api/v1/openapi.json`; a human-readable summary is in [docs/api.md](docs/api.md).

```
GET    /auth/github                     start OAuth (state cookie)
GET    /auth/github/callback            verify state, exchange code, create session
GET    /auth/github/app/callback       verify and store a GitHub App installation
GET    /api/v1/auth/me                  current user + CSRF token + realtime key
POST   /api/v1/auth/logout              revoke session
POST   /api/v1/auth/github/revoke       revoke GitHub grant, sessions and repositories
GET    /api/v1/repositories             accessible repositories with tracking state
POST   /api/v1/repositories/:id/connect connect by GitHub repository id
GET    /api/v1/repositories/:id         repository detail
PATCH  /api/v1/repositories/:id/settings
POST   /api/v1/repositories/:id/tracking {status: CONNECTED|PAUSED}
POST   /api/v1/repositories/:id/disconnect
POST   /api/v1/repositories/:id/generate|update|cleanup
GET    /api/v1/repositories/:id/runs
GET    /api/v1/runs/:runId              run + correlated events
GET    /api/v1/runs/:runId/proposal
POST   /api/v1/runs/:runId/retry
POST   /api/v1/runs/:runId/cancel        cancel a queued or running run
POST   /api/v1/proposals/:proposalId/approve|reject
GET    /api/v1/activity                 filters: status, operation, repositoryId, page
GET    /api/v1/activity/:logId
POST   /api/v1/webhooks/github          HMAC-verified, deduplicated
GET    /health | /ready | /api/v1/meta | /api/v1/openapi.json
```

## Scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | API, worker and web in parallel |
| `pnpm build` | Build every workspace (topological) |
| `pnpm typecheck` | Node workspaces and web |
| `pnpm lint` | ESLint (flat config) |
| `pnpm test` | Vitest unit + integration suite |
| `pnpm test:coverage` | Test suite with coverage thresholds |
| `pnpm e2e` | Playwright public-surface smoke tests |
| `pnpm db:indexes` | Create MongoDB indexes |

## Testing

`pnpm test` runs 155 tests across 21 files: hashing and normalisation, diff and
section mapping, changed-file classification, proposal validation, cleanup guards,
provider fallback, webhook signatures, GitHub App JWT signing and installation
token caching, session/CSRF/permission middleware, API route contracts, run
cancellation, rate limiting, email delivery and templates, README assembly,
incremental impact, plus a React component test.
`pnpm test:coverage` enforces the committed coverage floor (statements/lines 33%,
functions 45%, branches 68%). External services are mocked in tests; no
real repository or credential is required.

`pnpm e2e` runs public-page smoke tests against the Vite server. The authenticated
lifecycle spec is opt-in (`E2E_LIVE=1` with a prepared API, worker, MongoDB, Redis
and a stub GitHub server) and skips rather than pretending to pass. Install
browsers once with `npx playwright install chromium`.

## Deployment

The frontend deploys to Vercel (`vercel.json`), the API and worker to Railway
(with Redis as a Railway database), MongoDB to Atlas, and realtime to Convex.
Full instructions, including the Vercel API proxy needed to keep session cookies
first-party, webhook and OAuth production URLs, backups and troubleshooting, are
in [docs/deployment.md](docs/deployment.md).

## Limitations (current build)

- GitHub sign-in uses an OAuth app. The optional GitHub App provides
  installation-scoped tokens for repository writes when `GITHUB_APP_*` is set;
  without it, writes use the OAuth token and its broad `repo` scope.
- Billing is intentionally not implemented: no paid plans, prices, checkout or
  quota enforcement are exposed, and `BILLING_ENABLED` remains `false`.
- Transactional email notifications (review required, documentation applied, run
  failed) are best-effort. They activate only when both `RESEND_API_KEY` and
  `EMAIL_FROM` are set; delivery failures are logged and never fail a run.
- Retrieval is path/manifest/priority based with hard context budgets. Embeddings
  are not used; large monorepos may need deeper selection.
- Realtime requires a Convex deployment. Without one the dashboard polls persisted
  state.
- The full lifecycle Playwright spec requires a prepared environment and does not
  run in the default suite.

## License

MIT — see [LICENSE](LICENSE).
=======
Soon To Announce 
>>>>>>> 9a4bd917f5b6947a0d418083926b8d69fcee09d3
