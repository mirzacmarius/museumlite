#!/usr/bin/env bun
/**
 * Mechanical fixes for React Review warnings.
 * Run: bun apps/app/scripts/fix-react-review.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../../..");

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "_generated",
  ".next",
  "dist",
]);

function walk(dir, exts, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, exts, files);
    else if (exts.some((e) => entry.name.endsWith(e))) files.push(full);
  }
  return files;
}

function fixHeadingFontBold(content) {
  return content.replace(
    /<(h[1-6])(\s[^>]*?)font-bold([^>]*>)/gi,
    "<$1$2font-semibold$3",
  );
}

function fixLoadingEllipsis(content) {
  let next = content;
  next = next.replace(/>(\s*)Loading\.\.\.(\s*)</g, ">$1Loading…$2<");
  next = next.replace(/>(\s*)loading\.\.\.(\s*)</gi, ">$1loading…$2<");
  next = next.replace(/>(\s*)Load older logs\.\.\.(\s*)</g, ">$1Load older logs…$2<");
  next = next.replace(/"Loading\.\.\."/g, '"Loading…"');
  next = next.replace(/'Loading\.\.\.'/g, "'Loading…'");
  next = next.replace(/"Searching\.\.\."/g, '"Searching…"');
  next = next.replace(/"Search\.\.\."/g, '"Search…"');
  next = next.replace(/"Search objects\.\.\."/g, '"Search objects…"');
  next = next.replace(/"Saving\.\.\."/g, '"Saving…"');
  next = next.replace(/"Scanning\.\.\."/g, '"Scanning…"');
  next = next.replace(/Loading logs\.\.\./g, "Loading logs…");
  return next;
}

function fixEmDashInJsx(content) {
  // UI copy only: em dash between words in JSX text nodes
  return content.replace(
    />([^<{}]*?) — ([^<{}]*?)</g,
    (match, before, after) => {
      if (match.includes("{")) return match;
      return `>${before}, ${after}<`;
    },
  );
}

function fixBgBlack(content) {
  return content.replace(/\bbg-black\b/g, "bg-gray-950");
}

function fixAuthParallel(content) {
  let next = content;
  const pairs = [
    ["requireModuleEnabled", "requirePermission"],
    ["requireLoansAccess", "requirePermission"],
    ["requireExhibitionsAccess", "requirePermission"],
    ["requireDeaccessionsAccess", "requirePermission"],
    ["requireAccessionsAccess", "requirePermission"],
    ["requireInsuranceAccess", "requirePermission"],
    ["requireConservationAccess", "requirePermission"],
  ];
  for (const [first, second] of pairs) {
    const re = new RegExp(
      `await ${first}\\(([^)]+)\\);\\s*\\n\\s*await ${second}\\(([^)]+)\\);`,
      "g",
    );
    next = next.replace(
      re,
      `await Promise.all([\n      ${first}($1),\n      ${second}($2),\n    ]);`,
    );
  }
  return next;
}

function applyFixes(filePath) {
  const rel = path.relative(ROOT, filePath);
  let content = fs.readFileSync(filePath, "utf8");
  const original = content;

  if (filePath.endsWith(".tsx") || filePath.endsWith(".jsx")) {
    content = fixHeadingFontBold(content);
    content = fixLoadingEllipsis(content);
    content = fixBgBlack(content);
    if (
      rel.includes("exhibition-timeline") ||
      rel.includes("loan-detail-hero") ||
      rel.includes("loan-list-kpis") ||
      rel.includes("inspector-panel")
    ) {
      content = fixEmDashInJsx(content);
    }
  }

  if (rel === "packages/backend/convex/email/senders.tsx") {
    content = content.replace(/#000000/g, "#0a0a0f").replace(/#000\b/g, "#0a0a0f");
  }

  if (filePath.endsWith(".ts") && rel.startsWith("packages/backend/convex")) {
    content = fixAuthParallel(content);
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content);
    return true;
  }
  return false;
}

const tsxFiles = [
  ...walk(path.join(ROOT, "apps"), [".tsx", ".jsx"]),
  ...walk(path.join(ROOT, "packages/ui"), [".tsx", ".jsx"]),
  ...walk(path.join(ROOT, "packages/email"), [".tsx", ".jsx"]),
];

const convexFiltered = walk(path.join(ROOT, "packages/backend/convex"), [
  ".ts",
]).filter((f) => !f.includes("_generated"));

let changed = 0;
for (const f of [...tsxFiles, ...convexFiltered]) {
  if (applyFixes(f)) {
    changed++;
    console.log("fixed:", path.relative(ROOT, f));
  }
}

console.log(`\nDone. ${changed} files updated.`);
