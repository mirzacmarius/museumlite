#!/usr/bin/env node
/**
 * Run a Convex CLI command against the local QA backend only.
 *
 *   bun run convex:local -- deploy --yes
 *   bun run convex:local -- env list
 *
 * Cloud variables are stripped from the environment and the command is
 * refused unless the recorded deployment target is a loopback address.
 */
import { join } from "node:path";
import {
  deploymentEnvPath,
  localOnlyEnv,
  readState,
  root,
  run,
} from "./lib.mjs";

const args = process.argv
  .slice(2)
  .filter((arg, i) => !(i === 0 && arg === "--"));
if (args.length === 0) {
  console.error("Usage: bun run convex:local -- <convex args>");
  process.exit(1);
}

readState();
process.exit(
  run("bunx", ["convex", ...args, "--env-file", deploymentEnvPath], {
    cwd: join(root, "packages/backend"),
    env: localOnlyEnv(),
  }),
);
