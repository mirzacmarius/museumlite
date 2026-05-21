#!/usr/bin/env bun
/**
 * Safe mechanical fixes for async-parallel / async-await-in-loop (Convex).
 * Run: bun packages/backend/scripts/fix-async-parallel.mjs
 */
import fs from "node:fs";
import path from "node:path";

const BACKEND_DIR = path.resolve(import.meta.dirname, "..");
const CONVEX_DIR = path.join(BACKEND_DIR, "convex");
const TESTS_DIR = path.join(BACKEND_DIR, "tests");
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

function fixDeleteStorageThenDbDelete(content) {
  return content.replace(
    /await deleteStorageIds\(([^)]+)\);\s*\n\s*await ctx\.db\.delete\(([^)]+)\);/g,
    "await Promise.all([\n              deleteStorageIds($1),\n              ctx.db.delete($2),\n            ]);",
  );
}

function fixAuditThenDbDelete(content) {
  return content.replace(
    /await ctx\.runMutation\(internal\.audit\.logAction, ([\s\S]*?)\);\s*\n\s*await ctx\.db\.delete\(([^)]+)\);/g,
    (match, auditArgs, deleteArg) => {
      if (auditArgs.length > 1500) return match;
      return `await Promise.all([\n      ctx.runMutation(internal.audit.logAction, ${auditArgs}),\n      ctx.db.delete(${deleteArg}),\n    ]);`;
    },
  );
}

function fixRequireModuleThenPermission(content) {
  const moduleFns = [
    "requireAutomotiveModule",
    "requireNaturalHistoryModule",
    "requireCoinsStampsModule",
    "requireArchiveModule",
  ];
  let next = content;
  for (const fn of moduleFns) {
    const re = new RegExp(
      `await ${fn}\\(([^)]+)\\);\\s*\\n\\s*await requirePermission\\(([^;]+)\\);`,
      "g",
    );
    next = next.replace(
      re,
      (_m, a1, a2) =>
        `await Promise.all([\n      ${fn}(${a1}),\n      requirePermission(${a2}),\n    ]);`,
    );
  }
  return next;
}

function fixPatchThenAuditStandalone(content) {
  return content.replace(
    /await ctx\.db\.patch\(([^;\n]+)\);\s*\n\s*await ctx\.runMutation\(internal\.audit\.logAction, ([\s\S]*?)\);/g,
    (match, patchArgs, auditArgs) => {
      if (auditArgs.length > 1500) return match;
      return `await Promise.all([\n      ctx.db.patch(${patchArgs}),\n      ctx.runMutation(internal.audit.logAction, ${auditArgs}),\n    ]);`;
    },
  );
}

function fixGetAuthThenDbGet(content) {
  return content.replace(
    /const userId = await getAuthUserId\(ctx\);\s*\n\s*if \(!userId\) \{\s*\n\s*throw new Error\("Not authenticated"\);\s*\n\s*\}\s*\n\s*const (\w+) = await ctx\.db\.get\(([^)]+)\);/g,
    `const [userId, $1] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get($2),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }`,
  );
}

function fixGetAuthThenRequirePermission(content) {
  return content.replace(
    /const userId = await getAuthUserId\(ctx\);\s*\n\s*if \(!userId\) \{\s*\n\s*throw new Error\("Not authenticated"\);\s*\n\s*\}\s*\n\s*await requirePermission\(([^)]+)\);/g,
    `const [userId] = await Promise.all([
      getAuthUserId(ctx),
      requirePermission($1),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }`,
  );
}

function fixPermissionThenCollect(content) {
  return content.replace(
    /await requirePermission\(([^)]+)\);\s*\n\s*const (\w+) = await ctx\.db\s*\n\s*\.query\("([^"]+)"\)\s*\n\s*\.withIndex\(([\s\S]*?)\)\s*\n\s*\.collect\(\);/g,
    (match, permArgs, varName, table, indexBlock) => {
      if (match.includes("Promise.all")) return match;
      return `const [, ${varName}] = await Promise.all([
      requirePermission(${permArgs}),
      ctx.db
        .query("${table}")
        .withIndex(${indexBlock})
        .collect(),
    ] as const);`;
    },
  );
}

function fixLoanCancelBulk(content) {
  return content.replace(
    /\/\/ Update loan status\s*\n\s*await ctx\.db\.patch\(loanId, \{\s*\n\s*status: "cancelled",\s*\n\s*\}\);\s*\n\s*\/\/ Update collection statuses back to active\s*\n\s*const loanItems = await ctx\.db\s*\n\s*\.query\("loanItems"\)\s*\n\s*\.withIndex\("by_loan", \(q\) => q\.eq\("loanId", loanId\)\)\s*\n\s*\.collect\(\);/g,
    `// Update loan status and load items in parallel
        const [, loanItems] = await Promise.all([
          ctx.db.patch(loanId, {
            status: "cancelled",
          }),
          ctx.db
            .query("loanItems")
            .withIndex("by_loan", (q) => q.eq("loanId", loanId))
            .collect(),
        ]);`,
  );
}

function apply(filePath) {
  if (SKIP_FILES.has(path.basename(filePath))) return false;
  let content = fs.readFileSync(filePath, "utf8");
  const original = content;
  content = fixAuthParallel(content);
  content = fixGetAuthThenDbGet(content);
  content = fixGetAuthThenRequirePermission(content);
  content = fixPermissionThenCollect(content);
  content = fixSyncAuditParallel(content);
  content = fixConsecutiveDbGet(content);
  content = fixConsecutiveRunQuery(content);
  content = fixPatchThenAudit(content);
  content = fixDeleteThenAudit(content);
  content = fixPermissionPatchAudit(content);
  content = fixPermissionThenPatchAudit(content);
  content = fixLogActionThenNotify(content);
  content = fixDeleteStorageThenDbDelete(content);
  content = fixAuditThenDbDelete(content);
  content = fixRequireModuleThenPermission(content);
  content = fixPatchThenAuditStandalone(content);
  content = fixLoanCancelBulk(content);
  if (content !== original) {
    fs.writeFileSync(filePath, content);
    return true;
  }
  return false;
}

const files = [...walkTs(CONVEX_DIR), ...walkTs(TESTS_DIR)];
let changed = 0;
for (const f of files) {
  if (apply(f)) {
    changed += 1;
    console.log(path.relative(CONVEX_DIR, f));
  }
}
console.log(`\nChanged ${changed} files`);
