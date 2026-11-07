import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = process.env.AUDIT_BASE ?? "http://localhost:4173";
const OUT = "C:/Users/vaubh/AppData/Local/Temp/opencode/sc-audit";
mkdirSync(OUT, { recursive: true });

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
  baseCommitSha: run.baseCommitSha,
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
    { summary: "Installation", explanation: "The repository now ships a pnpm lockfile, so the install command changed." },
    { summary: "Configuration", explanation: "A new CACHE_TTL environment variable is read by the cache module." },
  ],
  provider: "gemini",
  model: "gemini-2.5-pro",
  appliedCommitSha: null,
};

const events = ["STARTED", "PROGRESS", "APPROVAL_REQUIRED"].map((type, index) => ({
  id: `log_${index + 1}`,
  eventId: `evt_${index + 1}`,
  logId: "log_7f41c2e8b9a3",
  jobId: "job_2041",
  runId: run.id,
  userId: "usr_1",
  repositoryId: "repo_1",
  repositoryFullName: "acme/ingest-service",
  type,
  message: ["Incremental update started", "Inspected manifests and entry points", "Proposal ready for review"][index],
  progress: index < 2 ? { step: index + 1, total: 4 } : null,
  createdAt: iso(9 - index),
  metadata: null,
}));

const settings = {
  readmePath: "README.md",
  targetBranch: null,
  updateMode: "REVIEW",
  automationEnabled: true,
  ignoredPaths: ["examples/", "dist/"],
  maintainedSections: ["INSTALLATION", "CONFIGURATION"],
  commitMessageTemplate: "docs: update {readmePath}",
};

const repository = {
  id: "repo_1",
  githubRepoId: 1042,
  owner: "acme",
  name: "ingest-service",
  fullName: "acme/ingest-service",
  defaultBranch: "main",
  private: false,
  htmlUrl: "https://github.com/acme/ingest-service",
  description: "Streaming ingest service",
  trackingStatus: "CONNECTED",
  settings,
  lastProcessedCommitSha: run.baseCommitSha,
  lastSuccessfulRunAt: iso(30),
  documentationStatus: "CURRENT",
  createdAt: iso(60 * 24 * 40),
  updatedAt: iso(9),
  pendingProposalId: "prop_31C7",
  pendingProposalRunId: run.id,
  lastRun: run,
  readmeUrl: "https://github.com/acme/ingest-service/blob/main/README.md",
};

const repository2 = {
  ...repository,
  id: "repo_2",
  githubRepoId: 2088,
  name: "web-console",
  fullName: "acme/web-console",
  private: true,
  defaultBranch: "trunk",
  documentationStatus: "PENDING_REVIEW",
  trackingStatus: "PAUSED",
  pendingProposalId: null,
  pendingProposalRunId: null,
  lastRun: { ...run, id: "run_2", operation: "GENERATE", status: "FAILED", errorMessage: "Provider timed out" },
  settings: { ...settings, readmePath: "docs/README.md", targetBranch: "trunk", updateMode: "AUTOMATIC" },
};

const available = [
  {
    githubRepoId: 3091,
    owner: "acme",
    name: "billing-worker",
    fullName: "acme/billing-worker",
    defaultBranch: "main",
    private: true,
    htmlUrl: "https://github.com/acme/billing-worker",
    description: null,
    connectedRepositoryId: null,
  },
];

const user = {
  id: "usr_1",
  githubLogin: "acme-dev",
  githubId: 1042,
  displayName: "Acme Developer",
  email: "dev@acme.test",
  avatarUrl: null,
  createdAt: iso(60 * 24 * 40),
};

const meta = {
  readmeFileName: "README.md",
  defaultUpdateMode: "REVIEW",
  aiProviders: ["gemini", "groq"],
  realtime: { convex: false },
  githubApp: { configured: true, slug: "commitscibble", installUrl: "https://github.com/apps/commitscibble" },
  billingEnabled: false,
  retention: { auditDays: 90, webhookDays: 30 },
};

const envelope = (data) => ({
  status: 200,
  contentType: "application/json",
  headers: {
    "access-control-allow-origin": BASE,
    "access-control-allow-credentials": "true",
  },
  body: JSON.stringify({ data, requestId: "req_audit" }),
});

