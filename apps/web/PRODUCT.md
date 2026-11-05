# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Solo maintainers and open-source developers who own one or a few GitHub repositories and have no dedicated technical writer. They reach for CommitScibble when code has moved ahead of the README — after install steps, scripts, routes, environment variables, or deployment configuration change — and they need the documentation to be accurate without hand-auditing every section or rewriting the whole file.

## Product Purpose

CommitScibble reads a repository's actual files, generates a README grounded in that evidence, and keeps it current by proposing targeted updates only for the sections a commit made stale. Success means the README stays trustworthy with a small, reviewable diff: commands and paths resolve, unrelated sections are preserved, and the maintainer can see why each change was proposed. The product is being prepared as a real service; claims must remain verifiable against the code.

## Positioning

README maintenance, not README generation. The value is in what happens after the first draft: code changes are mapped to the sections they justify, only affected sections are regenerated, everything else is carried over, and the result arrives as a reviewable proposal before it reaches a branch.

## Operating Context

Maintainers work in GitHub and a browser dashboard. They authorize GitHub, connect repositories, generate the first README, and review proposals containing a unified diff, section explanations, validation findings, and the base commit. Once a repository is tracked, pushes arrive through a verified webhook and produce incremental proposals. Review mode is the default; automatic apply is an explicit per-repository choice. Each run exposes correlated logs and persisted activity. AI provider and model are chosen by the deployment, not the end user.

## Capabilities and Constraints

Confirmed capabilities: GitHub OAuth sign-in and repository discovery; optional GitHub App installation tokens for writes; README generation from a filtered repository inventory; manifest and fact extraction; incremental section patching on push; cleanup/restructuring with command and environment-variable guards; reviewable proposals with stale-base detection; manual and automatic apply; run cancellation, retry, and recovery; persisted audit/activity with optional Convex realtime and polling fallback; optional email notifications; per-repository settings for README path, branch, update mode, ignored paths, maintained sections, and commit message.

Confirmed constraints: the shipped documentation surface is the README; there is no embedding-based retrieval; realtime requires a Convex deployment; email requires Resend configuration; the mock AI provider is local-development-only and refused in production; billing is intentionally not implemented and `BILLING_ENABLED` stays false; provider and model identifiers are deployment environment settings, not per-user settings; repository source code is not stored, while proposals and audit records are retained for configured windows.

## Brand Commitments

The name is spelled "CommitScibble" and the existing mark is `apps/web/public/brand/logo.png`. The tagline is "Your code evolves. Your docs follow." The voice is plain, technical, and evidence-based: it states what the code enforces, labels unconfigured integrations honestly, and avoids hype, invented proof, and unverifiable certification claims. The public landing page carries no analytics or tracking scripts.

## Evidence on Hand

A working application: React/Vite web client, Express API, BullMQ worker, MongoDB persistence, optional Convex projection, and package-level documentation and AI engines. Supporting evidence includes `README.md`, `docs/architecture.md`, `docs/api.md`, `docs/security.md`, `docs/deployment.md`, the test suite, and the activity/audit records created by a running deployment. Absent, and not to be fabricated: customers, logos, testimonials, case studies, press coverage, benchmarks, pricing, usage numbers, compliance certifications, and a live hosted-service claim.

## Product Principles

1. Evidence over invention. Every documented command, path, and environment variable must trace to a file the system actually read; uncertain mappings become review flags, not guesses.
2. Maintain, don't regenerate. Unaffected sections are preserved byte-for-byte; only sections whose evidence changed are rewritten.
3. Review before write. Nothing reaches a branch without approval unless automatic mode was explicitly chosen, and a moved base stops the apply instead of overwriting newer work.
4. Report configuration truthfully. Missing credentials surface as unconfigured; the product never pretends an integration works.
5. Leave a verifiable trail. Diffs, validation results, correlated logs, and audit history make each change inspectable after the fact.

## Accessibility & Inclusion

No product-specific accessibility standard has been confirmed. Future work should not claim WCAG or other conformance without an audit.
