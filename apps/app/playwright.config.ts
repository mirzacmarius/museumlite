import { defineConfig, devices } from "@playwright/test";

/**
 * Instant-navigation checks against the local QA stack. Start it with
 * `bun run qa:backend`, `bun run qa:seed`, then
 * `EXPOSE_TESTING_API=1 bun run qa:app -- --build`, and run
 * `bun run test:e2e` from apps/app.
 */
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.QA_APP_URL ?? "http://localhost:3000",
    storageState: "../../.local-qa/storage-state.json",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : undefined,
  },
});
