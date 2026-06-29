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

  process.exit(success ? 0 : 1);
} else {
  console.log("No patches directory found");
  process.exit(0);
}
