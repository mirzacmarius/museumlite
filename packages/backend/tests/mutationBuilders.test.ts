import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, test } from "vitest";

const convexRoot = join(__dirname, "..", "convex");
const builderModule = "utils/mutationBuilders.ts";
const authFactoryModule = "utils/convexAuth.ts";

function productionSources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "_generated" ? [] : productionSources(path);
    }
    return /\.tsx?$/.test(entry.name) && !entry.name.endsWith(".test.ts")
      ? [path]
      : [];
  });
}

function rawMutationImports(source: string) {
  const imports = source.matchAll(
    /import\s*\{([^}]*)\}\s*from\s*"[^"]*_generated\/server"/g,
  );
  return [...imports].flatMap((match) =>
    (match[1] ?? "")
      .split(",")
      .map((name) => name.trim())
      .filter((name) => /^(mutation|internalMutation)\b/.test(name)),
  );
}

describe("projection writer coverage", () => {
  test("production mutations register through the projection-triggered builders", () => {
    const offenders = productionSources(convexRoot)
      .map((path) => relative(convexRoot, path))
      .filter((path) => path !== builderModule)
      .filter((path) => {
        const names = rawMutationImports(
          readFileSync(join(convexRoot, path), "utf8"),
        );
        if (path === authFactoryModule) {
          return names.some((name) => name !== "mutation as rawMutation");
        }
        return names.length > 0;
      });

    expect(offenders).toEqual([]);
  });

  test("the organization mutation factory applies projection triggers", () => {
    const source = readFileSync(join(convexRoot, authFactoryModule), "utf8");
    expect(source).toContain("withProjectionTriggers(ctx).db");
  });
});
