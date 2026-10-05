#!/usr/bin/env node
/**
 * Fail on bare TODO/FIXME markers in production source. Link the work to a
 * ticket instead: `TODO(MUS-123): ...` is allowed, a bare `TODO` is not.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCAN_DIRS = ["packages/backend/convex", "apps/app/src"];
const EXTENSIONS = new Set([".ts", ".tsx"]);
const SKIP_DIRS = new Set(["_generated", "node_modules", ".next"]);
const MARKER = /\b(TODO|FIXME)\b(?!\(MUS-\d+\))/;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (EXTENSIONS.has(extname(path))) yield path;
  }
}

const hits = [];
for (const dir of SCAN_DIRS) {
  for (const file of walk(join(root, dir))) {
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, index) => {
        if (MARKER.test(line)) {
          hits.push(`${relative(root, file)}:${index + 1}: ${line.trim()}`);
        }
      });
  }
}

if (hits.length > 0) {
  console.error(
    "✗ Bare TODO/FIXME markers found. Use TODO(MUS-123) or remove:",
  );
  for (const hit of hits) console.error(`  ${hit}`);
  process.exit(1);
}
console.log("✓ No bare TODO/FIXME markers");
