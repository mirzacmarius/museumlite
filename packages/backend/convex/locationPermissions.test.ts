import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { modules } from "../tests/testSetup";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

async function getRolePermissionNames(
  t: ReturnType<typeof convexTest>,
  roleId: Id<"roles">,
) {
  return t.run(async (ctx) => {
    const rolePermissions = await ctx.db
      .query("rolePermissions")
      .withIndex("by_role", (q) => q.eq("roleId", roleId))
      .collect();
    const permissions = await Promise.all(
      rolePermissions.map((rolePermission) =>
        ctx.db.get(rolePermission.permissionId),
      ),
    );
    return permissions.flatMap((permission) =>
      permission === null ? [] : [permission.name],
    );
  });
}

async function getRoleIdByName(
  t: ReturnType<typeof convexTest>,
  organizationId: Id<"organizations">,
  name: string,
) {
  return t.run(async (ctx) => {
    const role = await ctx.db
      .query("roles")
      .withIndex("by_organization_and_name", (q) =>
        q.eq("organizationId", organizationId).eq("name", name),
      )
      .unique();
    return role?._id ?? null;
  });
}

async function seedUserWithLocationUpdateOnly(
  t: ReturnType<typeof convexTest>,
  slugPrefix: string,
) {
  return t.run(async (ctx) => {
    const [userId, organizationId, updatePermissionId] = await Promise.all([
      ctx.db.insert("users", { name: "Object Mover" }),
      ctx.db.insert("organizations", {
        name: slugPrefix,
        slug: `${slugPrefix}-${Math.random().toString(36).slice(2, 8)}`,
        type: "museum",
      }),
      ctx.db.insert("permissions", {
        name: "locations.update",
        category: "locations",
        description: "Update object locations",
      }),
    ]);
    const roleId = await ctx.db.insert("roles", {
      organizationId,
      name: "Registrar",
      isSystemRole: false,
    });
    await ctx.db.insert("rolePermissions", {
      roleId,
      permissionId: updatePermissionId,
    });
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId,
      joinedAt: Date.now(),
    });

    return { userId, organizationId };
  });
}

test("default curator and registrar roles cannot add or delete locations", async () => {
  const t = convexTest(schema, modules);
  const organizationId = await t.run(async (ctx) => {
    return await ctx.db.insert("organizations", {
      name: "Location Permission Org",
      slug: `location-permission-org-${Math.random().toString(36).slice(2, 8)}`,
      type: "museum",
    });
  });

  await t.mutation(internal.organizations.createDefaultRoles, {
    organizationId,
  });

  const [adminRoleId, curatorRoleId, registrarRoleId] = await Promise.all([
    getRoleIdByName(t, organizationId, "admin"),
    getRoleIdByName(t, organizationId, "curator"),
    getRoleIdByName(t, organizationId, "registrar"),
  ]);

  if (!adminRoleId || !curatorRoleId || !registrarRoleId) {
    throw new Error("Expected default admin, curator, and registrar roles");
  }

  const [adminPerms, curatorPerms, registrarPerms] = await Promise.all([
    getRolePermissionNames(t, adminRoleId),
    getRolePermissionNames(t, curatorRoleId),
    getRolePermissionNames(t, registrarRoleId),
  ]);

  expect(adminPerms).toEqual(
    expect.arrayContaining([
      "locations.create",
      "locations.update",
      "locations.delete",
    ]),
  );
  expect(curatorPerms).toContain("locations.read");
  expect(curatorPerms).toContain("locations.update");
  expect(curatorPerms).not.toContain("locations.create");
  expect(curatorPerms).not.toContain("locations.delete");
  expect(registrarPerms).toContain("locations.read");
  expect(registrarPerms).toContain("locations.update");
  expect(registrarPerms).not.toContain("locations.create");
  expect(registrarPerms).not.toContain("locations.delete");
});

test("locations.update and reorder require locations.create, not only locations.update", async () => {
  const t = convexTest(schema, modules);
  const context = await seedUserWithLocationUpdateOnly(t, "object-move-org");
  const locationId = await t.run(async (ctx) =>
    ctx.db.insert("locations", {
      organizationId: context.organizationId,
      name: "Storage A",
      locationCode: "ST-001",
      locationCodeNormalized: "st-001",
      type: "storage",
      sortOrder: 0,
      isActive: true,
    }),
  );

  const asUser = t.withIdentity({ subject: context.userId });

  await expect(
    asUser.mutation(api.locations.create, {
      organizationId: context.organizationId,
      name: "Storage B",
      locationCode: "ST-002",
      type: "storage",
    }),
  ).rejects.toThrow("Permission denied: locations.create");

  await expect(
    asUser.mutation(api.locations.update, {
      locationId,
      name: "Storage A Renamed",
    }),
  ).rejects.toThrow("Permission denied: locations.create");

  await expect(
    asUser.mutation(api.locations.reorder, {
      locationId,
      newSortOrder: 2,
    }),
  ).rejects.toThrow("Permission denied: locations.create");

  await expect(
    asUser.mutation(api.locations.updateStatus, {
      locationId,
      status: "restricted",
    }),
  ).rejects.toThrow("Permission denied: locations.create");
});

