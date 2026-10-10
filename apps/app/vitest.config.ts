import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const appRoot = fileURLToPath(new URL(".", import.meta.url));
const appSource = resolve(appRoot, "src");

export default defineConfig({
  resolve: {
    alias: {
      "@": appSource,
    },
  },
  // Next.js keeps JSX for its own compiler; component tests need it compiled.
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: [resolve(appRoot, "../../packages/ui/vitest.setup.ts")],
  },
});
