# Security and privacy

## Authentication and sessions

- GitHub OAuth with a random `state` stored in a short-lived, HTTP-only,
  SameSite=Lax cookie and compared on callback. Denied authorization and invalid
  callbacks produce explicit errors, not a session.
- Session tokens are random 32-byte values stored only as SHA-256 hashes. The cookie
  is HTTP-only, SameSite=Lax, `Secure` in production, with an expiry enforced in
  MongoDB and a TTL index for cleanup. Logout revokes the session server-side;
  `POST /api/v1/auth/github/revoke` revokes the GitHub grant and all user sessions.
- Cookie-authenticated mutations require the `x-csrf-token` header to match the
  `cs_csrf` cookie using a constant-time comparison. The token is issued with the
  session and returned by `/api/v1/auth/me`.
- Authorization is per resource: every repository, run, proposal and audit query is
  scoped by the authenticated user id. Unknown ids return 404, not 403, to avoid
  leaking existence.

## GitHub credentials

- Access tokens are encrypted with AES-256-GCM and a random IV per record; only the
  ciphertext, IV and auth tag are stored. `TOKEN_ENCRYPTION_KEY` is a base64 32-byte
  key supplied by the environment, never by the database or source control.
- When the optional GitHub App is configured, repository reads and writes use
  short-lived installation tokens minted from an RS256 App JWT. Tokens are cached
  in memory until shortly before expiry and never stored in MongoDB or returned to
  the browser. Installation ids are verified against the user's GitHub
  installations before being stored.
- Tokens are decrypted only inside the API/worker process for GitHub calls. They are
  never returned to the browser, written to audit records, included in errors, or
  logged.
- Reauthorization replaces the stored token. Replacing the encryption key makes old
  ciphertext unreadable; reconnect/reauthorize after rotation.
- Repository connect requests use the GitHub repository id and are verified against
  the user's accessible repositories before anything is stored. Client-supplied
  owner/name is never trusted directly.
- Disconnect deletes proposals, section mappings and tracking configuration for that
  repository and optionally revokes the GitHub grant; account revocation removes
  all integration state.

## Webhooks

- `X-Hub-Signature-256` is verified with HMAC-SHA256 over the exact raw body and a
  constant-time comparison. The raw body is captured before JSON parsing.
- Deliveries are deduplicated on `X-GitHub-Delivery` with a unique index, so a
  replay cannot create a second job.
- Only push events for connected, unpaused repositories on the tracked branch are
  processed. Events caused by CommitScibble's own commits are ignored by marker and
  recorded commit SHA, preventing loops.
- Invalid signatures return 401; duplicate deliveries return 202 without work.

## AI and prompt injection

Repository files, READMEs and commit messages are untrusted input. The AI layer:

- keeps system policy and task instructions separate from repository context, and
  explicitly treats embedded instructions as data;
- never gives the model tool access, shell execution, GitHub write capability or
  secret material;
- validates all output against a Zod schema before use, and never executes generated
  commands or code;
- sends only the selected, size-bounded context required for the task and applies
  secret redaction patterns to context and logs;
- records provider, model, attempts and latency, but not API keys or full prompts.

Model output is advisory. README writes happen only through the deterministic apply
pipeline, after validation, with the user's configured mode and branch.

## Data minimisation and retention

- Only metadata, selected file excerpts, generated proposals and audit events are
  stored. Full repositories, raw webhook payloads and full prompts are not retained.
- Audit events expire after `AUDIT_RETENTION_DAYS` (default 90) and webhook delivery
  records after `WEBHOOK_RETENTION_DAYS` (default 30).
- Audit messages are developer-readable but redacted: tokens, keys, passwords,
  bearer headers, private key blocks and connection strings are replaced before
  storage or streaming. Repository content is never copied into activity messages.
- Convex receives a safe projection only: event id, correlation id, user and
  repository ids, event type, message, timestamp. Read access requires a hashed key
  derived from a server-only publish token, issued only to the authenticated user.

## HTTP hardening

- Helmet with a strict set of headers; CORS restricted to `CORS_ORIGINS`.
- JSON body limit 1 MB, URL-encoded 256 KB, with raw-body verification kept separate.
- Per-IP and per-user rate limits on authentication, repository, documentation and
  activity routes; stricter limits on OAuth and webhook endpoints.
- Zod validation for params, query and body with `.strict()` objects where
  appropriate; unknown fields rejected.
- Centralised error handler returns a stable `{ error: { code, message, requestId } }`
  shape. Stack traces, driver errors and provider responses are not returned.
- Secret redaction is applied to structured logs and audit messages.
- SSRF and path traversal: GitHub API base URL is configuration, not user input;
  repository paths are validated and normalised against the fetched tree; the
  README path must be a relative path inside the repository. No user-supplied URL
  is fetched.

## Environment

`loadEnv()` validates configuration at startup and fails fast with the missing
variable names. Secrets exist only in the API/worker environment; the web app uses
`VITE_API_URL` and `VITE_CONVEX_URL`, which are public by design. No secret is
exposed through Vite variables, browser storage, client logs, commit messages or
Convex documents.

## Residual risks

- A compromised API or worker host can decrypt stored tokens; host hardening, secret
  rotation and least-privilege deployment remain operational requirements.
- GitHub OAuth `repo` scope is broad and remains in use for sign-in, repository
  listing and as the write fallback. Configure the optional GitHub App to give
  repository writes installation-scoped tokens instead.
- Prompt injection is mitigated, not eliminated. Output validation and
  human approval remain the last line of defence.
- Convex read keys are bearer capabilities; rotate
  `COMMITSCIBBLE_PUBLISH_TOKEN` if one leaks.
- Rate limiting uses a shared Redis counter when configured and falls back to an
  in-process counter if Redis is unreachable, so a Redis outage temporarily weakens
  the limit instead of failing requests.
