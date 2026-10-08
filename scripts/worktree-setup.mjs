#!/usr/bin/env node
/**
 * Make a fresh or stale git worktree ready to lint, typecheck and test.
 *
 *   bun run worktree:setup   sync env files, install from the lockfile, verify
 *   bun run worktree:check   verify only (no install), exits 1 on problems
 *
 * Worktrees created before a merged branch added a dependency fail with
 * "Cannot find module" until `bun install` runs again; the check names them.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const checkOnly = process.argv.includes("--check");

function run(cmd, args) {
  const result = spawnSync(cmd, args, { cwd: root, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function workspaceDirs() {
  return ["packages", "apps", "tooling"].flatMap((group) => {
    const base = join(root, group);
    if (!existsSync(base)) return [];
    return readdirSync(base, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(base, entry.name))
      .filter((dir) => existsSync(join(dir, "package.json")));
  });
}

function missingDependencies() {
  const missing = [];
  for (const dir of workspaceDirs()) {
    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const name of Object.keys(deps)) {
      const found = [dir, root].some((base) =>
        existsSync(join(base, "node_modules", name)),
      );
      if (!found) missing.push(`${pkg.name}: ${name}`);
    }
  }
  return missing;
}

if (!checkOnly) {
  run("node", [join(root, "scripts/sync-worktree-env.mjs")]);
  run("bun", ["install", "--frozen-lockfile"]);
}

const missing = missingDependencies();
if (missing.length > 0) {
  console.error("✗ Declared dependencies missing from node_modules:");
  for (const entry of missing) console.error(`  - ${entry}`);
  console.error("Run `bun run worktree:setup` to install from the lockfile.");
  process.exit(1);
}
console.log("✓ Worktree dependencies are installed");
