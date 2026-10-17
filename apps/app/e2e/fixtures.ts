import { type BrowserContext, test as base } from "@playwright/test";

/** Object the global setup adds to the QA catalog for navigation tests. */
export const E2E_OBJECT_TITLE = "Instant navigation fixture";

/**
 * Every test shares one signed-in browser context. Convex Auth rotates the
 * refresh token and rejects the old one after a short grace period, so a
 * fresh context per test would start from a stale session and land on the
 * login page.
 */
export const test = base.extend<object, { signedInContext: BrowserContext }>({
  signedInContext: [
    async ({ browser }, use, workerInfo) => {
      const { baseURL, storageState } = workerInfo.project.use;
      const context = await browser.newContext({ baseURL, storageState });
      await use(context);
      await context.close();
    },
    { scope: "worker" },
  ],
  page: async ({ signedInContext }, use) => {
    const page = await signedInContext.newPage();
    await use(page);
    await page.close();
  },
});
