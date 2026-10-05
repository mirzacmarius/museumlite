import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
/** Per-worktree, gitignored scratch space for the local QA backend. */
export const stateDir = join(root, ".local-qa");
export const deploymentEnvPath = join(stateDir, "deployment.env");
export const processPath = join(stateDir, "process.json");

export const CLOUD_ENV_VARS = [
  "CONVEX_DEPLOYMENT",
  "CONVEX_DEPLOY_KEY",
  "CONVEX_URL",
  "CONVEX_SITE_URL",
  "NEXT_PUBLIC_CONVEX_URL",
  "NEXT_PUBLIC_CONVEX_SITE_URL",
];

export function ensureStateDir() {
  mkdirSync(stateDir, { recursive: true });
}

export function parseEnvFile(path) {
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) out[match[1]] = match[2];
  }
  return out;
}

export function isLoopback(url) {
  try {
    const { hostname } = new URL(url);
    return ["127.0.0.1", "localhost", "[::1]", "::1"].includes(hostname);
  } catch {
    return false;
  }
}

export function readState() {
  if (!existsSync(processPath) || !existsSync(deploymentEnvPath)) {
    console.error(
      "✗ No local QA backend state found. Run `bun run qa:backend` first.",
    );
    process.exit(1);
  }
  const state = JSON.parse(readFileSync(processPath, "utf8"));
  const env = parseEnvFile(deploymentEnvPath);
  if (!isLoopback(env.CONVEX_SELF_HOSTED_URL) || !isLoopback(state.url)) {
    console.error(
      `✗ Refusing to run: deployment target ${env.CONVEX_SELF_HOSTED_URL} is not loopback.`,
    );
    process.exit(1);
  }
  return { state, env };
}

export function writeState(state) {
  ensureStateDir();
  writeFileSync(processPath, JSON.stringify(state, null, 2));
}

export function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Newest precompiled local backend that `convex dev --local` has downloaded. */
export function findBackendBinary() {
  const explicit = process.env.CONVEX_LOCAL_BACKEND_BIN;
  if (explicit) return explicit;
  const base = join(homedir(), ".cache/convex/binaries");
  if (!existsSync(base)) return null;
  const newest = readdirSync(base)
    .filter((name) => existsSync(join(base, name, "convex-local-backend")))
    .sort()
    .pop();
  return newest ? join(base, newest, "convex-local-backend") : null;
}

/** Environment with every cloud-targeting variable removed. */
export function localOnlyEnv(extra = {}) {
  const env = { ...process.env };
  for (const name of CLOUD_ENV_VARS) delete env[name];
  return { ...env, ...extra };
}

export function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { stdio: "inherit", ...options });
  return result.status ?? 1;
}
