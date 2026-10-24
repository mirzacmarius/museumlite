import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  // Next.js keeps JSX for its own compiler; component tests need it compiled.
  esbuild: { jsx: "automatic" },
});
