/**
 * Captures the real review screen (React app + product styles) as the landing
 * page's product image. Run the web dev server first:
 *
 *   pnpm --filter @commitscibble/web dev
 *   node scripts/capture-review-shot.mjs
 */
import { chromium } from "@playwright/test";

const BASE = process.env.SHOT_BASE ?? "http://localhost:5173";
const OUT = "apps/web/public/product/review.png";

const now = Date.now();
const iso = (minutesAgo = 0) => new Date(now - minutesAgo * 60_000).toISOString();

const run = {
  id: "run_8f2c1a9d",
  repositoryId: "repo_1",
  operation: "INCREMENTAL_UPDATE",
  status: "SUCCEEDED",
  baseCommitSha: "9c1f4e2a7b6d8c0f3a5e7d9b1c2a4f6e8d0b3c5a",
  targetCommitSha: "4d7b2e9c1a8f6e3b5d0c7a9f2e4b6d8c1a3f5e7b",
  provider: "gemini",
  model: "gemini-2.5-pro",
  startedAt: iso(9),
  completedAt: iso(7),
  errorCode: null,
  errorMessage: null,
  proposalId: "prop_31C7",
  appliedCommitSha: null,
  correlationId: "log_7f41c2e8b9a3",
  attempt: 1,
  createdAt: iso(9),
  updatedAt: iso(7),
};

const diff = `--- a/README.md
+++ b/README.md
@@ -18,5 +18,6 @@
 ## Installation
-npm install
+pnpm install
+
+Then start the development server:
+pnpm dev
@@ -31,3 +32,4 @@
 ## Configuration
 Set the provider through environment variables:
+| \`CACHE_TTL\` | Cache lifetime in seconds |
`;

const proposal = {
  id: "prop_31C7",
  runId: run.id,
  repositoryId: "repo_1",
  summary:
    "Updates the installation command to pnpm and documents the new CACHE_TTL variable, leaving deployment and licensing untouched.",
  sections: ["INSTALLATION", "CONFIGURATION"],
  warnings: [],
  validationIssues: [],
  status: "PENDING",
  baseCommitSha: "9c1f4e2a7b6d8c0f3a5e7d9b1c2a4f6e8d0b3c5a",
  baseReadmeHash: "8b3f0c5e9a1d7b2f4c6e8a0d2b5f7c9e1a3d5b7f",
  additions: 4,
  deletions: 1,
  createdAt: iso(8),
  reviewedAt: null,
};

const detail = {
  ...proposal,
  originalContent: "# Ingest service\n\n## Installation\n\nnpm install\n",
  proposedContent:
    "# Ingest service\n\n## Installation\n\npnpm install\n\nThen start the development server:\n\npnpm dev\n\n## Configuration\n\nSet the provider through environment variables:\n\n| `CACHE_TTL` | Cache lifetime in seconds |\n",
  diff,
  explanations: [
    {
      summary: "Installation",
      explanation: "The repository now ships a pnpm lockfile, so the install command changed.",
    },
    {
      summary: "Configuration",
      explanation: "A new CACHE_TTL environment variable is read by the cache module.",
    },
  ],
  provider: "gemini",
  model: "gemini-2.5-pro",
  appliedCommitSha: null,
};

const events = [
  {
    id: "log_1",
    eventId: "evt_1",
    logId: "log_7f41c2e8b9a3",
    jobId: "job_2041",
    runId: run.id,
    userId: "usr_1",
    repositoryId: "repo_1",
    repositoryFullName: "acme/ingest-service",
    type: "STARTED",
    message: "Incremental update started",
    progress: { step: 1, total: 4 },
    createdAt: iso(9),
    metadata: null,
  },
  {
    id: "log_2",
    eventId: "evt_2",
    logId: "log_7f41c2e8b9a3",
    jobId: "job_2041",
    runId: run.id,
    userId: "usr_1",
    repositoryId: "repo_1",
    repositoryFullName: "acme/ingest-service",
    type: "PROGRESS",
    message: "Inspected manifests and entry points",
    progress: { step: 2, total: 4 },
    createdAt: iso(8),
    metadata: null,
  },
  {
    id: "log_3",
    eventId: "evt_3",
    logId: "log_7f41c2e8b9a3",
    jobId: "job_2041",
    runId: run.id,
    userId: "usr_1",
    repositoryId: "repo_1",
    repositoryFullName: "acme/ingest-service",
    type: "APPROVAL_REQUIRED",
    message: "Proposal ready for review",
    progress: null,
    createdAt: iso(7),
    metadata: null,
  },
];

const user = {
  id: "usr_1",
  githubLogin: "acme-dev",
  githubId: 1042,
  displayName: "Acme Developer",
  email: null,
  avatarUrl: null,
  createdAt: iso(60 * 24 * 40),
};

const envelope = (data) => ({
  status: 200,
  contentType: "application/json",
  headers: {
    "access-control-allow-origin": BASE,
    "access-control-allow-credentials": "true",
  },
  body: JSON.stringify({ data, requestId: "req_shot" }),
});

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1160, height: 900 },
  deviceScaleFactor: 2,
  colorScheme: "light",
  reducedMotion: "reduce",
});

const page = await context.newPage();

await page.route("**/api/v1/**", async (route) => {
  const url = new URL(route.request().url());
  if (url.pathname.endsWith("/auth/me")) {
    await route.fulfill(envelope({ user, realtimeKey: null }));
    return;
  }
  if (url.pathname.endsWith(`/runs/${run.id}/proposal`)) {
    await route.fulfill(envelope({ proposal: detail }));
    return;
  }
  if (url.pathname.endsWith(`/runs/${run.id}`)) {
    await route.fulfill(
      envelope({
        run,
        repositoryFullName: "acme/ingest-service",
        proposal,
        usage: [],
        warnings: [],
        analysisUnsupported: [],
        events,
      }),
    );
    return;
  }
  await route.fulfill({
    status: 404,
    contentType: "application/json",
    headers: {
      "access-control-allow-origin": BASE,
      "access-control-allow-credentials": "true",
    },
    body: JSON.stringify({ error: { code: "NOT_FOUND", message: "Not found" }, requestId: "req_shot" }),
  });
});

await page.goto(`${BASE}/dashboard/reviews/${run.id}`, { waitUntil: "networkidle" });
await page.getByText("Proposed documentation").waitFor({ timeout: 20_000 });
await page.evaluate(() => document.fonts.ready);

// Keep the product content, drop the app shell so the screen fits a hero frame.
await page.evaluate(() => {
  document.querySelector("aside")?.remove();
  document.querySelector("header")?.remove();
  const shell = document.querySelector("main")?.parentElement;
  if (shell) shell.style.paddingLeft = "0";
});

await page.waitForTimeout(250);

const main = page.locator("main");
const box = await main.boundingBox();
if (!box) throw new Error("Review screen was not rendered");

await page.screenshot({
  path: OUT,
  clip: {
    x: box.x,
    y: box.y,
    width: box.width,
    height: Math.min(box.height, 800),
  },
});

await browser.close();
console.log(`Saved ${OUT} (${Math.round(box.width)}x${Math.min(box.height, 800)} css px @2x)`);