test("object placement still works with only locations.update", async () => {
  const t = convexTest(schema, modules);
  const { userId, organizationId } = await seedUserWithLocationUpdateOnly(
    t,
    "placement-org",
  );
  const context = await t.run(async (ctx) => {
    const [fromLocationId, toLocationId] = await Promise.all([
      ctx.db.insert("locations", {
        organizationId,
        name: "Room A",
        locationCode: "R-A",
        locationCodeNormalized: "r-a",
        type: "room",
        sortOrder: 0,
        isActive: true,
      }),
      ctx.db.insert("locations", {
        organizationId,
        name: "Room B",
        locationCode: "R-B",
        locationCodeNormalized: "r-b",
        type: "room",
        sortOrder: 1,
        isActive: true,
      }),
    ]);
    const collectionId = await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "OBJ-100",
      title: "Portable Object",
      currentLocationId: fromLocationId,
      status: "active",
      catalogedBy: userId,
      catalogedAt: Date.now(),
    });

    return { toLocationId, collectionId };
  });

  const asUser = t.withIdentity({ subject: userId });
  await asUser.mutation(api.locations.moveObject, {
    collectionId: context.collectionId,
    toLocationId: context.toLocationId,
  });

  const collection = await t.run(async (ctx) =>
    ctx.db.get(context.collectionId),
  );
  expect(collection?.currentLocationId).toBe(context.toLocationId);
});

test("revokeNonAdminLocationStructurePermissions strips create/delete from curator and registrar", async () => {
  const t = convexTest(schema, modules);
  const setup = await t.run(async (ctx) => {
    const organizationId = await ctx.db.insert("organizations", {
      name: "Legacy Location Perms Org",
      slug: `legacy-location-org-${Math.random().toString(36).slice(2, 8)}`,
      type: "museum",
    });
    const [createPermissionId, deletePermissionId, updatePermissionId] =
      await Promise.all([
        ctx.db.insert("permissions", {
          name: "locations.create",
          category: "locations",
          description: "Create locations",
        }),
        ctx.db.insert("permissions", {
          name: "locations.delete",
          category: "locations",
          description: "Delete locations",
        }),
        ctx.db.insert("permissions", {
          name: "locations.update",
          category: "locations",
          description: "Update object locations",
        }),
      ]);

    const [adminRoleId, curatorRoleId, registrarRoleId] = await Promise.all([
      ctx.db.insert("roles", {
        organizationId,
        name: "admin",
        isSystemRole: true,
      }),
      ctx.db.insert("roles", {
        organizationId,
        name: "curator",
        isSystemRole: true,
      }),
      ctx.db.insert("roles", {
        organizationId,
        name: "registrar",
        isSystemRole: true,
      }),
    ]);

    await Promise.all(
      [adminRoleId, curatorRoleId, registrarRoleId].flatMap((roleId) =>
        [createPermissionId, deletePermissionId, updatePermissionId].map(
          (permissionId) =>
            ctx.db.insert("rolePermissions", { roleId, permissionId }),
        ),
      ),
    );

    return { adminRoleId, curatorRoleId, registrarRoleId };
  });

  const result = await t.mutation(
    internal.migrations.revokeNonAdminLocationStructurePermissions,
    {},
  );
  expect(result.rolePermissionsRemoved).toBe(4);

  const [adminPerms, curatorPerms, registrarPerms] = await Promise.all([
    getRolePermissionNames(t, setup.adminRoleId),
    getRolePermissionNames(t, setup.curatorRoleId),
    getRolePermissionNames(t, setup.registrarRoleId),
  ]);

  expect(adminPerms).toEqual(
    expect.arrayContaining([
      "locations.create",
      "locations.update",
      "locations.delete",
    ]),
  );
  expect(curatorPerms).toEqual(["locations.update"]);
  expect(registrarPerms).toEqual(["locations.update"]);
});
