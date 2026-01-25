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

const meta = import.meta as {
  glob?: (pattern: string) => Record<string, ModuleLoader>;
  dir?: string;
};

const globModules =
  typeof meta.glob === "function"
    ? (meta.glob("../convex/**/*.{ts,js}") as Record<string, ModuleLoader>)
    : null;

const bun = (
  globalThis as {
    Bun?: {
      Glob: new (
        pattern: string,
      ) => {
        scanSync: (options?: { cwd?: string }) => string[];
      };
    };
  }
).Bun;

const bunModules = bun
  ? Object.fromEntries(
      [
        ...new bun.Glob("../convex/**/*.{ts,js}").scanSync({
          cwd: meta.dir,
        }),
      ].map((path) => [
        path,
        () => import(new URL(path, import.meta.url).href),
      ]),
    )
  : null;

export const modules = (globModules ?? bunModules ?? {}) as Record<
  string,
  ModuleLoader
>;
