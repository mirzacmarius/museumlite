#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const patchesDir = path.join(__dirname, "..", "patches");
const nodeModulesDir = path.join(__dirname, "..", "node_modules");

function applyPatch(patchFile) {
  const patchContent = fs.readFileSync(patchFile, "utf-8");
  const patchName = path.basename(patchFile, ".patch");
  const [packageName] = patchName.split("+");

  // Extract the file path from the patch
  const fileMatch = patchContent.match(/^--- a\/(.+)$/m);
  if (!fileMatch) {
    console.error(
      `Failed to apply patch for ${packageName}: could not parse ${path.basename(patchFile)}`,
    );
    return false;
  }

  const filePath = fileMatch[1].replace("node_modules/", "");
  const targetFile = path.join(nodeModulesDir, filePath);

  if (!fs.existsSync(targetFile)) {
    console.error(
      `Failed to apply required patch for ${packageName} (${path.basename(patchFile)}):`,
    );
    console.error(`  Target file not found: ${filePath}`);
    console.error(
      "  The dependency may have been upgraded or its layout changed. Check patches/ and update or remove the patch.",
    );
    return false;
  }

  // Apply the patch: replace the old line with the new line
  let fileContent = fs.readFileSync(targetFile, "utf-8");
  const originalContent = fileContent;

  // Find and replace the problematic line
  if (fileContent.includes("const stableRef = useRef<TCallback>();")) {
    fileContent = fileContent.replace(
      "const stableRef = useRef<TCallback>();",
      "const stableRef = useRef<TCallback | undefined>(undefined);",
    );

    if (fileContent !== originalContent) {
      fs.writeFileSync(targetFile, fileContent, "utf-8");
      console.log(`✓ Applied patch: ${packageName}`);
      return true;
    }
  }

  console.log(`ℹ Patch already applied or not needed: ${packageName}`);
  return true;
}

function ensureBackendPackageLink(packageName) {
  const backendNodeModulesDir = path.join(
    __dirname,
    "..",
    "packages",
    "backend",
    "node_modules",
  );
  const backendPackageDir = path.join(backendNodeModulesDir, packageName);
  const rootPackageDir = path.join(nodeModulesDir, packageName);

  if (fs.existsSync(backendPackageDir)) return true;
  if (!fs.existsSync(rootPackageDir)) {
    console.error(`Missing required backend dependency: ${packageName}`);
    return false;
  }

  try {
    if (fs.lstatSync(backendPackageDir).isSymbolicLink()) {
      fs.unlinkSync(backendPackageDir);
    } else {
      return true;
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  fs.mkdirSync(backendNodeModulesDir, { recursive: true });
  const relativeTarget = path.relative(backendNodeModulesDir, rootPackageDir);
  fs.symlinkSync(
    relativeTarget,
    backendPackageDir,
    process.platform === "win32" ? "junction" : "dir",
  );
  console.log(`Linked backend ${packageName} dependency`);
  return true;
}

/**
 * Source replacements for dependency defects that have no released fix.
 * Each `find` must match exactly once unless `replace` is already present.
 */
const SOURCE_REPLACEMENTS = [
  {
    // convex-test search crashed on documents without the searched field;
    // Convex leaves such documents out of the search index.
    packageName: "convex-test",
    file: "convex-test/dist/index.js",
    find: `            const documentWords = result
                .split(/\\s+/)`,
    replace: `            if (typeof result !== "string") {
                return false;
            }
            const documentWords = result
                .split(/\\s+/)`,
  },
];

function applySourceReplacement({ packageName, file, find, replace }) {
  const targetFile = path.join(nodeModulesDir, file);
  if (!fs.existsSync(targetFile)) {
    console.error(`Failed to patch ${packageName}: ${file} not found`);
    return false;
  }
  const content = fs.readFileSync(targetFile, "utf-8");
  if (content.includes(replace)) {
    console.log(`ℹ Patch already applied: ${packageName}`);
    return true;
  }
  if (content.split(find).length !== 2) {
    console.error(
      `Failed to patch ${packageName}: expected source not found once in ${file}. Update or remove the replacement.`,
    );
    return false;
  }
  fs.writeFileSync(targetFile, content.replace(find, replace), "utf-8");
  console.log(`✓ Applied patch: ${packageName}`);
  return true;
}

const sourceReplacementsApplied = SOURCE_REPLACEMENTS.map(
  applySourceReplacement,
).every(Boolean);
if (!sourceReplacementsApplied) process.exitCode = 1;

// Find and apply all patches
if (fs.existsSync(patchesDir)) {
  const patches = fs
    .readdirSync(patchesDir)
    .flatMap((file) =>
      file.endsWith(".patch") ? [path.join(patchesDir, file)] : [],
    );

  if (patches.length === 0) {
    console.log("No patches found");
    process.exit(0);
  }

  let success = true;
  patches.forEach((patch) => {
    if (!applyPatch(patch)) {
      success = false;
    }
  });

  for (const packageName of ["typescript", "sharp"]) {
    success = ensureBackendPackageLink(packageName) && success;
  }

  process.exit(success && sourceReplacementsApplied ? 0 : 1);
} else {
  console.log("No patches directory found");
  process.exit(0);
}
