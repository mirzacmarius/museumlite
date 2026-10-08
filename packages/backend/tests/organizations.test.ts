import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";
import {
  authedForUser,
  createConvexTest,
  createOrgUserWithPermissions,
  rebuildProjection,
} from "./testHarness";
import { modules } from "./testSetup";

describe("organizations.get security (IDOR fix)", () => {
  test("member can read their own org", async () => {
    const t = createConvexTest();
    const { organizationId, userId } = await createOrgUserWithPermissions(
      t,
      [],
    );
    const authed = authedForUser(t, userId);

    const org = await authed.query(api.organizations.get, { organizationId });

    expect(org).not.toBeNull();
    expect(org?._id).toBe(organizationId);
  });

  test("unauthenticated caller cannot read org", async () => {
    const t = createConvexTest();
    const { organizationId } = await createOrgUserWithPermissions(t, []);

    await expect(
      t.query(api.organizations.get, { organizationId }),
    ).rejects.toThrow("Not authenticated");
  });

  test("non-member cannot read another org", async () => {
    const t = createConvexTest();
    const { organizationId: orgA } = await createOrgUserWithPermissions(t, []);
    const { userId: userB } = await createOrgUserWithPermissions(t, [], {
      slugPrefix: "other-org",
    });
    const authedB = authedForUser(t, userB);

    await expect(
      authedB.query(api.organizations.get, { organizationId: orgA }),
    ).rejects.toThrow("Not a member of this organization");
  });
});

describe("organizations.getPortalSettings security", () => {
  test("member can read portal settings", async () => {
    const t = createConvexTest();
    const { organizationId, userId } = await createOrgUserWithPermissions(
      t,
      [],
    );
    const authed = authedForUser(t, userId);

    await t.run(async (ctx) => {
      await ctx.db.patch(organizationId, {
        settings: {
          portalSettings: {
            isEnabled: true,
            isSearchEnabled: true,
            portalSlug: "catalog",
          },
        },
      });
    });

    const settings = await authed.query(api.organizations.getPortalSettings, {
      organizationId,
    });

    expect(settings.isEnabled).toBe(true);
    expect(settings.isSearchEnabled).toBe(true);
    expect(settings.portalSlug).toBe("catalog");
  });

  test("unauthenticated caller cannot read portal settings", async () => {
    const t = createConvexTest();
    const { organizationId } = await createOrgUserWithPermissions(t, []);

    await expect(
      t.query(api.organizations.getPortalSettings, { organizationId }),
    ).rejects.toThrow("Not authenticated");
  });

  test("non-member cannot read another org portal settings", async () => {
    const t = createConvexTest();
    const { organizationId: orgA } = await createOrgUserWithPermissions(t, []);
    const { userId: userB } = await createOrgUserWithPermissions(t, [], {
      slugPrefix: "other-org",
    });
    const authedB = authedForUser(t, userB);

    await expect(
      authedB.query(api.organizations.getPortalSettings, {
        organizationId: orgA,
      }),
    ).rejects.toThrow("Not a member of this organization");
  });
});

describe("organization hierarchy", () => {
  async function createUser(t: ReturnType<typeof convexTest>) {
    return await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Hierarchy Admin",
        email: `hierarchy-${Math.random().toString(36).slice(2, 8)}@test.dev`,
      });
    });
  }

  test("pro parent can create and list child organizations", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);
    const authed = authedForUser(t, userId);

    const parentOrganizationId = await authed.mutation(
      api.organizations.create,
      {
        name: "Parent Museum",
        slug: `parent-${Math.random().toString(36).slice(2, 8)}`,
        type: "museum",
      },
    );

    await t.run(async (ctx) => {
      await ctx.db.patch(parentOrganizationId, {
        subscriptionTier: "pro",
      });
    });

    const childOrganizationId = await authed.mutation(
      api.organizations.create,
      {
        name: "Child Museum",
        slug: `child-${Math.random().toString(36).slice(2, 8)}`,
        type: "museum",
        parentOrganizationId,
      },
    );

    const [childOrganization, children] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.get(childOrganizationId);
      }),
      authed.query(api.organizations.listChildOrganizations, {
        organizationId: parentOrganizationId,
      }),
    ]);
    expect(childOrganization?.parentOrganizationId).toBe(parentOrganizationId);
    expect(childOrganization?.rootOrganizationId).toBe(parentOrganizationId);
    expect(children.some((child) => child._id === childOrganizationId)).toBe(
      true,
    );
  });

  test("free parent cannot create child organizations", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);
    const authed = authedForUser(t, userId);

    const parentOrganizationId = await authed.mutation(
      api.organizations.create,
      {
        name: "Free Parent Museum",
        slug: `free-parent-${Math.random().toString(36).slice(2, 8)}`,
        type: "museum",
      },
    );

    await expect(
      authed.mutation(api.organizations.create, {
        name: "Blocked Child Museum",
        slug: `blocked-child-${Math.random().toString(36).slice(2, 8)}`,
        type: "museum",
        parentOrganizationId,
      }),
    ).rejects.toThrow("Pro or Enterprise");
  });
});

