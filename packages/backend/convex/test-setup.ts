/**
 * Shared test setup for convex-test.
 *
 * Import `modules` from this file in all test files:
 *
 * ```typescript
 * import { modules } from "./test-setup";
 * import schema from "./schema";
 *
 * test("example", async () => {
 *   const t = convexTest(schema, modules);
 *   // ...
 * });
 * ```
 */

// Vite/Vitest import.meta.glob to load all Convex modules
// Required by convex-test for module resolution
export const modules = import.meta.glob("./**/*.ts");
