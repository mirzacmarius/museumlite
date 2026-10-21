#!/usr/bin/env node
/**
 * Verify that a merged commit reached production:
 *
 *   node scripts/verify-deploy.mjs <sha>
 *
 * Finds the `museumlite` production deployment Vercel built for the commit,
 * waits for it to be READY (the build also runs `convex deploy`), then checks
 * that https://app.museumlite.com serves that deployment. Fails fast when no
 * deployment starts, because Vercel can skip a commit without any GitHub
 * status ever appearing. Needs a logged-in `vercel` CLI with access to the
 * `orvibo` team.
 */
import { execFileSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const PROJECT = "museumlite";
const SCOPE = "orvibo";
const DOMAIN = "app.museumlite.com";
const POLL_MS = 15_000;
const START_TIMEOUT_MS = 3 * 60_000;
const READY_TIMEOUT_MS = 20 * 60_000;
const ALIAS_TIMEOUT_MS = 2 * 60_000;
// `vercel inspect app.museumlite.com` prints megabytes of JSON, more than
// execFileSync's 1 MiB default.
const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;

function vercel(args) {
  const output = execFileSync(
    "vercel",
    [...args, "--scope", SCOPE, "--format", "json"],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 60_000,
      maxBuffer: MAX_OUTPUT_BYTES,
    },
  );
  return JSON.parse(output);
}

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function resolveSha(ref) {
  try {
    return execFileSync("git", ["rev-parse", `${ref}^{commit}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    if (/^[0-9a-f]{40}$/i.test(ref)) return ref.toLowerCase();
    fail(`Cannot resolve ${ref} to a full commit SHA. Run git fetch first.`);
  }
}

function productionDeployment(sha) {
  const { deployments } = vercel([
    "list",
    PROJECT,
    "--environment",
    "production",
    "--meta",
    `githubCommitSha=${sha}`,
  ]);
  return deployments.toSorted((a, b) => b.createdAt - a.createdAt)[0];
}

async function poll(timeoutMs, check) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const result = check();
    if (result) return result;
    if (Date.now() >= deadline) return undefined;
    await sleep(POLL_MS);
  }
}

const ref = process.argv[2];
if (!ref) fail("Usage: node scripts/verify-deploy.mjs <sha>");
const sha = resolveSha(ref);
console.log(`Commit ${sha}`);

const started = await poll(START_TIMEOUT_MS, () => productionDeployment(sha));
if (!started) {
  fail(
    `No production deployment of ${PROJECT} started for ${sha} within ${START_TIMEOUT_MS / 60_000} minutes. Check the Vercel dashboard (ignored build step, Git integration, deployment limit) instead of waiting for a GitHub status.`,
  );
}
console.log(`Deployment https://${started.url} (${started.state})`);

const finished = await poll(READY_TIMEOUT_MS, () => {
  const deployment = productionDeployment(sha);
  return ["READY", "ERROR", "CANCELED"].includes(deployment?.state)
    ? deployment
    : undefined;
});
if (!finished) fail(`Deployment https://${started.url} is still building.`);
if (finished.state !== "READY") {
  fail(
    `Deployment https://${finished.url} is ${finished.state}. Read its build log: vercel inspect ${finished.url} --logs --scope ${SCOPE}`,
  );
}
console.log("Deployment is READY");

const served = await poll(ALIAS_TIMEOUT_MS, () => {
  const current = vercel(["inspect", DOMAIN]);
  return current.url === finished.url ? current : undefined;
});
if (!served) {
  const current = vercel(["inspect", DOMAIN]);
  fail(
    `${DOMAIN} serves https://${current.url}, not https://${finished.url}. A newer deployment may have been promoted, or the alias was not assigned.`,
  );
}

const response = await fetch(`https://${DOMAIN}/`, { redirect: "manual" });
if (response.status >= 500) fail(`${DOMAIN} answered HTTP ${response.status}`);
console.log(`✓ https://${DOMAIN} serves ${sha} (HTTP ${response.status})`);
