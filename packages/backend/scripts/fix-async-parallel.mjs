#!/usr/bin/env bun
/**
 * Safe mechanical fixes for async-parallel / async-await-in-loop (Convex).
 * Run: bun packages/backend/scripts/fix-async-parallel.mjs
 */
import fs from "node:fs";
import path from "node:path";

const CONVEX_DIR = path.resolve(import.meta.dirname, "../convex");
const SKIP_FILES = new Set([]);

function walkTs(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "_generated" || entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkTs(full, files);
    else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts"))
      files.push(full);
  }
  return files;
}

function fixAuthParallel(content) {
  let next = content;
  const pairs = [
    ["requireModuleEnabled", "requirePermission"],
    ["requireLoansAccess", "requirePermission"],
    ["requireExhibitionsAccess", "requirePermission"],
    ["requireExhibitionAccess", "requirePermission"],
    ["requireDeaccessionsAccess", "requirePermission"],
    ["requireAccessionsAccess", "requirePermission"],
    ["requireInsuranceAccess", "requirePermission"],
    ["requireConservationAccess", "requirePermission"],
    ["requireAppraisalsAccess", "requirePermission"],
    ["requireAssignmentsAccess", "requirePermission"],
    ["requireInstallationsAccess", "requirePermission"],
    ["requireInstallationAccess", "requirePermission"],
    ["requireReportingAccess", "requirePermission"],
    ["requireContactsAccess", "requirePermission"],
    ["requireMediaAccess", "requirePermission"],
    ["requireLocationsAccess", "requirePermission"],
    ["requireCollectionsAccess", "requirePermission"],
    ["requireLibraryAccess", "requirePermission"],
    ["requireTransitAccess", "requirePermission"],
    ["requireSitesAccess", "requirePermission"],
    ["requireSiteAccess", "requirePermission"],
    ["requireDashboardAccess", "requirePermission"],
    ["requireFeatureAccess", "requirePermission"],
  ];
  for (const [first, second] of pairs) {
    const re = new RegExp(
      `await ${first}\\(([^;]+)\\);\\s*\\n\\s*await ${second}\\(([^;]+)\\);`,
      "g",
    );
    next = next.replace(
      re,
      (_m, a1, a2) =>
        `await Promise.all([\n      ${first}(${a1}),\n      ${second}(${a2}),\n    ]);`,
    );
  }
  next = next.replace(
    /await (require\w+Access)\(([^)]+)\);\s*\n\s*await (requirePermission)\(\s*([\s\S]*?)\);/g,
    (_m, access, accessArgs, perm, permArgs) =>
      `await Promise.all([\n      ${access}(${accessArgs}),\n      ${perm}(\n${permArgs}\n    ),\n    ]);`,
  );
  return next;
}

function fixSyncAuditParallel(content) {
  return content.replace(
    /await (sync\w+SearchDocument)\(([^)]+)\);\s*\n(?:\s*\/\/[^\n]*\n)?\s*await (ctx\.runMutation\(internal\.audit\.logAction, \{[\s\S]*?\}\)),/g,
    "await Promise.all([\n      $1($2),\n      $3,\n    ]);",
  );
}

function fixConsecutiveDbGet(content) {
  return content.replace(
    /const (\w+) = await ctx\.db\.get\(([^)]+)\);\s*\n\s*const (\w+) = await ctx\.db\.get\(([^)]+)\);/g,
    (match, v1, id1, v2, id2) => {
      if (v1 === v2 || id1.trim() === id2.trim()) return match;
      return `const [${v1}, ${v2}] = await Promise.all([\n      ctx.db.get(${id1}),\n      ctx.db.get(${id2}),\n    ]);`;
    },
  );
}

function fixConsecutiveRunQuery(content) {
  return content.replace(
    /const (\w+) = await ctx\.runQuery\(([^)]+)\);\s*\n\s*const (\w+) = await ctx\.runQuery\(([^)]+)\);/g,
    (match, v1, q1, v2, q2) => {
      if (v1 === v2) return match;
      return `const [${v1}, ${v2}] = await Promise.all([\n      ctx.runQuery(${q1}),\n      ctx.runQuery(${q2}),\n    ]);`;
    },
  );
}

