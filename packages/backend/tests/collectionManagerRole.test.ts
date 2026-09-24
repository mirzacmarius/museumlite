import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../convex/_generated/api";
import schema from "../convex/schema";
import {
  ADMIN_ROLE_DESCRIPTION,
  ADMIN_ROLE_NAME,
  CATALOGER_ROLE_DESCRIPTION,
  CATALOGER_ROLE_NAME,
  COLLECTION_MANAGER_ROLE_DESCRIPTION,
  COLLECTION_MANAGER_ROLE_NAME,
  CURATOR_ROLE_DESCRIPTION,
  CURATOR_ROLE_NAME,
  LEGACY_REGISTRAR_ROLE_NAME,
  VIEWER_ROLE_DESCRIPTION,
  VIEWER_ROLE_NAME,
} from "../convex/utils/systemRoles";
import { authedForUser } from "./testHarness";
import { modules } from "./testSetup";

describe("collection manager system role", () => {
  test("new organizations seed Collection Manager instead of registrar", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Role Admin",
        email: `roles-${Math.random().toString(36).slice(2, 8)}@test.dev`,
      });
    });
    const authed = authedForUser(t, userId);
    const organizationId = await authed.mutation(api.organizations.create, {
      name: "Role Museum",
      slug: `roles-${Math.random().toString(36).slice(2, 8)}`,
      type: "museum",
    });

    const { collectionManager, legacyRole, accessionConfig } = await t.run(
      async (ctx) => {
        const roles = await ctx.db
          .query("roles")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organizationId),
          )
          .collect();
        const accessionConfig = await ctx.db
          .query("workflowConfigs")
          .withIndex("by_organization_and_workflowType", (q) =>
            q
              .eq("organizationId", organizationId)
              .eq("workflowType", "accession"),
          )
          .unique();

        return {
          collectionManager: roles.find(
            (role) => role.name === COLLECTION_MANAGER_ROLE_NAME,
          ),
          legacyRole: roles.find(
            (role) => role.name === LEGACY_REGISTRAR_ROLE_NAME,
          ),
          accessionConfig,
        };
      },
    );

    expect(collectionManager?.isSystemRole).toBe(true);
    expect(collectionManager?.description).toBe(
      COLLECTION_MANAGER_ROLE_DESCRIPTION,
    );
    expect(legacyRole).toBeUndefined();
    expect(accessionConfig?.steps[0]?.roleId).toBe(collectionManager?._id);
    expect(accessionConfig?.steps[0]?.name).toBe("Registrar Review");
  });

  test("presents every visible system role with a descriptive name and access summary", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Role Viewer",
        email: `role-viewer-${Math.random().toString(36).slice(2, 8)}@test.dev`,
      });
    });
    const authed = authedForUser(t, userId);
    const organizationId = await authed.mutation(api.organizations.create, {
      name: "Role Presentation Museum",
      slug: `role-presentation-${Math.random().toString(36).slice(2, 8)}`,
      type: "museum",
    });

    const roles = await authed.query(api.roles.listRoles, { organizationId });
    const expectedRoles = [
      { name: ADMIN_ROLE_NAME, description: ADMIN_ROLE_DESCRIPTION },
      { name: CURATOR_ROLE_NAME, description: CURATOR_ROLE_DESCRIPTION },
      {
        name: COLLECTION_MANAGER_ROLE_NAME,
        description: COLLECTION_MANAGER_ROLE_DESCRIPTION,
      },
      { name: CATALOGER_ROLE_NAME, description: CATALOGER_ROLE_DESCRIPTION },
      { name: VIEWER_ROLE_NAME, description: VIEWER_ROLE_DESCRIPTION },
    ];

    for (const expectedRole of expectedRoles) {
      expect(roles).toContainEqual(expect.objectContaining(expectedRole));
    }
  });

  test("migration renames the existing system registrar role in place", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, roleId, permissionId } = await t.run(
      async (ctx) => {
        const organizationId = await ctx.db.insert("organizations", {
          name: "Legacy Museum",
          slug: `legacy-${Math.random().toString(36).slice(2, 8)}`,
          type: "museum",
        });
        const roleId = await ctx.db.insert("roles", {
          organizationId,
          name: LEGACY_REGISTRAR_ROLE_NAME,
          description:
            "Accession/deaccession workflows, location management, loans",
          isSystemRole: true,
        });
        const permissionId = await ctx.db.insert("permissions", {
          name: "loans.read",
          category: "loans",
        });
        await ctx.db.insert("rolePermissions", {
          roleId,
          permissionId,
        });
        return { organizationId, roleId, permissionId };
      },
    );

    const firstRun = await t.mutation(
      internal.migrations.renameRegistrarToCollectionManager,
      {},
    );
    const secondRun = await t.mutation(
      internal.migrations.renameRegistrarToCollectionManager,
      {},
    );

    const after = await t.run(async (ctx) => {
      const role = await ctx.db.get(roleId);
      const rolePermission = await ctx.db
        .query("rolePermissions")
        .withIndex("by_role", (q) => q.eq("roleId", roleId))
        .first();
      const legacy = await ctx.db
        .query("roles")
        .withIndex("by_organization_and_name", (q) =>
          q
            .eq("organizationId", organizationId)
            .eq("name", LEGACY_REGISTRAR_ROLE_NAME),
        )
        .first();
      return { role, rolePermission, legacy };
    });

    expect(firstRun.renamed).toBe(1);
    expect(firstRun.descriptionsUpdated).toBe(1);
    expect(firstRun.skippedNameConflicts).toBe(0);
    expect(secondRun.renamed).toBe(0);
    expect(secondRun.descriptionsUpdated).toBe(0);
    expect(after.role?.name).toBe(COLLECTION_MANAGER_ROLE_NAME);
    expect(after.role?.description).toBe(COLLECTION_MANAGER_ROLE_DESCRIPTION);
    expect(after.role?.isSystemRole).toBe(true);
    expect(after.legacy).toBeNull();
    expect(after.rolePermission?.permissionId).toBe(permissionId);
  });

  test("migration leaves a custom registrar role unchanged", async () => {
    const t = convexTest(schema, modules);
    const roleId = await t.run(async (ctx) => {
      const organizationId = await ctx.db.insert("organizations", {
        name: "Custom Role Museum",
        slug: `custom-${Math.random().toString(36).slice(2, 8)}`,
        type: "museum",
      });
      return await ctx.db.insert("roles", {
        organizationId,
        name: LEGACY_REGISTRAR_ROLE_NAME,
        description: "Custom registrar",
        isSystemRole: false,
      });
    });

    const result = await t.mutation(
      internal.migrations.renameRegistrarToCollectionManager,
      {},
    );
    const role = await t.run(async (ctx) => ctx.db.get(roleId));

    expect(result.renamed).toBe(0);
    expect(role?.name).toBe(LEGACY_REGISTRAR_ROLE_NAME);
    expect(role?.description).toBe("Custom registrar");
  });

  test("migration skips a system registrar role when Collection Manager already exists", async () => {
    const t = convexTest(schema, modules);
    const { legacyRoleId, currentRoleId } = await t.run(async (ctx) => {
      const organizationId = await ctx.db.insert("organizations", {
        name: "Conflict Museum",
        slug: `conflict-${Math.random().toString(36).slice(2, 8)}`,
        type: "museum",
      });
      const legacyRoleId = await ctx.db.insert("roles", {
        organizationId,
        name: LEGACY_REGISTRAR_ROLE_NAME,
        description: "System registrar",
        isSystemRole: true,
      });
      const currentRoleId = await ctx.db.insert("roles", {
        organizationId,
        name: COLLECTION_MANAGER_ROLE_NAME,
        description: "Existing collection manager",
        isSystemRole: false,
      });
      return { legacyRoleId, currentRoleId };
    });

    const result = await t.mutation(
      internal.migrations.renameRegistrarToCollectionManager,
      {},
    );
    const [legacyRole, currentRole] = await t.run(async (ctx) => {
      return await Promise.all([
        ctx.db.get(legacyRoleId),
        ctx.db.get(currentRoleId),
      ]);
    });

    expect(result.skippedNameConflicts).toBe(1);
    expect(result.renamed).toBe(0);
    expect(legacyRole?.name).toBe(LEGACY_REGISTRAR_ROLE_NAME);
    expect(currentRole?.description).toBe("Existing collection manager");
  });

  test("migration refreshes descriptions for existing system roles", async () => {
    const t = convexTest(schema, modules);
    const roleIds = await t.run(async (ctx) => {
      const organizationId = await ctx.db.insert("organizations", {
        name: "Existing Roles Museum",
        slug: `existing-roles-${Math.random().toString(36).slice(2, 8)}`,
        type: "museum",
      });

      return await Promise.all([
        ctx.db.insert("roles", {
          organizationId,
          name: "admin",
          description: "Full organization access",
          isSystemRole: true,
        }),
        ctx.db.insert("roles", {
          organizationId,
          name: "curator",
          description: "Collection management",
          isSystemRole: true,
        }),
        ctx.db.insert("roles", {
          organizationId,
          name: "cataloger",
          description: "Object cataloging",
          isSystemRole: true,
        }),
        ctx.db.insert("roles", {
          organizationId,
          name: "viewer",
          description: "Read-only access",
          isSystemRole: true,
        }),
      ]);
    });

    const result = await t.mutation(
      internal.migrations.refreshSystemRoleDescriptions,
      {},
    );
    const roles = await t.run(async (ctx) => {
      return await Promise.all(roleIds.map((roleId) => ctx.db.get(roleId)));
    });

    expect(result.rolesMatched).toBe(4);
    expect(result.descriptionsUpdated).toBe(4);
    expect(roles.map((role) => role?.description)).toEqual([
      ADMIN_ROLE_DESCRIPTION,
      CURATOR_ROLE_DESCRIPTION,
      CATALOGER_ROLE_DESCRIPTION,
      VIEWER_ROLE_DESCRIPTION,
    ]);
  });
});
