import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    server: { deps: { inline: ["convex-test", "@convex-dev/polar"] } },
    setupFiles: ["tests/vitest.setup.ts"],
    include: ["tests/**/*.test.ts"],
  },
});
