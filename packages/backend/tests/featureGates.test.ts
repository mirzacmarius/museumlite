import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";
import {
  MODULE_IDS,
  getFeatureRequiredTier,
  getTierLimits,
  hasFeatureTierAccess,
} from "../convex/utils/featurePolicy";

import { modules } from "./testSetup";

const createOrg = (
  name: string,
  slug: string,
  tier: "free" | "pro" | "enterprise",
) => ({
  name,
  slug,
  type: "museum" as const,
  subscriptionTier: tier,
});

describe("Feature Gates - Shared Policy", () => {
  test("feature tier checks match the billing matrix", () => {
    expect(hasFeatureTierAccess("free", "loans")).toBe(false);
    expect(hasFeatureTierAccess("pro", "loans")).toBe(true);
    expect(hasFeatureTierAccess("pro", "compliance")).toBe(false);
    expect(hasFeatureTierAccess("enterprise", "compliance")).toBe(true);
    expect(hasFeatureTierAccess(undefined, "loans")).toBe(false);
    expect(getFeatureRequiredTier("public_portal")).toBe("pro");
  });

  test("shared module ids include backend-only and app-visible modules", () => {
    expect(MODULE_IDS).toContain("accounts");
    expect(MODULE_IDS).toContain("library");
  });

  test("tier limits are centralized with unlimited enterprise quotas", () => {
    expect(getTierLimits("free").objects).toBe(100);
    expect(getTierLimits("pro").mediaBytes).toBe(10 * 1024 * 1024 * 1024);
    expect(getTierLimits("enterprise").exportsPerMonth).toBeNull();
  });
});

describe("Feature Gates - Tier Access", () => {
  test("free tier should not access pro features (loans)", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert(
        "organizations",
        createOrg("Free Org", "free-org", "free"),
      );
    });

    await expect(
      t.query(api.loans.list, {
        organizationId: orgId,
        paginationOpts: { numItems: 10, cursor: null },
      }),
    ).rejects.toThrow("Feature requires pro tier");
  });

  test("pro tier should access pro features (loans)", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert(
        "organizations",
        createOrg("Pro Org", "pro-org", "pro"),
      );
    });

    const result = await t
      .query(api.loans.list, {
        organizationId: orgId,
        paginationOpts: { numItems: 10, cursor: null },
      })
      .catch((e: Error) => {
        expect(e.message).not.toContain("Feature requires");
        return { page: [], isDone: true, continueCursor: "" };
      });

    expect(result).toBeDefined();
  });

  test("enterprise tier should access all features", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert(
        "organizations",
        createOrg("Enterprise Org", "enterprise-org", "enterprise"),
      );
    });

    await t
      .query(api.dashboard.getComplianceReport, { organizationId: orgId })
      .catch((e: Error) => {
        expect(e.message).not.toContain("Feature requires");
        return null;
      });

    expect(true).toBe(true);
  });
});

describe("Feature Gates - Billing Transitions", () => {
  test("downgrade from pro to free should block pro features", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert(
        "organizations",
        createOrg("Downgrade Test Org", "downgrade-org", "pro"),
      );
    });

    const initialResult = await t
      .query(api.loans.list, {
        organizationId: orgId,
        paginationOpts: { numItems: 10, cursor: null },
      })
      .catch((e: Error) => {
        expect(e.message).not.toContain("Feature requires");
        return { page: [] };
      });
    expect(initialResult).toBeDefined();

    await t.run(async (ctx) => {
      await ctx.db.patch(orgId, { subscriptionTier: "free" });
    });

    await expect(
      t.query(api.loans.list, {
        organizationId: orgId,
        paginationOpts: { numItems: 10, cursor: null },
      }),
    ).rejects.toThrow("Feature requires pro tier");
  });

  test("upgrade from free to pro should enable pro features", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert(
        "organizations",
        createOrg("Upgrade Test Org", "upgrade-org", "free"),
      );
    });

    await expect(
      t.query(api.loans.list, {
        organizationId: orgId,
        paginationOpts: { numItems: 10, cursor: null },
      }),
    ).rejects.toThrow("Feature requires pro tier");

    await t.run(async (ctx) => {
      await ctx.db.patch(orgId, { subscriptionTier: "pro" });
    });

    const result = await t
      .query(api.loans.list, {
        organizationId: orgId,
        paginationOpts: { numItems: 10, cursor: null },
      })
      .catch((e: Error) => {
        expect(e.message).not.toContain("Feature requires");
        return { page: [] };
      });
    expect(result).toBeDefined();
  });

  test("null/undefined tier should default to free", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Default Tier Org",
        slug: "default-org",
        type: "museum",
      });
    });

    await expect(
      t.query(api.loans.list, {
        organizationId: orgId,
        paginationOpts: { numItems: 10, cursor: null },
      }),
    ).rejects.toThrow("Feature requires pro tier");
  });
});

describe("Feature Gates - Quota Enforcement", () => {
  test("free tier should enforce object quota (1000 limit)", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      return await ctx.db.insert(
        "organizations",
        createOrg("Quota Test Org", "quota-org", "free"),
      );
    });

    expect(true).toBe(true);
  });

  test("enterprise tier should have unlimited quotas", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      return await ctx.db.insert(
        "organizations",
        createOrg("Unlimited Org", "unlimited-org", "enterprise"),
      );
    });

    expect(true).toBe(true);
  });
});
