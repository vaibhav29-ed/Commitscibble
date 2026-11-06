#!/usr/bin/env node
/**
 * Fails the production build when the web bundle is not a real production build.
 *
 * Why this exists: a host that injects `NODE_ENV=development` makes Vite compile
 * in development mode. The app then ships the React dev build (much larger) and,
 * historically, resolved the API fallback to `http://localhost:4000`. That broke
 * "Connect GitHub" on the deployed site while every build looked successful.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "apps", "web", "dist");
const assetsDir = join(dist, "assets");

const DEV_REACT_MARKERS = [
  "react-dom.development",
  "You might have mismatching versions of React",
];
const RUNTIME_HOST_GUARD = "127.0.0.1";

function fail(message) {
  console.error(`[verify-web-build] ${message}`);
  process.exitCode = 1;
}

let html;
try {
  html = readFileSync(join(dist, "index.html"), "utf8");
} catch {
  fail(`no index.html in ${dist}. Did the web build run?`);
  process.exit(1);
}

let files;
try {
  files = readdirSync(assetsDir).filter((file) => file.endsWith(".js"));
} catch {
  fail(`no assets directory at ${assetsDir}`);
  process.exit(1);
}

const indexFiles = files.filter((file) => file.startsWith("index-"));
if (indexFiles.length === 0) {
  fail("no index-*.js bundle found");
}

if (!indexFiles.some((file) => html.includes(file))) {
  fail("index.html does not reference any index-*.js bundle");
}

let hasHostGuard = false;
for (const file of files) {
  const source = readFileSync(join(assetsDir, file), "utf8");
  for (const marker of DEV_REACT_MARKERS) {
    if (source.includes(marker)) {
      fail(`${file} contains "${marker}" — the build ran in development mode.`);
    }
  }
  if (source.includes(RUNTIME_HOST_GUARD)) {
    hasHostGuard = true;
  }
}

if (!hasHostGuard) {
  fail(
    "bundle is missing the runtime localhost guard (127.0.0.1). The deploy is stale or built from an old commit.",
  );
}

if (process.exitCode) {
  console.error("[verify-web-build] refusing to ship this bundle.");
  process.exit(process.exitCode);
}

console.log(
  `[verify-web-build] ok: production bundle, ${files.length} JS assets, host guard present.`,
);
