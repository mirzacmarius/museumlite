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

// Resolved at compile time by Vitest/Vite — do not guard with typeof import.meta.glob.
export const modules = withoutDtsFiles(
  mergeModuleMaps(
    import.meta.glob("../convex/**/*.ts") as Record<string, ModuleLoader>,
    import.meta.glob("../convex/**/*.js") as Record<string, ModuleLoader>,
  ),
);
