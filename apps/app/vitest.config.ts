import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const appSource = resolve(fileURLToPath(new URL(".", import.meta.url)), "src");

export default defineConfig({
  resolve: {
    alias: {
      "@": appSource,
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
