/**
 * Shared test setup for convex-test.
 *
 * Import `modules` from this file in all test files:
 *
 * ```typescript
 * import { modules } from "./testSetup";
 * import schema from "../schema";
 *
 * test("example", async () => {
 *   const t = convexTest(schema, modules);
 *   // ...
 * });
 * ```
 */

import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

type ModuleLoader = () => Promise<unknown>;

function mergeModuleMaps(
  ...maps: Array<Record<string, ModuleLoader> | null | undefined>
): Record<string, ModuleLoader> {
  const merged: Record<string, ModuleLoader> = {};
  for (const map of maps) {
    if (!map) continue;
    for (const [key, value] of Object.entries(map)) {
      merged[key] = value;
    }
  }
  return merged;
}

function withoutDtsFiles(
  modules: Record<string, ModuleLoader>,
): Record<string, ModuleLoader> {
  return Object.fromEntries(
    Object.entries(modules).filter(([path]) => !path.endsWith(".d.ts")),
  );
}

const globModules =
  typeof import.meta.glob === "function"
    ? withoutDtsFiles(
        mergeModuleMaps(
          import.meta.glob("../convex/**/*.ts") as Record<string, ModuleLoader>,
          import.meta.glob("../convex/**/*.js") as Record<string, ModuleLoader>,
        ),
      )
    : null;

const packageRootUrl = new URL("../", import.meta.url);
const packageRootPath = fileURLToPath(packageRootUrl);

function listConvexModules(): string[] {
  const convexRootPath = join(packageRootPath, "convex");
  const results: string[] = [];

  const visit = (absoluteDirPath: string, relativeDirPath: string) => {
    const entries = readdirSync(absoluteDirPath);
    for (const entry of entries) {
      const absolutePath = join(absoluteDirPath, entry);
      const relativePath = relativeDirPath
        ? `${relativeDirPath}/${entry}`
        : entry;
      const stats = statSync(absolutePath);
      if (stats.isDirectory()) {
        visit(absolutePath, relativePath);
        continue;
      }
      if (!relativePath.endsWith(".ts") && !relativePath.endsWith(".js")) {
        continue;
      }
      if (relativePath.endsWith(".d.ts")) {
        continue;
      }
      results.push(relativePath);
    }
  };

  visit(convexRootPath, "convex");
  return results;
}

const filesystemModules = Object.fromEntries(
  listConvexModules().map((path) => [
    path,
    // Dynamic path per convex module file; static import string is not possible.
    // biome-ignore lint/nursery/noDynamicImportPath: runtime discovery of convex/**/*.ts
    () => import(new URL(path, packageRootUrl).href),
  ]),
) as Record<string, ModuleLoader>;

export const modules = (globModules ?? filesystemModules ?? {}) as Record<
  string,
  ModuleLoader
>;
