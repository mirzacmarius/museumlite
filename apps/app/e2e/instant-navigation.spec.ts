import { instant } from "@next/playwright";
import { expect, test } from "@playwright/test";
import { E2E_OBJECT_TITLE } from "./fixtures";

// Inside instant() the server streams nothing new, so each assertion checks
// what the prefetched shell shows the moment the link is clicked. URLs carry
// no locale prefix, as in the app (the proxy rewrites them).

test("Overview to Object Catalog is instant", async ({ page }) => {
  await page.goto("/");
  const catalogLink = page.getByRole("link", {
    name: "Object Catalog",
    exact: true,
  });
  await expect(catalogLink).toBeVisible();

  await instant(page, async () => {
    await catalogLink.click();
    await page.waitForURL((url) => url.pathname.endsWith("/objects"));
    await expect(
      page.getByRole("heading", { name: "Object Catalog" }),
    ).toBeVisible();
  });
});

test("Object Catalog to an object shows its skeleton at once", async ({
  page,
}) => {
  await page.goto("/objects");
  const objectLink = page.getByRole("link", { name: E2E_OBJECT_TITLE });
  await expect(objectLink).toBeVisible();

  await instant(page, async () => {
    await objectLink.click();
    await page.waitForURL((url) => /\/objects\/[^/]+$/.test(url.pathname));
    await expect(page.getByTestId("object-detail-skeleton")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: E2E_OBJECT_TITLE }),
    ).toHaveCount(0);
  });

  await expect(
    page.getByRole("heading", { name: E2E_OBJECT_TITLE }),
  ).toBeVisible();
});

test("Moving between settings pages is instant", async ({ page }) => {
  await page.goto("/settings/organization");
  const usersLink = page
    .locator('a[href="/settings/users"]')
    .filter({ visible: true });
  await expect(usersLink).toBeVisible();

  await instant(page, async () => {
    await usersLink.click();
    await page.waitForURL((url) => url.pathname.endsWith("/settings/users"));
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
  });
});
