#!/usr/bin/env node
/**
 * Start (or stop with --stop) an isolated local Convex backend for full-stack QA.
 * State lives in the gitignored .local-qa/ folder of this checkout.
 *
 *   bun run qa:backend            start on 127.0.0.1:3230 (site proxy :3231)
 *   QA_PORT=3330 bun run qa:backend
 *   bun run qa:backend -- --stop
 */
import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  chmodSync,
  existsSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, join } from "node:path";
import {
  deploymentEnvPath,
  ensureStateDir,
  findBackendBinary,
  isAlive,
  processPath,
  root,
  stateDir,
  writeState,
} from "./lib.mjs";

const port = Number(process.env.QA_PORT ?? 3230);
const sitePort = port + 1;
const url = `http://127.0.0.1:${port}`;

if (process.argv.includes("--stop")) {
  if (existsSync(processPath)) {
    const { pid } = JSON.parse(readFileSync(processPath, "utf8"));
    if (isAlive(pid)) process.kill(pid);
    rmSync(processPath);
    console.log(`✓ Stopped local QA backend (pid ${pid})`);
  } else {
    console.log("No local QA backend recorded for this checkout.");
  }
  process.exit(0);
}

if (existsSync(processPath)) {
  const { pid, url: running } = JSON.parse(readFileSync(processPath, "utf8"));
  if (isAlive(pid)) {
    console.log(
      `✓ Local QA backend already running at ${running} (pid ${pid})`,
    );
    process.exit(0);
  }
}

const binary = findBackendBinary();
if (!binary) {
  console.error(
    "✗ convex-local-backend not found. Run `bunx convex dev --local --once` once to download it, or set CONVEX_LOCAL_BACKEND_BIN.",
  );
  process.exit(1);
}

ensureStateDir();
const instanceName = `museumlite-qa-${basename(root)}`
  .toLowerCase()
  .replace(/[^a-z0-9-]/g, "-");
const secret = randomBytes(32).toString("hex");
const adminKey = execFileSync(
  binary,
  [
    "keygen",
    "admin-key",
    "--instance-name",
    instanceName,
    "--instance-secret",
    secret,
  ],
  { encoding: "utf8" },
).trim();

writeFileSync(
  deploymentEnvPath,
  `CONVEX_SELF_HOSTED_URL=${url}\nCONVEX_SELF_HOSTED_ADMIN_KEY=${adminKey}\n`,
);
chmodSync(deploymentEnvPath, 0o600);

const log = openSync(join(stateDir, "backend.log"), "w");
const child = spawn(
  binary,
  [
    "--interface",
    "127.0.0.1",
    "--port",
    String(port),
    "--site-proxy-port",
    String(sitePort),
    "--instance-name",
    instanceName,
    "--instance-secret",
    secret,
    "--local-storage",
    join(stateDir, "storage"),
    "--disable-beacon",
    join(stateDir, "db.sqlite3"),
  ],
  { stdio: ["ignore", log, log], detached: true },
);
child.unref();

writeState({
  pid: child.pid,
  url,
  site: `http://127.0.0.1:${sitePort}`,
  instanceName,
});

for (let attempt = 0; attempt < 40; attempt++) {
  try {
    const response = await fetch(`${url}/instance_name`);
    if (response.ok) {
      console.log(
        `✓ Local QA backend ready at ${url} (log: .local-qa/backend.log)`,
      );
      process.exit(0);
    }
  } catch {
    // not accepting connections yet
  }
  await new Promise((resolve) => setTimeout(resolve, 250));
}
console.error(
  "✗ Local QA backend did not become ready; see .local-qa/backend.log",
);
process.exit(1);