async function mockApi(route) {
  const url = new URL(route.request().url());
  const path = url.pathname;
  if (path.endsWith("/auth/me")) return route.fulfill(envelope({ user, realtimeKey: null }));
  if (path.endsWith("/meta")) return route.fulfill(envelope(meta));
  if (path.endsWith(`/runs/${run.id}/proposal`)) return route.fulfill(envelope({ proposal: detail }));
  if (path.endsWith(`/runs/${run.id}`))
    return route.fulfill(
      envelope({
        run,
        repositoryFullName: repository.fullName,
        proposal,
        usage: [],
        warnings: [],
        analysisUnsupported: [],
        events,
      }),
    );
  if (path.endsWith("/repositories/repo_1"))
    return route.fulfill(envelope({ repository, runs: [run], pendingProposal: proposal }));
  if (path.endsWith("/repositories"))
    return route.fulfill(envelope({ available, connected: [repository, repository2], githubError: null }));
  if (path.includes("/activity/"))
    return route.fulfill(envelope({ event: { ...events[1], id: "log_2", metadata: { attempt: 1, provider: "gemini" } } }));
  if (path.endsWith("/activity"))
    return route.fulfill(envelope({ items: events, total: 3, page: 1, pageSize: 20 }));
  return route.fulfill({
    status: 404,
    contentType: "application/json",
    body: JSON.stringify({ error: { code: "NOT_FOUND", message: "Not found" }, requestId: "req_audit" }),
  });
}

const browser = await chromium.launch();

const routes = [
  ["/", "landing"],
  ["/docs", "docs"],
  ["/signin", "signin"],
  ["/missing-page", "notfound"],
  ["/dashboard", "overview"],
  ["/dashboard/repositories", "repositories"],
  ["/dashboard/repositories/repo_1", "repository-detail"],
  ["/dashboard/reviews/run_8f2c1a9d", "review"],
  ["/dashboard/activity", "activity"],
  ["/dashboard/activity/log_7f41c2e8b9a3", "activity-detail"],
  ["/dashboard/settings", "settings"],
];

const findings = [];

for (const theme of ["light", "dark"]) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: theme,
    reducedMotion: "reduce",
  });
  await context.addInitScript((value) => {
    try {
      localStorage.setItem("cs-theme", value);
    } catch {}
  }, theme);
  const page = await context.newPage();
  await page.route("**/api/v1/**", mockApi);

  for (const [path, name] of routes) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(250);

    const result = await page.evaluate(() => {
      const root = document.documentElement;
      const sample = document.querySelector("h1");
      const style = sample ? getComputedStyle(sample) : null;
      const radii = new Map();
      const colors = new Map();
      let gradients = 0;
      let blur = 0;
      let clipped = 0;
      let pills = 0;
      for (const element of document.querySelectorAll("*")) {
        const computed = getComputedStyle(element);
        if (computed.backgroundImage.includes("gradient")) gradients += 1;
        if (computed.backdropFilter && computed.backdropFilter !== "none") blur += 1;
        if (computed.webkitBackgroundClip === "text") clipped += 1;
        const radius = computed.borderTopLeftRadius;
        if (radius && radius !== "0px") {
          radii.set(radius, (radii.get(radius) ?? 0) + 1);
          if (radius === "999px") pills += 1;
        }
        const color = computed.color;
        if (color) colors.set(color, (colors.get(color) ?? 0) + 1);
      }
      const bodyStyle = getComputedStyle(document.body);
      return {
        overflow: root.scrollWidth - window.innerWidth,
        height: root.scrollHeight,
        bodyFont: bodyStyle.fontFamily,
        bodySize: bodyStyle.fontSize,
        heading: style
          ? {
              font: style.fontFamily,
              size: style.fontSize,
              weight: style.fontWeight,
              lineHeight: style.lineHeight,
              color: style.color,
            }
          : null,
        gradients,
        blur,
        clipped,
        pills,
        radii: [...radii.entries()].sort((a, b) => Number.parseFloat(b[0]) - Number.parseFloat(a[0])),
        topColors: [...colors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12),
        archivoLoaded: document.fonts.check('16px "Archivo"'),
      };
    });

    const label = `${theme}-${name}-1440`;
    findings.push({ label, ...result });
    await page.screenshot({
      path: `${OUT}/${label}.png`,
      fullPage: name === "landing",
    });
  }

  for (const width of [1024, 768, 390]) {
    for (const [path, name] of routes.slice(0, 4)) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(200);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      findings.push({ label: `${theme}-${name}-${width}`, overflow });
      if (name === "landing") {
        await page.screenshot({ path: `${OUT}/${theme}-${name}-${width}.png`, fullPage: true });
      }
    }
  }

  await context.close();
}

await browser.close();
console.log(JSON.stringify(findings, null, 2));
