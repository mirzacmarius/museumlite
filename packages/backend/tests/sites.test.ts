import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";

import { modules } from "./testSetup";

type OrgSetup = {
  organizationId: Id<"organizations">;
  userId: Id<"users">;
  roleId: Id<"roles">;
};

async function createOrgWithRole(
  t: ReturnType<typeof convexTest>,
  permissionNames: string[],
): Promise<OrgSetup> {
  const [organizationId, userId] = await Promise.all([
    t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Museum",
        slug: `test-museum-${Math.random().toString(36).slice(2, 8)}`,
        type: "museum",
        subscriptionTier: "pro",
      });
    }),
    t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Test User",
        email: `test-${Math.random().toString(36).slice(2, 8)}@example.com`,
      });
    }),
  ]);
  const roleId = await t.run(async (ctx) => {
    return await ctx.db.insert("roles", {
      organizationId,
      name: "Admin",
      isSystemRole: true,
    });
  });

  await Promise.all(
    permissionNames.map(async (permissionName) => {
      const category =
        (permissionName.split(".")[0] as
          | "collections"
          | "loans"
          | "locations"
          | "sites"
          | "media"
          | "users"
          | "organization"
          | "accounts") ?? "collections";

      const permissionId = await t.run(async (ctx) => {
        return await ctx.db.insert("permissions", {
          name: permissionName,
          category,
        });
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("rolePermissions", {
          roleId,
          permissionId,
        });
      });
    }),
  );

  await t.run(async (ctx) => {
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId,
      joinedAt: Date.now(),
    });
  });

  await t.run(async (ctx) => {
    const permissionId = await ctx.db.insert("permissions", {
      name: "organization.manage_settings",
      category: "organization",
    });
    await ctx.db.insert("rolePermissions", { roleId, permissionId });
  });
  return { organizationId, userId, roleId };
}

function authedForUser(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.withIdentity({
    subject: `${userId}|session-1`,
    issuer: "https://example.test",
  });
}

