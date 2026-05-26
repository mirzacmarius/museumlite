#!/usr/bin/env node
/**
 * Symlink (or copy) .env files from another checkout into this worktree.
 * New git worktrees do not include gitignored .env files — run automatically via predev/postinstall.
 *
 * Source resolution order:
 *  1. ML_ENV_SOURCE — absolute path to a repo root that has apps/app/.env
 *  2. Another git worktree of this repo that already has env files
 *  3. ~/Developer/ml (common local clone path)
 */
import { execSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  symlinkSync,
  unlinkSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Relative paths we sync between checkouts */
const ENV_REL_PATHS = [
  ".env.local",
  "apps/app/.env",
  "apps/web/.env",
  "packages/backend/.env",
  "packages/backend/.env.local",
];

const EXAMPLE_FALLBACKS = [
  { dest: "apps/app/.env", example: "apps/app/.env.example" },
  { dest: "apps/web/.env", example: "apps/web/.env.example" },
];

function isCompleteEnvFile(absPath) {
  if (!existsSync(absPath)) return false;
  try {
    const stat = lstatSync(absPath);
    if (stat.isSymbolicLink() || stat.isFile()) return true;
  } catch {
    return false;
  }
  return false;
}

function needsConvexUrl(absPath) {
  if (!absPath.includes("apps/app") && !absPath.includes("apps/web")) {
    return false;
  }
  try {
    const content = readFileSync(absPath, "utf8");
    return /NEXT_PUBLIC_CONVEX_URL=\s*\S+/.test(content);
  } catch {
    return false;
  }
}

function findEnvSource() {
  const explicit = process.env.ML_ENV_SOURCE;
  if (explicit) {
    const resolved = explicit.replace(/\/$/, "");
    if (existsSync(join(resolved, "apps/app/.env"))) return resolved;
    console.warn(`ML_ENV_SOURCE is set but apps/app/.env was not found at ${resolved}`);
  }

  try {
    const out = execSync("git worktree list --porcelain", {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const worktrees = [];
    for (const line of out.split("\n")) {
      if (line.startsWith("worktree ")) {
        worktrees.push(line.slice("worktree ".length).trim());
      }
    }
    for (const wt of worktrees) {
      if (wt === root) continue;
      if (existsSync(join(wt, "apps/app/.env"))) return wt;
    }
  } catch {
    // not a git repo or git unavailable
  }

  const fallback = join(process.env.HOME ?? "", "Developer/ml");
  if (existsSync(join(fallback, "apps/app/.env"))) return fallback;

  return null;
}

function linkOrCopy(src, dest) {
  mkdirSync(dirname(dest), { recursive: true });

  if (existsSync(dest)) {
    try {
      if (lstatSync(dest).isSymbolicLink()) {
        const target = readlinkSync(dest);
        if (target === src) return "ok";
        unlinkSync(dest);
      } else {
        return "ok";
      }
    } catch {
      return "ok";
    }
  }

  try {
    symlinkSync(src, dest);
    return "linked";
  } catch {
    copyFileSync(src, dest);
    return "copied";
  }
}

function seedFromExamples() {
  let seeded = 0;
  for (const { dest, example } of EXAMPLE_FALLBACKS) {
    const destPath = join(root, dest);
    const examplePath = join(root, example);
    if (!existsSync(destPath) && existsSync(examplePath)) {
      copyFileSync(examplePath, destPath);
      seeded++;
    }
  }
  return seeded;
}

function listMissing() {
  return ENV_REL_PATHS.filter((rel) => {
    const abs = join(root, rel);
    if (!isCompleteEnvFile(abs)) return true;
    if (rel.endsWith("apps/app/.env") || rel.endsWith("apps/web/.env")) {
      return !needsConvexUrl(abs);
    }
    return false;
  });
}

function main() {
  const force = process.argv.includes("--force");
  let missing = listMissing();

  if (missing.length === 0) {
    if (process.argv.includes("--verbose")) {
      console.log("✓ Environment files already present in this worktree");
    }
    return;
  }

  const source = findEnvSource();
  if (source) {
    console.log(`↪ Syncing env from ${source}`);
    for (const rel of ENV_REL_PATHS) {
      const src = join(source, rel);
      const dest = join(root, rel);
      if (!existsSync(src)) continue;
      if (existsSync(dest) && !force) continue;
      if (existsSync(dest) && force) {
        try {
          unlinkSync(dest);
        } catch {
          /* keep existing file */
          continue;
        }
      }
      const result = linkOrCopy(src, dest);
      if (result !== "ok") {
        console.log(`  ${result} ${rel}`);
      }
    }
    missing = listMissing();
  }

  if (missing.some((m) => m.includes("apps/"))) {
    const seeded = seedFromExamples();
    if (seeded > 0) {
      console.log(`  created ${seeded} .env from .env.example (fill in values)`);
    }
    missing = listMissing();
  }

  if (missing.length > 0) {
    console.error("\n✗ Missing or incomplete environment files:");
    for (const rel of missing) {
      console.error(`  - ${rel}`);
    }
    console.error(`
Fix options:
  1. Set ML_ENV_SOURCE to your main clone, then run:  bun run env:sync
     export ML_ENV_SOURCE="$HOME/Developer/ml"

  2. Copy env manually from another checkout:
     cp /path/to/ml/apps/app/.env apps/app/.env
     cp /path/to/ml/apps/web/.env apps/web/.env
     cp /path/to/ml/packages/backend/.env packages/backend/.env

  3. Fill apps/app/.env and apps/web/.env from .env.example (need NEXT_PUBLIC_CONVEX_URL)
`);
    process.exit(1);
  }

  console.log("✓ Environment ready for this worktree");
}

main();