describe("getUsageStats", () => {
  test("reports object and storage usage as unavailable until the projection is built, then from source rows rather than a stale counter", async () => {
    const t = createConvexTest();
    const { organizationId, userId } = await createOrgUserWithPermissions(
      t,
      [],
      { slugPrefix: "counter-org" },
    );
    const authed = authedForUser(t, userId);

    await t.run(async (ctx) => {
      await ctx.db.insert("organizationUsageCounters", {
        organizationId,
        objectCount: 17,
        mediaFileCount: 4,
        mediaVersionCount: 2,
        storageBytes: 8192,
        mediaByType: {
          image: {
            count: 4,
            bytes: 8192,
          },
        },
        lastUpdatedAt: Date.now(),
      });

      await ctx.db.insert("exportUsage", {
        organizationId,
        periodStart: Date.UTC(
          new Date().getUTCFullYear(),
          new Date().getUTCMonth(),
          1,
        ),
        count: 3,
      });
      for (const accessionNumber of ["U-1", "U-2"]) {
        await ctx.db.insert("collections", {
          organizationId,
          accessionNumber,
          title: accessionNumber,
          status: "active",
          catalogedBy: userId,
          catalogedAt: 1,
        });
      }
    });

    const before = await authed.query(api.organizations.getUsageStats, {
      organizationId,
    });
    expect(before.metrics).toEqual({
      availability: "unavailable",
      reason: "not_built",
      definitionVersion: 1,
    });
    expect(before.objects.used).toBeNull();
    expect(before.storage.used).toBeNull();
    expect(before.exports.used).toBe(3);

    await rebuildProjection(t, organizationId);
    const stats = await authed.query(api.organizations.getUsageStats, {
      organizationId,
    });

    expect(stats.metrics).toEqual({ availability: "ready" });
    expect(stats.objects.used).toBe(2);
    expect(stats.storage.used).toBe(0);
    expect(stats.exports.used).toBe(3);
  });

  test("should return correct structure for free tier", async () => {
    const t = createConvexTest();
    const { organizationId, userId } = await createOrgUserWithPermissions(
      t,
      [],
      { slugPrefix: "test-org" },
    );
    const authed = authedForUser(t, userId);

    const stats = await authed.query(api.organizations.getUsageStats, {
      organizationId,
    });

    expect(stats).toBeDefined();
    expect(stats.tier).toBe("free");
    expect(stats.storage).toHaveProperty("used");
    expect(stats.storage).toHaveProperty("limit");
    expect(stats.objects).toHaveProperty("used");
    expect(stats.objects).toHaveProperty("limit");
    expect(stats.exports).toHaveProperty("used");
    expect(stats.exports).toHaveProperty("limit");
  });

  test("should count objects correctly", async () => {
    const t = createConvexTest();
    const { organizationId, userId } = await createOrgUserWithPermissions(
      t,
      [],
      { slugPrefix: "test-org-pro" },
    );
    const authed = authedForUser(t, userId);

    await rebuildProjection(t, organizationId);
    const stats = await authed.query(api.organizations.getUsageStats, {
      organizationId,
    });

    expect(stats.objects.used).toBe(0);
  });

  test("should sum storage correctly", async () => {
    const t = createConvexTest();
    const { organizationId, userId } = await createOrgUserWithPermissions(
      t,
      [],
      { slugPrefix: "test-org-storage" },
    );
    const authed = authedForUser(t, userId);

    await rebuildProjection(t, organizationId);
    const stats = await authed.query(api.organizations.getUsageStats, {
      organizationId,
    });

    expect(stats.storage.used).toBe(0);
  });

  test("should handle enterprise tier with null limits", async () => {
    const t = createConvexTest();
    const { organizationId, userId } = await createOrgUserWithPermissions(
      t,
      [],
      {
        slugPrefix: "enterprise-org",
        subscriptionTier: "enterprise",
      },
    );
    const authed = authedForUser(t, userId);

    const stats = await authed.query(api.organizations.getUsageStats, {
      organizationId,
    });

    expect(stats.tier).toBe("enterprise");
    expect(stats.storage.limit).toBeNull();
    expect(stats.objects.limit).toBeNull();
    expect(stats.exports.limit).toBeNull();
  });
});