function fixPatchThenAudit(content) {
  return content.replace(
    /await ctx\.db\.patch\(([\s\S]*?)\);\s*\n\s*await ctx\.runMutation\(internal\.audit\.logAction, ([\s\S]*?)\);/g,
    (match, patchArgs, auditArgs) => {
      if (patchArgs.length > 1500 || auditArgs.length > 1500) return match;
      return `await Promise.all([\n      ctx.db.patch(${patchArgs}),\n      ctx.runMutation(internal.audit.logAction, ${auditArgs}),\n    ]);`;
    },
  );
}

function fixDeleteThenAudit(content) {
  return content.replace(
    /await ctx\.db\.delete\(([^)]+)\);\s*\n\s*await ctx\.runMutation\(internal\.audit\.logAction, ([\s\S]*?)\);/g,
    (match, deleteArg, auditArgs) => {
      if (auditArgs.length > 1500) return match;
      return `await Promise.all([\n      ctx.db.delete(${deleteArg}),\n      ctx.runMutation(internal.audit.logAction, ${auditArgs}),\n    ]);`;
    },
  );
}

function fixPermissionPatchAudit(content) {
  return content.replace(
    /await requirePermission\(([\s\S]*?)\);\s*\n\s*await Promise\.all\(\[\s*\n\s*ctx\.db\.patch\(([\s\S]*?)\),\s*\n\s*ctx\.runMutation\(internal\.audit\.logAction, ([\s\S]*?)\),\s*\n\s*\]\);/g,
    (match) => match,
  );
}

function fixPermissionThenPatchAudit(content) {
  return content.replace(
    /await requirePermission\(([\s\S]*?)\);\s*\n\s*await ctx\.db\.patch\(([\s\S]*?)\);\s*\n\s*await ctx\.runMutation\(internal\.audit\.logAction, ([\s\S]*?)\);/g,
    (match, permArgs, patchArgs, auditArgs) => {
      if (patchArgs.length > 1500 || auditArgs.length > 1500) return match;
      return `await requirePermission(${permArgs});\n    await Promise.all([\n      ctx.db.patch(${patchArgs}),\n      ctx.runMutation(internal.audit.logAction, ${auditArgs}),\n    ]);`;
    },
  );
}

function fixLogActionThenNotify(content) {
  return content.replace(
    /await ctx\.runMutation\(internal\.audit\.logAction, ([\s\S]*?)\);\s*\n\s*const (\w+) = await getUsersToNotifyForWorkflowStep\(([\s\S]*?)\);/g,
    (match, auditArgs, varName, notifyArgs) => {
      if (auditArgs.length > 800 || notifyArgs.length > 400) return match;
      return `const [, ${varName}] = await Promise.all([\n    ctx.runMutation(internal.audit.logAction, ${auditArgs}),\n    getUsersToNotifyForWorkflowStep(${notifyArgs}),\n  ]);`;
    },
  );
}

function apply(filePath) {
  if (SKIP_FILES.has(path.basename(filePath))) return false;
  let content = fs.readFileSync(filePath, "utf8");
  const original = content;
  content = fixAuthParallel(content);
  content = fixSyncAuditParallel(content);
  content = fixConsecutiveDbGet(content);
  content = fixConsecutiveRunQuery(content);
  content = fixPatchThenAudit(content);
  content = fixDeleteThenAudit(content);
  content = fixPermissionPatchAudit(content);
  content = fixPermissionThenPatchAudit(content);
  content = fixLogActionThenNotify(content);
  if (content !== original) {
    fs.writeFileSync(filePath, content);
    return true;
  }
  return false;
}

const files = walkTs(CONVEX_DIR);
let changed = 0;
for (const f of files) {
  if (apply(f)) {
    changed += 1;
    console.log(path.relative(CONVEX_DIR, f));
  }
}
console.log(`\nChanged ${changed} files`);
