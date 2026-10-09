#!/usr/bin/env node
/**
 * Fail on call patterns that pass lint, types and tests but break at runtime:
 *
 * - `toLocaleDateString(..., { timeStyle })` throws a TypeError; use
 *   `toLocaleString` for date-and-time output.
 * - `ctx.storage.store(new Blob(...))` without a `type` option is rejected by
 *   Convex storage with BadHeader (convex-test accepts it, so tests are skipped).
 *
 * Only literal call sites are checked, so a hit is always a real violation.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCAN_DIRS = ["apps", "packages"];
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]);
const SKIP_DIRS = new Set([
  "_generated",
  "node_modules",
  ".next",
  ".turbo",
  "dist",
  "public",
  "tests",
  "__tests__",
]);
const TEST_FILE = /\.(test|spec)\.[jt]sx?$/;

const RULES = [
  {
    // Match ends on the call's opening parenthesis.
    pattern: /\.toLocaleDateString\(/g,
    message:
      "toLocaleDateString() throws on a timeStyle option; use toLocaleString()",
    isViolation: (args) => args.some((arg) => /\btimeStyle\b/.test(arg)),
  },
  {
    // Match ends on the Blob constructor's opening parenthesis.
    pattern: /\bstorage\.store\(\s*new Blob\(/g,
    message:
      "storage.store(new Blob(...)) needs a { type } option; Convex storage rejects untyped blobs",
    isViolation: ([, options]) =>
      options === undefined ||
      (options.startsWith("{") &&
        !options.includes("...") &&
        !/\btype\b/.test(options)),
  },
];

/** Index of the quote or backtick that closes the string opening at `start`. */
function stringEnd(source, start) {
  const quote = source[start];
  for (let i = start + 1; i < source.length; i++) {
    if (source[i] === "\\") i++;
    else if (source[i] === quote) return i;
    else if (quote === "`" && source[i] === "$" && source[i + 1] === "{") {
      i = callArguments(source, i + 1).end;
      if (i === -1) return -1;
    }
  }
  return -1;
}

/**
 * Top-level arguments (comments removed) of the bracket opening at `open`.
 * `end` is the closing bracket's index, or -1 when unbalanced.
 */
function callArguments(source, open) {
  const args = [];
  let depth = 0;
  let arg = "";
  let from = open + 1;
  for (let i = open; i < source.length; i++) {
    const char = source[i];
    const next = source[i + 1];
    if (char === '"' || char === "'" || char === "`") {
      i = stringEnd(source, i);
      if (i === -1) break;
    } else if (char === "/" && (next === "/" || next === "*")) {
      const close = source.indexOf(next === "/" ? "\n" : "*/", i);
      if (close === -1) break;
      arg += source.slice(from, i);
      i = next === "/" ? close : close + 1;
      from = i + 1;
    } else if ("([{".includes(char)) {
      depth++;
    } else if (")]}".includes(char) && --depth === 0) {
      args.push((arg + source.slice(from, i)).trim());
      return { args: args.filter(Boolean), end: i };
    } else if (char === "," && depth === 1) {
      args.push((arg + source.slice(from, i)).trim());
      arg = "";
      from = i + 1;
    }
  }
  return { args: [], end: -1 };
}

function findViolations(source) {
  const hits = [];
  for (const rule of RULES) {
    for (const match of source.matchAll(rule.pattern)) {
      const open = match.index + match[0].length - 1;
      const { args, end } = callArguments(source, open);
      if (end !== -1 && rule.isViolation(args)) {
        const line = source.slice(0, match.index).split("\n").length;
        hits.push({ line, message: rule.message });
      }
    }
  }
  return hits;
}

// Self-check: [source, expected violation count].
const SELF_TEST = [
  [
    "d.toLocaleDateString(l, {\n  dateStyle: 'medium',\n  timeStyle: 'short',\n})",
    1,
  ],
  ["d.toLocaleDateString(l, { month: 'long' /* timeStyle */ })", 0],
  ["d.toLocaleDateString(l, options)", 0],
  ["d.toLocaleString(l, { timeStyle: 'short' })", 0],
  ["await ctx.storage.store(new Blob([bytes]))", 1],
  ["ctx.storage.store(\n  new Blob([a, ','], { endings: 'native' }),\n)", 1],
  // biome-ignore lint/suspicious/noTemplateCurlyInString: source under test
  ["ctx.storage.store(new Blob([`(${f(a)}`], { type: 'text/csv' }))", 0],
  ["ctx.storage.store(new Blob(parts, options))", 0],
  ["ctx.storage.store(new Blob(parts, { ...options }))", 0],
  ["ctx.storage.store(blob)", 0],
];
for (const [source, expected] of SELF_TEST) {
  const found = findViolations(source).length;
  if (found !== expected) {
    console.error(
      `✗ check-patterns self-test: expected ${expected}, found ${found} in:\n${source}`,
    );
    process.exit(1);
  }
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (EXTENSIONS.has(extname(path)) && !TEST_FILE.test(name)) yield path;
  }
}

const hits = [];
for (const dir of SCAN_DIRS) {
  for (const file of walk(join(root, dir))) {
    for (const { line, message } of findViolations(
      readFileSync(file, "utf8"),
    )) {
      hits.push(`${relative(root, file)}:${line}: ${message}`);
    }
  }
}

if (hits.length > 0) {
  console.error("✗ Runtime-breaking call patterns found:");
  for (const hit of hits) console.error(`  ${hit}`);
  process.exit(1);
}
console.log("✓ No runtime-breaking call patterns");