describe("sites CRUD operations", () => {
  test("should create site", async () => {
    const t = convexTest(schema, modules);

    const { organizationId, userId } = await createOrgWithRole(t, [
      "sites.create",
    ]);
    const authed = authedForUser(t, userId);

    const siteId = await authed.mutation(api.sites.create, {
      organizationId,
      name: "Main Building",
      description: "Primary exhibition space",
      address: "123 Museum St",
      isPrimary: true,
    });

    expect(siteId).toBeDefined();

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

    const { organizationId, userId } = await createOrgWithRole(t, [
      "sites.create",
    ]);
    const authed = authedForUser(t, userId);

    const [site1Id, site2Id] = await Promise.all([
      authed.mutation(api.sites.create, {
        organizationId,
        name: "Site 1",
        isPrimary: true,
      }),
      authed.mutation(api.sites.create, {
        organizationId,
        name: "Site 2",
        isPrimary: true,
      }),
    ]);
    const site1 = await t.run(async (ctx) => await ctx.db.get(site1Id));
    expect(site1?.isPrimary).toBe(false);

    const site2 = await t.run(async (ctx) => await ctx.db.get(site2Id));
    expect(site2?.isPrimary).toBe(true);
  });

  test("should get site by ID", async () => {
    const t = convexTest(schema, modules);

    const { organizationId, userId } = await createOrgWithRole(t, [
      "sites.read",
    ]);
    const authed = authedForUser(t, userId);

    const siteId = await t.run(async (ctx) => {
      return await ctx.db.insert("sites", {
        organizationId,
        name: "Test Site",
        description: "Test Description",
        address: "Test Address",
        isActive: true,
        isPrimary: false,
      });
    });

    const site = await authed.query(api.sites.get, { siteId });
    expect(site).toBeDefined();
    expect(site?._id).toBe(siteId);
    expect(site?.name).toBe("Test Site");
  });

  test("should return null for non-existent site", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createOrgWithRole(t, [
      "sites.read",
    ]);
    const authed = authedForUser(t, userId);

    const siteId = await t.run(async (ctx) => {
      const siteId = await ctx.db.insert("sites", {
        organizationId,
        name: "Temp Site",
        isActive: true,
        isPrimary: false,
      });
      await ctx.db.delete(siteId);
      return siteId;
    });

    const site = await authed.query(api.sites.get, {
      siteId,
    });

    expect(site).toBeNull();
  });

  test("should list all sites for organization", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createOrgWithRole(t, [
      "sites.read",
    ]);
    const authed = authedForUser(t, userId);

    await t.run(async (ctx) => {
      await ctx.db.insert("sites", {
        organizationId,
        name: "Site 1",
        isActive: true,
        isPrimary: true,
      });

      await ctx.db.insert("sites", {
        organizationId,
        name: "Site 2",
        isActive: true,
        isPrimary: false,
      });
    });

    const sites = await authed.query(api.sites.list, { organizationId });

    expect(sites).toHaveLength(2);
    expect(sites[0]?.name).toBe("Site 1");
    expect(sites[1]?.name).toBe("Site 2");
  });

  test("should list only active sites when activeOnly is true", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createOrgWithRole(t, [
      "sites.read",
    ]);
    const authed = authedForUser(t, userId);

    await t.run(async (ctx) => {
      await ctx.db.insert("sites", {
        organizationId,
        name: "Active Site",
        isActive: true,
        isPrimary: false,
      });

      await ctx.db.insert("sites", {
        organizationId,
        name: "Inactive Site",
        isActive: false,
        isPrimary: false,
      });
    });

    const sites = await authed.query(api.sites.list, {
      organizationId,
      activeOnly: true,
    });

    expect(sites).toHaveLength(1);
    expect(sites[0]?.name).toBe("Active Site");
  });

  test("should update site", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createOrgWithRole(t, [
      "sites.update",
    ]);
    const authed = authedForUser(t, userId);

    const siteId = await t.run(async (ctx) => {
      return await ctx.db.insert("sites", {
        organizationId,
        name: "Old Name",
        description: "Old Description",
        address: "Old Address",
        isActive: true,
        isPrimary: false,
      });
    });

    await authed.mutation(api.sites.update, {
      siteId,
      name: "New Name",
      description: "New Description",
    });

    const site = await t.run(async (ctx) => await ctx.db.get(siteId));
    expect(site?.name).toBe("New Name");
    expect(site?.description).toBe("New Description");
    expect(site?.address).toBe("Old Address");
  });

  test("should unset existing primary when updating to primary", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createOrgWithRole(t, [
      "sites.update",
    ]);
    const authed = authedForUser(t, userId);

    const { site1Id, site2Id } = await t.run(async (ctx) => {
      const [site1Id, site2Id] = await Promise.all([
        ctx.db.insert("sites", {
          organizationId,
          name: "Site 1",
          isActive: true,
          isPrimary: true,
        }),
        ctx.db.insert("sites", {
          organizationId,
          name: "Site 2",
          isActive: true,
          isPrimary: false,
        }),
      ]);
      return { site1Id, site2Id };
    });

    await authed.mutation(api.sites.update, {
      siteId: site2Id,
      isPrimary: true,
    });

    const site1 = await t.run(async (ctx) => await ctx.db.get(site1Id));
    expect(site1?.isPrimary).toBe(false);

    const site2 = await t.run(async (ctx) => await ctx.db.get(site2Id));
    expect(site2?.isPrimary).toBe(true);
  });

  test("should archive site", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createOrgWithRole(t, [
      "sites.delete",
    ]);
    const authed = authedForUser(t, userId);

    const siteId = await t.run(async (ctx) => {
      return await ctx.db.insert("sites", {
        organizationId,
        name: "Site to Archive",
        isActive: true,
        isPrimary: false,
      });
    });

    await authed.mutation(api.sites.archive, { siteId });

    const site = await t.run(async (ctx) => await ctx.db.get(siteId));
    expect(site?.isActive).toBe(false);
  });

  test("should not archive primary site", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createOrgWithRole(t, [
      "sites.delete",
    ]);
    const authed = authedForUser(t, userId);

    const siteId = await t.run(async (ctx) => {
      return await ctx.db.insert("sites", {
        organizationId,
        name: "Primary Site",
        isActive: true,
        isPrimary: true,
      });
    });

    await expect(
      authed.mutation(api.sites.archive, { siteId }),
    ).rejects.toThrow("Cannot archive the primary site");

    const site = await t.run(async (ctx) => await ctx.db.get(siteId));
    expect(site?.isActive).toBe(true);
  });

  test("should grant user site access", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId, roleId } = await createOrgWithRole(t, [
      "sites.update",
    ]);
    const authed = authedForUser(t, userId);

    const otherUserId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Regular User",
        email: `user-${Math.random().toString(36).slice(2, 8)}@example.com`,
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("userOrganizations", {
        userId: otherUserId,
        organizationId,
        roleId,
        joinedAt: Date.now(),
      });
    });

    const siteId = await t.run(async (ctx) => {
      return await ctx.db.insert("sites", {
        organizationId,
        name: "Test Site",
        isActive: true,
        isPrimary: false,
      });
    });

    const userSiteId = await authed.mutation(api.sites.grantUserSiteAccess, {
      siteId,
      userId: otherUserId,
    });

    expect(userSiteId).toBeDefined();

    const userSite = await t.run(async (ctx) => await ctx.db.get(userSiteId));
    expect(userSite).toBeDefined();
    expect(userSite?.userId).toBe(otherUserId);
    expect(userSite?.siteId).toBe(siteId);
    expect(userSite?.canAccess).toBe(true);
  });

  test("should update existing user site access when granting", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId, roleId } = await createOrgWithRole(t, [
      "sites.update",
    ]);
    const authed = authedForUser(t, userId);

    const otherUserId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Regular User",
        email: `user-${Math.random().toString(36).slice(2, 8)}@example.com`,
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("userOrganizations", {
        userId: otherUserId,
        organizationId,
        roleId,
        joinedAt: Date.now(),
      });
    });

    const { siteId, existingUserSiteId } = await t.run(async (ctx) => {
      const siteId = await ctx.db.insert("sites", {
        organizationId,
        name: "Test Site",
        isActive: true,
        isPrimary: false,
      });

      const existingUserSiteId = await ctx.db.insert("userSites", {
        userId: otherUserId,
        siteId,
        canAccess: false,
      });

      return { siteId, existingUserSiteId };
    });

    const userSiteId = await authed.mutation(api.sites.grantUserSiteAccess, {
      siteId,
      userId: otherUserId,
    });

    expect(userSiteId).toBe(existingUserSiteId);

    const userSite = await t.run(async (ctx) => await ctx.db.get(userSiteId));
    expect(userSite?.canAccess).toBe(true);
  });

  test("should not grant access to non-organization member", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createOrgWithRole(t, [
      "sites.update",
    ]);
    const authed = authedForUser(t, userId);

    const [otherUserId, siteId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Outsider User",
          email: `outsider-${Math.random().toString(36).slice(2, 8)}@example.com`,
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("sites", {
          organizationId,
          name: "Test Site",
          isActive: true,
          isPrimary: false,
        });
      }),
    ]);
    await expect(
      authed.mutation(api.sites.grantUserSiteAccess, {
        siteId,
        userId: otherUserId,
      }),
    ).rejects.toThrow("User is not a member of this organization");
  });

  test("should revoke user site access", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId, roleId } = await createOrgWithRole(t, [
      "sites.update",
    ]);
    const authed = authedForUser(t, userId);

    const otherUserId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Regular User",
        email: `user-${Math.random().toString(36).slice(2, 8)}@example.com`,
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("userOrganizations", {
        userId: otherUserId,
        organizationId,
        roleId,
        joinedAt: Date.now(),
      });
    });

    const { siteId, userSiteId } = await t.run(async (ctx) => {
      const siteId = await ctx.db.insert("sites", {
        organizationId,
        name: "Test Site",
        isActive: true,
        isPrimary: false,
      });

      const userSiteId = await ctx.db.insert("userSites", {
        userId: otherUserId,
        siteId,
        canAccess: true,
      });

      return { siteId, userSiteId };
    });

    await authed.mutation(api.sites.revokeUserSiteAccess, {
      siteId,
      userId: otherUserId,
    });

    const updatedUserSite = await t.run(
      async (ctx) => await ctx.db.get(userSiteId),
    );
    expect(updatedUserSite?.canAccess).toBe(false);
  });

  test("should handle revoking non-existent access gracefully", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId, roleId } = await createOrgWithRole(t, [
      "sites.update",
    ]);
    const authed = authedForUser(t, userId);

    const otherUserId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Regular User",
        email: `user-${Math.random().toString(36).slice(2, 8)}@example.com`,
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("userOrganizations", {
        userId: otherUserId,
        organizationId,
        roleId,
        joinedAt: Date.now(),
      });
    });

    const siteId = await t.run(async (ctx) => {
      return await ctx.db.insert("sites", {
        organizationId,
        name: "Test Site",
        isActive: true,
        isPrimary: false,
      });
    });

    const result = await authed.mutation(api.sites.revokeUserSiteAccess, {
      siteId,
      userId: otherUserId,
    });

    expect(result).toBeNull();
  });
});
