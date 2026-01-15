const fs = require("fs");
const path = require("path");

const files = fs
  .readdirSync("packages/backend/convex")
  .filter(
    (f) =>
      f.endsWith(".ts") &&
      !f.includes(".test.ts") &&
      f !== "schema.ts" &&
      f !== "seed.ts" &&
      f !== "convex.config.ts" &&
      f !== "auth.config.ts" &&
      f !== "seedFresh.ts" &&
      f !== "seedFreshAction.ts",
  );

let totalMutations = 0;
const withChecks = [];
const missingChecks = [];

for (const file of files) {
  const filePath = path.join("packages/backend/convex", file);
  const content = fs.readFileSync(filePath, "utf8");

  // Basic regex to find mutation definitions
  // Matches "export const ... = mutation({"
  const mutationRegex = /export const (\w+) = mutation\(\{/g;
  let match;

  while ((match = mutationRegex.exec(content)) !== null) {
    totalMutations++;
    const mutationName = match[1];
    const startIndex = match.index;

    // Find the end of this mutation block by tracking braces
    let braceCount = 0;
    let foundStart = false;
    let endIndex = -1;
    for (let i = startIndex; i < content.length; i++) {
      if (content[i] === "{") {
        braceCount++;
        foundStart = true;
      } else if (content[i] === "}") {
        braceCount--;
      }
      if (foundStart && braceCount === 0) {
        endIndex = i;
        break;
      }
    }

    const mutationBlock = content.substring(startIndex, endIndex + 1);

    // Check if requirePermission, canInitiateWorkflow, or canApproveAtStep is called
    const hasPermissionCheck =
      mutationBlock.includes("requirePermission") ||
      mutationBlock.includes("canInitiateWorkflow") ||
      mutationBlock.includes("canApproveAtStep");

    if (hasPermissionCheck) {
      withChecks.push({ file, mutationName });
    } else {
      missingChecks.push({ file, mutationName, content: mutationBlock });
    }
  }
}

console.log(
  JSON.stringify(
    {
      totalMutations,
      withChecks,
      missingChecks,
    },
    null,
    2,
  ),
);
