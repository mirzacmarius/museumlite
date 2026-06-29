import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import {
  authedForUser,
  createConvexTest,
  createOrgUserWithPermissions,
} from "./testHarness";

describe("library cross-tenant authorization", () => {
  test("org A user cannot list items for org B", async () => {
    const t = createConvexTest();
    const orgA = await createOrgUserWithPermissions(
      t,
      ["collections.read"],
      { enabledModules: ["library"], slugPrefix: "lib-a" },
    );
    const orgB = await createOrgUserWithPermissions(
      t,
      ["collections.read"],
      { enabledModules: ["library"], slugPrefix: "lib-b" },
    );

    await expect(
      authedForUser(t, orgA.userId).query(api.library.items.list, {
        organizationId: orgB.organizationId,
        paginationOpts: { numItems: 10, cursor: null },
      }),
    ).rejects.toThrow("Permission denied: collections.read");
  });

  test("org A user cannot create item in org B", async () => {
    const t = createConvexTest();
    const orgA = await createOrgUserWithPermissions(
      t,
      ["collections.create"],
      { enabledModules: ["library"], slugPrefix: "lib-a" },
    );
    const orgB = await createOrgUserWithPermissions(
      t,
      ["collections.create"],
      { enabledModules: ["library"], slugPrefix: "lib-b" },
    );

    await expect(
      authedForUser(t, orgA.userId).mutation(api.library.items.create, {
        organizationId: orgB.organizationId,
        itemType: "book",
        title: "Cross Tenant Book",
        authors: ["Author"],
        language: "en",
      }),
    ).rejects.toThrow("Permission denied: collections.create");
  });

  test("org A user cannot get dashboard stats for org B", async () => {
    const t = createConvexTest();
    const orgA = await createOrgUserWithPermissions(
      t,
      ["collections.read"],
      { enabledModules: ["library"], slugPrefix: "lib-a" },
    );
    const orgB = await createOrgUserWithPermissions(
      t,
      ["collections.read"],
      { enabledModules: ["library"], slugPrefix: "lib-b" },
    );

    await expect(
      authedForUser(t, orgA.userId).query(
        api.library.reports.getDashboardStats,
        { organizationId: orgB.organizationId },
      ),
    ).rejects.toThrow("Permission denied: collections.read");
  });

  test("org A user cannot update settings for org B", async () => {
    const t = createConvexTest();
    const orgA = await createOrgUserWithPermissions(
      t,
      ["organization.manage_settings"],
      { enabledModules: ["library"], slugPrefix: "lib-a" },
    );
    const orgB = await createOrgUserWithPermissions(
      t,
      ["organization.manage_settings"],
      { enabledModules: ["library"], slugPrefix: "lib-b" },
    );

    await t.run(async (ctx) => {
      await ctx.db.insert("librarySettings", {
        organizationId: orgB.organizationId,
        defaultLoanPeriodDays: 14,
        defaultRenewalLimit: 2,
        renewalPeriodDays: 14,
        maxRenewalsAllowed: 2,
        finePerDayDefault: 0.25,
        gracePeriodDays: 1,
        holdExpirationDays: 7,
        maxHoldsPerPatron: 10,
        autoGenerateCardNumbers: true,
        classificationSystem: "dewey",
        createdAt: Date.now(),
      });
    });

    await expect(
      authedForUser(t, orgA.userId).mutation(api.library.settings.update, {
        organizationId: orgB.organizationId,
        defaultLoanPeriodDays: 21,
      }),
    ).rejects.toThrow("Permission denied: organization.manage_settings");
  });
});