describe("organization read helpers security", () => {
  test("unauthenticated callers cannot read settings, usage, or user list", async () => {
    const t = createConvexTest();
    const { organizationId } = await createOrgUserWithPermissions(t, [], {
      slugPrefix: "secured-org",
    });

    await expect(
      t.query(api.organizations.getSettings, { organizationId }),
    ).rejects.toThrow("Not authenticated");
    await expect(
      t.query(api.organizations.getUsageStats, { organizationId }),
    ).rejects.toThrow("Not authenticated");
    await expect(
      t.query(api.organizations.listOrganizationUsers, { organizationId }),
    ).rejects.toThrow("Not authenticated");
  });

  test("non-member cannot read another org's settings, usage, or user list", async () => {
    const t = createConvexTest();
    const { organizationId: orgA } = await createOrgUserWithPermissions(
      t,
      ["organization.manage_settings"],
      { slugPrefix: "org-a" },
    );
    const { userId: userB } = await createOrgUserWithPermissions(
      t,
      ["organization.manage_settings"],
      { slugPrefix: "org-b" },
    );
    const authedB = authedForUser(t, userB);

    await expect(
      authedB.query(api.organizations.getSettings, { organizationId: orgA }),
    ).rejects.toThrow("Permission denied: organization.manage_settings");
    await expect(
      authedB.query(api.organizations.getUsageStats, { organizationId: orgA }),
    ).rejects.toThrow("Not a member of this organization");
    await expect(
      authedB.query(api.organizations.listOrganizationUsers, {
        organizationId: orgA,
      }),
    ).rejects.toThrow("Permission denied: organization.manage_settings");
  });

  test("authorized org admin can read settings, usage, and user list", async () => {
    const t = createConvexTest();
    const { organizationId, userId } = await createOrgUserWithPermissions(
      t,
      ["organization.manage_settings"],
      {
        slugPrefix: "admin-org",
        organizationName: "Admin Museum",
      },
    );
    const authed = authedForUser(t, userId);

    await t.run(async (ctx) => {
      await ctx.db.patch(organizationId, {
        settings: {
          autoGenerateAccessionNumbers: true,
        },
      });
    });

    const [settings, stats, users] = await Promise.all([
      authed.query(api.organizations.getSettings, { organizationId }),
      authed.query(api.organizations.getUsageStats, { organizationId }),
      authed.query(api.organizations.listOrganizationUsers, { organizationId }),
    ]);

    expect(settings?.autoGenerateAccessionNumbers).toBe(true);
    expect(stats.tier).toBe("free");
    expect(users.some((user) => user._id === userId)).toBe(true);
  });

  test("org member without manage_settings can read usage stats", async () => {
    const t = createConvexTest();
    const { organizationId, userId } = await createOrgUserWithPermissions(
      t,
      [],
      { slugPrefix: "member-usage-org" },
    );
    const authed = authedForUser(t, userId);

    const stats = await authed.query(api.organizations.getUsageStats, {
      organizationId,
    });

    expect(stats.tier).toBe("free");
  });

  test("org member without manage_settings cannot list organization users", async () => {
    const t = createConvexTest();
    const { organizationId, userId } = await createOrgUserWithPermissions(
      t,
      [],
      { slugPrefix: "member-users-org" },
    );
    const authed = authedForUser(t, userId);

    await expect(
      authed.query(api.organizations.listOrganizationUsers, { organizationId }),
    ).rejects.toThrow("Permission denied: organization.manage_settings");
  });
});

describe("watermark settings", () => {
  test("should update watermark settings", async () => {
    const t = convexTest(schema, modules);

    const [orgId, userId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Test Org",
          slug: "test-watermark-org",
          type: "museum",
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Admin User",
          email: "admin@test.com",
        });
      }),
    ]);
    // Create admin role with permission
    const [roleId, permissionId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("roles", {
          organizationId: orgId,
          name: "Admin",
          isSystemRole: true,
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("permissions", {
          name: "organization.manage_settings",
          category: "organization",
        });
      }),
    ]);
    await t.run(async (ctx) => {
      await ctx.db.insert("rolePermissions", {
        roleId,
        permissionId,
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("userOrganizations", {
        userId,
        organizationId: orgId,
        roleId,
        joinedAt: Date.now(),
      });
    });

    // Update watermark settings
    const authed = authedForUser(t, userId);
    await authed.mutation(api.organizations.updateWatermarkSettings, {
      organizationId: orgId,
      watermarkSettings: {
        isEnabled: true,
        text: "© 2026 Test Museum",
        opacity: 0.7,
        position: "bottom-right",
      },
    });

    // Verify settings were saved
    const org = await t.run(async (ctx) => {
      return await ctx.db.get(orgId);
    });

    expect(org?.settings?.watermarkSettings).toBeDefined();
    expect(org?.settings?.watermarkSettings?.isEnabled).toBe(true);
    expect(org?.settings?.watermarkSettings?.text).toBe("© 2026 Test Museum");
    expect(org?.settings?.watermarkSettings?.opacity).toBe(0.7);
    expect(org?.settings?.watermarkSettings?.position).toBe("bottom-right");
  });
});

describe("organizations.getAccessionNumberPreview", () => {
  test("formats the next number from the supplied timestamp", async () => {
    const t = createConvexTest();
    const { organizationId, userId } = await createOrgUserWithPermissions(t, [
      "collections.read",
    ]);
    await t.run(async (ctx) => {
      await ctx.db.patch(organizationId, {
        settings: { accessionNumberFormat: "{YYYY}.{####}" },
      });
    });
    const now = Date.UTC(2026, 5, 15, 12);
    const preview = await authedForUser(t, userId).query(
      api.organizations.getAccessionNumberPreview,
      { organizationId, now },
    );
    expect(preview).toEqual({
      preview: "2026.0001",
      nextNumber: "2026.0001",
      template: "{YYYY}.{####}",
      scope: "year",
    });
  });
});
