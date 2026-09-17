import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import {
  authedForUser,
  type ConvexTest,
  createConvexTest,
  createOrgUserWithPermissions,
} from "./testHarness";

interface LibraryAuthFixture {
  userAId: Id<"users">;
  organizationBId: Id<"organizations">;
}

async function setupLibraryAuthFixture(
  t: ConvexTest,
): Promise<LibraryAuthFixture> {
  const orgA = await createOrgUserWithPermissions(
    t,
    [
      "collections.read",
      "collections.create",
      "organization.manage_settings",
    ],
    {
      organizationName: "Library A",
      slugPrefix: "library-a",
      enabledModules: ["library", "accounts"],
      subscriptionTier: "pro",
      userEmailPrefix: "library-a-user",
    },
  );

  const orgB = await createOrgUserWithPermissions(
    t,
    [
      "collections.read",
      "collections.create",
      "organization.manage_settings",
    ],
    {
      organizationName: "Library B",
      slugPrefix: "library-b",
      enabledModules: ["library", "accounts"],
      subscriptionTier: "pro",
      userEmailPrefix: "library-b-user",
    },
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

  return {
    userAId: orgA.userId,
    organizationBId: orgB.organizationId,
  };
}

describe("library tenant authorization", () => {
  test("rejects listing items across tenants", async () => {
    const t = createConvexTest();
    const { userAId, organizationBId } = await setupLibraryAuthFixture(t);
    const authed = authedForUser(t, userAId);

    await expect(
      authed.query(api.library.items.list, {
        organizationId: organizationBId,
        paginationOpts: { numItems: 10, cursor: null },
      }),
    ).rejects.toThrow("Permission denied: collections.read");
  });

  test("rejects creating items across tenants", async () => {
    const t = createConvexTest();
    const { userAId, organizationBId } = await setupLibraryAuthFixture(t);
    const authed = authedForUser(t, userAId);

    await expect(
      authed.mutation(api.library.items.create, {
        organizationId: organizationBId,
        itemType: "book",
        title: "Cross Tenant Book",
        authors: ["Author"],
        language: "en",
      }),
    ).rejects.toThrow("Permission denied: collections.create");
  });

  test("rejects dashboard reports across tenants", async () => {
    const t = createConvexTest();
    const { userAId, organizationBId } = await setupLibraryAuthFixture(t);
    const authed = authedForUser(t, userAId);

    await expect(
      authed.query(api.library.reports.getDashboardStats, {
        organizationId: organizationBId,
        asOf: 0,
      }),
    ).rejects.toThrow("Permission denied: collections.read");
  });

  test("rejects updating settings across tenants", async () => {
    const t = createConvexTest();
    const { userAId, organizationBId } = await setupLibraryAuthFixture(t);
    const authed = authedForUser(t, userAId);

    await expect(
      authed.mutation(api.library.settings.update, {
        organizationId: organizationBId,
        defaultLoanPeriodDays: 21,
      }),
    ).rejects.toThrow("Permission denied: organization.manage_settings");
  });
});
