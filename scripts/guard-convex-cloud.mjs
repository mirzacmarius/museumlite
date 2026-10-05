#!/usr/bin/env node
/**
 * Refuse Convex commands that touch the linked cloud deployment when run by a
 * coding agent. Humans are unaffected. Override deliberately with
 * ALLOW_CONVEX_CLOUD=1 when the user has authorized a cloud push.
 *
 * Usage (from a package script): node ../../scripts/guard-convex-cloud.mjs <command-label>
 */
const AGENT_MARKERS = [
  "CLAUDECODE",
  "CODEX_THREAD_ID",
  "CODEX_SANDBOX",
  "CODEX_CI",
  "AI_AGENT",
];

const label = process.argv[2] ?? "convex";
const agent = AGENT_MARKERS.find((name) => process.env[name]);

if (agent && process.env.ALLOW_CONVEX_CLOUD !== "1") {
  console.error(`✗ Blocked: "${label}" syncs to the linked Convex cloud deployment.
  Detected a coding agent (${agent}). Agents need explicit user authorization for cloud pushes.
  Use \`bun run test\` (convex-test, no cloud) instead.
  If the user has authorized it, re-run with ALLOW_CONVEX_CLOUD=1.`);
  process.exit(1);
}
