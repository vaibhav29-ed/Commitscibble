import { chromium } from "@playwright/test";

const BASE = process.env.AUDIT_BASE ?? "http://localhost:4173";

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

const runStarted = { ...run, id: "run_2", operation: "GENERATE", status: "FAILED", errorMessage: "Provider timed out" };

const diff = `--- a/README.md
+++ b/README.md
@@ -18,5 +18,6 @@
 ## Installation
-npm install
+pnpm install
`;

const proposal = {
  id: "prop_31C7",
  runId: run.id,
  repositoryId: "repo_1",
  summary: "Updates the installation command to pnpm.",
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
  proposedContent: "# Ingest service\n\n## Installation\n\npnpm install\n",
  diff,
  explanations: [{ summary: "Installation", explanation: "The repository now ships a pnpm lockfile." }],
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
  lastRun: runStarted,
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
  const path = new URL(route.request().url()).pathname;
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
    return route.fulfill(envelope({ event: { ...events[1], id: "log_2", metadata: { attempt: 1 } } }));
  if (path.endsWith("/activity"))
    return route.fulfill(envelope({ items: events, total: 3, page: 1, pageSize: 20 }));
  return route.fulfill({
    status: 404,
    contentType: "application/json",
    body: JSON.stringify({ error: { code: "NOT_FOUND", message: "Not found" }, requestId: "req_audit" }),
  });
}

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

const browser = await chromium.launch();
const report = [];

for (const theme of ["light", "dark"]) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
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
    await page.waitForTimeout(200);

    const result = await page.evaluate(() => {
      function parse(color) {
        const m = color.match(/rgba?\(([^)]+)\)/);
        if (!m) return null;
        const parts = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
        return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 };
      }
      function over(fg, bg) {
        return {
          r: fg.r * fg.a + bg.r * (1 - fg.a),
          g: fg.g * fg.a + bg.g * (1 - fg.a),
          b: fg.b * fg.a + bg.b * (1 - fg.a),
          a: 1,
        };
      }
      function lum(c) {
        const ch = [c.r, c.g, c.b].map((v) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
      }
      function backgroundOf(el) {
        let node = el;
        let acc = null;
        while (node) {
          const bg = parse(getComputedStyle(node).backgroundColor);
          if (bg && bg.a > 0) {
            acc = acc ? over(acc, bg) : bg;
            if (acc.a >= 0.999) return acc;
          }
          node = node.parentElement;
        }
        return acc ?? { r: 255, g: 255, b: 255, a: 1 };
      }

      const failures = [];
      const radii = new Map();
      const radiusSamples = {};

      for (const el of document.querySelectorAll("body *")) {
        const cs = getComputedStyle(el);
        const radius = cs.borderTopLeftRadius;
        if (radius && radius !== "0px") {
          radii.set(radius, (radii.get(radius) ?? 0) + 1);
          if (radius === "8px") {
            radiusSamples[el.tagName.toLowerCase()] = (radiusSamples[el.tagName.toLowerCase()] ?? 0) + 1;
          }
        }

        const hasOwnText = [...el.childNodes].some(
          (n) => n.nodeType === 3 && n.textContent.trim().length > 1,
        );
        if (!hasOwnText) continue;
        if (el.closest("[aria-hidden='true']")) continue;
        if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0) continue;

        const fg = parse(cs.color);
        if (!fg) continue;
        const bg = backgroundOf(el);
        const composed = over(fg, bg);
        const l1 = lum(composed);
        const l2 = lum(bg);
        const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        const size = Number.parseFloat(cs.fontSize);
        const bold = Number(cs.fontWeight) >= 700;
        const large = size >= 24 || (size >= 18.66 && bold);
        const required = large ? 3 : 4.5;
        if (ratio + 0.01 < required) {
          failures.push({
            text: el.textContent.trim().replace(/\s+/g, " ").slice(0, 60),
            tag: el.tagName.toLowerCase(),
            color: cs.color,
            bg: `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`,
            size: `${size}px`,
            ratio: Math.round(ratio * 100) / 100,
            required,
          });
        }
      }

      return {
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        radii: [...radii.entries()].sort((a, b) => Number.parseFloat(b[0]) - Number.parseFloat(a[0])),
        radiusSamples,
        failures,
      };
    });

    report.push({ theme, name, path, ...result });
  }
  await context.close();
}

const mobile = [];
{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await context.addInitScript(() => {
    try {
      localStorage.setItem("cs-theme", "light");
    } catch {}
  });
  const page = await context.newPage();
  await page.route("**/api/v1/**", mockApi);
  for (const [path, name] of routes.slice(0, 4)) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(200);
    const metrics = await page.evaluate(() => {
      const overflowing = [];
      for (const el of document.querySelectorAll("body *")) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && (r.right > window.innerWidth + 1 || r.left < -1)) {
          overflowing.push({
            tag: el.tagName.toLowerCase(),
            cls: String(el.className).slice(0, 60),
            left: Math.round(r.left),
            right: Math.round(r.right),
          });
        }
      }
      return {
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        overflowing: overflowing.slice(0, 6),
        h1: document.querySelector("h1")?.textContent?.trim().slice(0, 80) ?? null,
        h1Size: document.querySelector("h1") ? getComputedStyle(document.querySelector("h1")).fontSize : null,
      };
    });
    mobile.push({ name, path, ...metrics });
  }
  await context.close();
}

const signedOut = [];
{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await context.addInitScript(() => {
    try {
      localStorage.setItem("cs-theme", "light");
    } catch {}
  });
  const page = await context.newPage();
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/meta")) return route.fulfill(envelope(meta));
    return route.fulfill(envelope({ user: null, realtimeKey: null }));
  });
  for (const [path, name] of routes.slice(0, 4)) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(200);
    const metrics = await page.evaluate(() => {
      const main = document.querySelector("main");
      const card = main?.querySelector("section,form,[class*='card'],div");
      return {
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        h1: document.querySelector("h1")?.textContent?.trim().slice(0, 70) ?? null,
        h1Size: document.querySelector("h1") ? getComputedStyle(document.querySelector("h1")).fontSize : null,
        mainWidth: main ? Math.round(main.getBoundingClientRect().width) : null,
        cardWidth: card ? Math.round(card.getBoundingClientRect().width) : null,
        firstButtonWidth: document.querySelector("main button, main a[href]")
          ? Math.round(document.querySelector("main button, main a[href]").getBoundingClientRect().width)
          : null,
      };
    });
    signedOut.push({ name, path, ...metrics });
  }
  await context.close();
}

await browser.close();
console.log(JSON.stringify({ desktop: report, mobile, signedOut }, null, 2));
