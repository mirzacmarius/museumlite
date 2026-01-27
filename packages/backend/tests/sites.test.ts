import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";

import { modules } from "./testSetup";

describe("sites CRUD operations", () => {
  test("should create site", async () => {
    const t = convexTest(schema, modules);

    const { orgId, userId } = await t.run(async (ctx) => {
      // Create organization
      const orgId = await ctx.db.insert("organizations", {
        name: "Test Museum",
        slug: "test-museum",
        type: "museum",
      });

      // Create user
      const userId = await ctx.db.insert("users", {
        email: "test@example.com",
        name: "Test User",
      });

      // Add user to organization as admin
      await ctx.db.insert("userOrganizations", {
        userId,
        organizationId: orgId,
        role: "admin",
      });

      return { orgId, userId };
    });

    // Authenticate as the user
    await t.run((ctx) => ctx.db.insert("authSessions", { userId }));

    const siteId = await t.mutation(api.sites.create, {
      organizationId: orgId,
      name: "Main Building",
      description: "Primary exhibition space",
      address: "123 Museum St",
      isPrimary: true,
    });

    expect(siteId).toBeDefined();

    // Verify site was created
    const site = await t.run(async (ctx) => {
      return await ctx.db.get(siteId);
    });

    expect(site).toBeDefined();
    expect(site?.name).toBe("Main Building");
    expect(site?.description).toBe("Primary exhibition space");
    expect(site?.address).toBe("123 Museum St");
    expect(site?.isPrimary).toBe(true);
    expect(site?.isActive).toBe(true);
  });

  test("should unset existing primary when creating new primary site", async () => {
    const t = convexTest(schema, modules);

    const { orgId, userId } = await t.run(async (ctx) => {
      const orgId = await ctx.db.insert("organizations", {
        name: "Test Museum",
        slug: "test-museum-primary",
        type: "museum",
      });

      const userId = await ctx.db.insert("users", {
        email: "test@example.com",
        name: "Test User",
      });

      await ctx.db.insert("userOrganizations", {
        userId,
        organizationId: orgId,
        role: "admin",
      });

      return { orgId, userId };
    });

    await t.run((ctx) => ctx.db.insert("authSessions", { userId }));

    // Create first primary site
    const site1Id = await t.mutation(api.sites.create, {
      organizationId: orgId,
      name: "Site 1",
      isPrimary: true,
    });

    // Create second primary site
    const site2Id = await t.mutation(api.sites.create, {
      organizationId: orgId,
      name: "Site 2",
      isPrimary: true,
    });

    // Verify first site is no longer primary
    const site1 = await t.run(async (ctx) => await ctx.db.get(site1Id));
    expect(site1?.isPrimary).toBe(false);

    // Verify second site is primary
    const site2 = await t.run(async (ctx) => await ctx.db.get(site2Id));
    expect(site2?.isPrimary).toBe(true);
  });

  test("should get site by ID", async () => {
    const t = convexTest(schema, modules);

    const { siteId, userId } = await t.run(async (ctx) => {
      const orgId = await ctx.db.insert("organizations", {
        name: "Test Museum",
        slug: "test-museum-get",
        type: "museum",
      });

      const userId = await ctx.db.insert("users", {
        email: "test@example.com",
        name: "Test User",
      });

      await ctx.db.insert("userOrganizations", {
        userId,
        organizationId: orgId,
        role: "admin",
      });

      const siteId = await ctx.db.insert("sites", {
        organizationId: orgId,
        name: "Test Site",
        isActive: true,
        isPrimary: false,
      });

      return { siteId, userId };
    });

    await t.run((ctx) => ctx.db.insert("authSessions", { userId }));

    const site = await t.query(api.sites.get, { siteId });

    expect(site).toBeDefined();
    expect(site?.name).toBe("Test Site");
  });

  test("should return null for non-existent site", async () => {
    const t = convexTest(schema, modules);

    const { userId } = await t.run(async (ctx) => {
      const orgId = await ctx.db.insert("organizations", {
        name: "Test Museum",
        slug: "test-museum-null",
        type: "museum",
      });

      const userId = await ctx.db.insert("users", {
        email: "test@example.com",
        name: "Test User",
      });

      await ctx.db.insert("userOrganizations", {
        userId,
        organizationId: orgId,
        role: "admin",
      });

      return { userId };
    });

    await t.run((ctx) => ctx.db.insert("authSessions", { userId }));

    const site = await t.query(api.sites.get, {
      siteId: "jd7d2d6d6d6d6d6d6d6d6d6d6d6d6d6d" as Id<"sites">,
    });

    expect(site).toBeNull();
  });

  test("should list all sites for organization", async () => {
    const t = convexTest(schema, modules);

    const { orgId, userId } = await t.run(async (ctx) => {
      const orgId = await ctx.db.insert("organizations", {
        name: "Test Museum",
        slug: "test-museum-list",
        type: "museum",
      });

      const userId = await ctx.db.insert("users", {
        email: "test@example.com",
        name: "Test User",
      });

      await ctx.db.insert("userOrganizations", {
        userId,
        organizationId: orgId,
        role: "admin",
      });

      // Create multiple sites
      await ctx.db.insert("sites", {
        organizationId: orgId,
        name: "Building B",
        isActive: true,
        isPrimary: false,
      });

      await ctx.db.insert("sites", {
        organizationId: orgId,
        name: "Building A",
        isActive: true,
        isPrimary: true,
      });

      await ctx.db.insert("sites", {
        organizationId: orgId,
        name: "Storage",
        isActive: false,
        isPrimary: false,
      });

      return { orgId, userId };
    });

    await t.run((ctx) => ctx.db.insert("authSessions", { userId }));

    const sites = await t.query(api.sites.list, { organizationId: orgId });

    expect(sites).toHaveLength(3);
    // Primary site should be first
    expect(sites[0].isPrimary).toBe(true);
    expect(sites[0].name).toBe("Building A");
    // Rest sorted by name
    expect(sites[1].name).toBe("Building B");
    expect(sites[2].name).toBe("Storage");
  });

  test("should list only active sites when activeOnly is true", async () => {
    const t = convexTest(schema, modules);

    const { orgId, userId } = await t.run(async (ctx) => {
      const orgId = await ctx.db.insert("organizations", {
        name: "Test Museum",
        slug: "test-museum-active",
        type: "museum",
      });

      const userId = await ctx.db.insert("users", {
        email: "test@example.com",
        name: "Test User",
      });

      await ctx.db.insert("userOrganizations", {
        userId,
        organizationId: orgId,
        role: "admin",
      });

      await ctx.db.insert("sites", {
        organizationId: orgId,
        name: "Active Site",
        isActive: true,
        isPrimary: true,
      });

      await ctx.db.insert("sites", {
        organizationId: orgId,
        name: "Archived Site",
        isActive: false,
        isPrimary: false,
      });

      return { orgId, userId };
    });

    await t.run((ctx) => ctx.db.insert("authSessions", { userId }));

    const sites = await t.query(api.sites.list, {
      organizationId: orgId,
      activeOnly: true,
    });

    expect(sites).toHaveLength(1);
    expect(sites[0].name).toBe("Active Site");
    expect(sites[0].isActive).toBe(true);
  });

  test("should update site", async () => {
    const t = convexTest(schema, modules);

    const { siteId, userId } = await t.run(async (ctx) => {
      const orgId = await ctx.db.insert("organizations", {
        name: "Test Museum",
        slug: "test-museum-update",
        type: "museum",
      });

      const userId = await ctx.db.insert("users", {
        email: "test@example.com",
        name: "Test User",
      });

      await ctx.db.insert("userOrganizations", {
        userId,
        organizationId: orgId,
        role: "admin",
      });

      const siteId = await ctx.db.insert("sites", {
        organizationId: orgId,
        name: "Old Name",
        description: "Old description",
        isActive: true,
        isPrimary: false,
      });

      return { siteId, userId };
    });

    await t.run((ctx) => ctx.db.insert("authSessions", { userId }));

    await t.mutation(api.sites.update, {
      siteId,
      name: "New Name",
      description: "New description",
      address: "456 New St",
    });

    const updated = await t.run(async (ctx) => await ctx.db.get(siteId));

    expect(updated?.name).toBe("New Name");
    expect(updated?.description).toBe("New description");
    expect(updated?.address).toBe("456 New St");
  });

  test("should unset existing primary when updating to primary", async () => {
    const t = convexTest(schema, modules);

    const { site1Id, site2Id, userId } = await t.run(async (ctx) => {
      const orgId = await ctx.db.insert("organizations", {
        name: "Test Museum",
        slug: "test-museum-update-primary",
        type: "museum",
      });

      const userId = await ctx.db.insert("users", {
        email: "test@example.com",
        name: "Test User",
      });

      await ctx.db.insert("userOrganizations", {
        userId,
        organizationId: orgId,
        role: "admin",
      });

      const site1Id = await ctx.db.insert("sites", {
        organizationId: orgId,
        name: "Site 1",
        isActive: true,
        isPrimary: true,
      });

      const site2Id = await ctx.db.insert("sites", {
        organizationId: orgId,
        name: "Site 2",
        isActive: true,
        isPrimary: false,
      });

      return { site1Id, site2Id, userId };
    });

    await t.run((ctx) => ctx.db.insert("authSessions", { userId }));

    await t.mutation(api.sites.update, {
      siteId: site2Id,
      isPrimary: true,
    });

    const site1 = await t.run(async (ctx) => await ctx.db.get(site1Id));
    const site2 = await t.run(async (ctx) => await ctx.db.get(site2Id));

    expect(site1?.isPrimary).toBe(false);
    expect(site2?.isPrimary).toBe(true);
  });

  test("should archive site", async () => {
    const t = convexTest(schema, modules);

    const { siteId, userId } = await t.run(async (ctx) => {
      const orgId = await ctx.db.insert("organizations", {
        name: "Test Museum",
        slug: "test-museum-archive",
        type: "museum",
      });

      const userId = await ctx.db.insert("users", {
        email: "test@example.com",
        name: "Test User",
      });

      await ctx.db.insert("userOrganizations", {
        userId,
        organizationId: orgId,
        role: "admin",
      });

      const siteId = await ctx.db.insert("sites", {
        organizationId: orgId,
        name: "To Archive",
        isActive: true,
        isPrimary: false,
      });

      return { siteId, userId };
    });

    await t.run((ctx) => ctx.db.insert("authSessions", { userId }));

    await t.mutation(api.sites.archive, { siteId });

    const archived = await t.run(async (ctx) => await ctx.db.get(siteId));

    expect(archived?.isActive).toBe(false);
  });

  test("should not archive primary site", async () => {
    const t = convexTest(schema, modules);

    const { siteId, userId } = await t.run(async (ctx) => {
      const orgId = await ctx.db.insert("organizations", {
        name: "Test Museum",
        slug: "test-museum-archive-primary",
        type: "museum",
      });

      const userId = await ctx.db.insert("users", {
        email: "test@example.com",
        name: "Test User",
      });

      await ctx.db.insert("userOrganizations", {
        userId,
        organizationId: orgId,
        role: "admin",
      });

      const siteId = await ctx.db.insert("sites", {
        organizationId: orgId,
        name: "Primary Site",
        isActive: true,
        isPrimary: true,
      });

      return { siteId, userId };
    });

    await t.run((ctx) => ctx.db.insert("authSessions", { userId }));

    await expect(t.mutation(api.sites.archive, { siteId })).rejects.toThrow(
      "Cannot archive the primary site",
    );

    const site = await t.run(async (ctx) => await ctx.db.get(siteId));
    expect(site?.isActive).toBe(true);
  });

  test("should grant user site access", async () => {
    const t = convexTest(schema, modules);

    const { siteId, targetUserId, adminUserId } = await t.run(async (ctx) => {
      const orgId = await ctx.db.insert("organizations", {
        name: "Test Museum",
        slug: "test-museum-grant",
        type: "museum",
      });

      const adminUserId = await ctx.db.insert("users", {
        email: "admin@example.com",
        name: "Admin User",
      });

      const targetUserId = await ctx.db.insert("users", {
        email: "user@example.com",
        name: "Regular User",
      });

      await ctx.db.insert("userOrganizations", {
        userId: adminUserId,
        organizationId: orgId,
        role: "admin",
      });

      await ctx.db.insert("userOrganizations", {
        userId: targetUserId,
        organizationId: orgId,
        role: "member",
      });

      const siteId = await ctx.db.insert("sites", {
        organizationId: orgId,
        name: "Restricted Site",
        isActive: true,
        isPrimary: false,
      });

      return { siteId, targetUserId, adminUserId };
    });

    await t.run((ctx) =>
      ctx.db.insert("authSessions", { userId: adminUserId }),
    );

    const userSiteId = await t.mutation(api.sites.grantUserSiteAccess, {
      siteId,
      userId: targetUserId,
    });

    expect(userSiteId).toBeDefined();

    // Verify user-site assignment was created
    const userSite = await t.run(async (ctx) => {
      return await ctx.db
        .query("userSites")
        .withIndex("by_user_and_site", (q) =>
          q.eq("userId", targetUserId).eq("siteId", siteId),
        )
        .first();
    });

    expect(userSite).toBeDefined();
    expect(userSite?.canAccess).toBe(true);
  });

  test("should update existing user site access when granting", async () => {
    const t = convexTest(schema, modules);

    const { siteId, targetUserId, adminUserId, existingUserSiteId } =
      await t.run(async (ctx) => {
        const orgId = await ctx.db.insert("organizations", {
          name: "Test Museum",
          slug: "test-museum-grant-existing",
          type: "museum",
        });

        const adminUserId = await ctx.db.insert("users", {
          email: "admin@example.com",
          name: "Admin User",
        });

        const targetUserId = await ctx.db.insert("users", {
          email: "user@example.com",
          name: "Regular User",
        });

        await ctx.db.insert("userOrganizations", {
          userId: adminUserId,
          organizationId: orgId,
          role: "admin",
        });

        await ctx.db.insert("userOrganizations", {
          userId: targetUserId,
          organizationId: orgId,
          role: "member",
        });

        const siteId = await ctx.db.insert("sites", {
          organizationId: orgId,
          name: "Test Site",
          isActive: true,
          isPrimary: false,
        });

        // Create existing assignment with canAccess: false
        const existingUserSiteId = await ctx.db.insert("userSites", {
          userId: targetUserId,
          siteId,
          canAccess: false,
        });

        return { siteId, targetUserId, adminUserId, existingUserSiteId };
      });

    await t.run((ctx) =>
      ctx.db.insert("authSessions", { userId: adminUserId }),
    );

    const userSiteId = await t.mutation(api.sites.grantUserSiteAccess, {
      siteId,
      userId: targetUserId,
    });

    // Should return the same ID
    expect(userSiteId).toBe(existingUserSiteId);

    // Verify canAccess was updated to true
    const userSite = await t.run(async (ctx) => await ctx.db.get(userSiteId));
    expect(userSite?.canAccess).toBe(true);
  });

  test("should not grant access to non-organization member", async () => {
    const t = convexTest(schema, modules);

    const { siteId, nonMemberId, adminUserId } = await t.run(async (ctx) => {
      const orgId = await ctx.db.insert("organizations", {
        name: "Test Museum",
        slug: "test-museum-non-member",
        type: "museum",
      });

      const adminUserId = await ctx.db.insert("users", {
        email: "admin@example.com",
        name: "Admin User",
      });

      const nonMemberId = await ctx.db.insert("users", {
        email: "nonmember@example.com",
        name: "Non Member",
      });

      await ctx.db.insert("userOrganizations", {
        userId: adminUserId,
        organizationId: orgId,
        role: "admin",
      });

      const siteId = await ctx.db.insert("sites", {
        organizationId: orgId,
        name: "Test Site",
        isActive: true,
        isPrimary: false,
      });

      return { siteId, nonMemberId, adminUserId };
    });

    await t.run((ctx) =>
      ctx.db.insert("authSessions", { userId: adminUserId }),
    );

    await expect(
      t.mutation(api.sites.grantUserSiteAccess, {
        siteId,
        userId: nonMemberId,
      }),
    ).rejects.toThrow("User is not a member of this organization");
  });

  test("should revoke user site access", async () => {
    const t = convexTest(schema, modules);

    const { siteId, targetUserId, adminUserId } = await t.run(async (ctx) => {
      const orgId = await ctx.db.insert("organizations", {
        name: "Test Museum",
        slug: "test-museum-revoke",
        type: "museum",
      });

      const adminUserId = await ctx.db.insert("users", {
        email: "admin@example.com",
        name: "Admin User",
      });

      const targetUserId = await ctx.db.insert("users", {
        email: "user@example.com",
        name: "Regular User",
      });

      await ctx.db.insert("userOrganizations", {
        userId: adminUserId,
        organizationId: orgId,
        role: "admin",
      });

      await ctx.db.insert("userOrganizations", {
        userId: targetUserId,
        organizationId: orgId,
        role: "member",
      });

      const siteId = await ctx.db.insert("sites", {
        organizationId: orgId,
        name: "Test Site",
        isActive: true,
        isPrimary: false,
      });

      // Grant access first
      await ctx.db.insert("userSites", {
        userId: targetUserId,
        siteId,
        canAccess: true,
      });

      return { siteId, targetUserId, adminUserId };
    });

    await t.run((ctx) =>
      ctx.db.insert("authSessions", { userId: adminUserId }),
    );

    await t.mutation(api.sites.revokeUserSiteAccess, {
      siteId,
      userId: targetUserId,
    });

    // Verify canAccess was set to false
    const userSite = await t.run(async (ctx) => {
      return await ctx.db
        .query("userSites")
        .withIndex("by_user_and_site", (q) =>
          q.eq("userId", targetUserId).eq("siteId", siteId),
        )
        .first();
    });

    expect(userSite).toBeDefined();
    expect(userSite?.canAccess).toBe(false);
  });

  test("should handle revoking non-existent access gracefully", async () => {
    const t = convexTest(schema, modules);

    const { siteId, targetUserId, adminUserId } = await t.run(async (ctx) => {
      const orgId = await ctx.db.insert("organizations", {
        name: "Test Museum",
        slug: "test-museum-revoke-non-existent",
        type: "museum",
      });

      const adminUserId = await ctx.db.insert("users", {
        email: "admin@example.com",
        name: "Admin User",
      });

      const targetUserId = await ctx.db.insert("users", {
        email: "user@example.com",
        name: "Regular User",
      });

      await ctx.db.insert("userOrganizations", {
        userId: adminUserId,
        organizationId: orgId,
        role: "admin",
      });

      await ctx.db.insert("userOrganizations", {
        userId: targetUserId,
        organizationId: orgId,
        role: "member",
      });

      const siteId = await ctx.db.insert("sites", {
        organizationId: orgId,
        name: "Test Site",
        isActive: true,
        isPrimary: false,
      });

      return { siteId, targetUserId, adminUserId };
    });

    await t.run((ctx) =>
      ctx.db.insert("authSessions", { userId: adminUserId }),
    );

    // Should not throw when no assignment exists
    const result = await t.mutation(api.sites.revokeUserSiteAccess, {
      siteId,
      userId: targetUserId,
    });

    expect(result).toBeNull();
  });
});
