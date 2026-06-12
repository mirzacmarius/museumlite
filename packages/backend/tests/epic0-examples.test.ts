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
        name: "Example Org",
        slug: `example-org-${Math.random().toString(36).slice(2, 8)}`,
        type: "museum",
        settings: {
          enabledModules: ["accounts"],
        },
      });
    }),
    t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Example User",
        email: `example-${Math.random().toString(36).slice(2, 8)}@test.dev`,
      });
    }),
  ]);
  const [roleId, permissionIds] = await Promise.all([
    t.run(async (ctx) => {
      return await ctx.db.insert("roles", {
        organizationId,
        name: "Example Role",
        isSystemRole: true,
      });
    }),
    Promise.all(
      permissionNames.map((permissionName) =>
        t.run(async (ctx) => {
          return await ctx.db.insert("permissions", {
            name: permissionName,
            category: permissionName.split(".")[0] ?? "general",
          });
        }),
      ),
    ),
  ]);
  await Promise.all(
    permissionIds.map((permissionId) =>
      t.run(async (ctx) => {
        await ctx.db.insert("rolePermissions", {
          roleId,
          permissionId,
        });
      }),
    ),
  );

  await t.run(async (ctx) => {
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId,
      joinedAt: Date.now(),
    });
  });

  return { organizationId, userId, roleId };
}

describe("Epic 0 examples", () => {
  test("query with permission check", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createOrgWithRole(t, [
      "locations.read",
    ]);

    await t.run(async (ctx) => {
      await ctx.db.insert("locations", {
        organizationId,
        name: "Storage A",
        locationCode: "ST-001",
        locationCodeNormalized: "st-001",
        type: "room",
        parentLocationId: undefined,
        sortOrder: 1,
        isActive: true,
      });
    });

    const authed = t.withIdentity({
      subject: `${userId}|session-1`,
      issuer: "https://example.test",
    });

    const locations = await authed.query(api.locations.listAll, {
      organizationId,
    });

    expect(locations).toHaveLength(1);
  });

  test("mutation writes audit log entry", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createOrgWithRole(t, [
      "locations.update",
    ]);

    const [fromLocationId, toLocationId] = await Promise.all([
      t.run(async (ctx) => {
        return await ctx.db.insert("locations", {
          organizationId,
          name: "Vault",
          locationCode: "V-001",
          locationCodeNormalized: "v-001",
          type: "room",
          parentLocationId: undefined,
          sortOrder: 1,
          isActive: true,
        });
      }),
      t.run(async (ctx) => {
        return await ctx.db.insert("locations", {
          organizationId,
          name: "Gallery",
          locationCode: "G-001",
          locationCodeNormalized: "g-001",
          type: "room",
          parentLocationId: undefined,
          sortOrder: 2,
          isActive: true,
        });
      }),
    ]);
    const collectionId = await t.run(async (ctx) => {
      return await ctx.db.insert("collections", {
        organizationId,
        accessionNumber: `ACC-${Math.random().toString(36).slice(2, 8)}`,
        title: "Example Object",
        status: "active",
        currentLocationId: fromLocationId,
        catalogedBy: userId,
        catalogedAt: Date.now(),
      });
    });

    const authed = t.withIdentity({
      subject: `${userId}|session-2`,
      issuer: "https://example.test",
    });

    const requestId = await authed.mutation(api.locations.createMoveRequest, {
      collectionId,
      toLocationId,
      reason: "Relocation",
    });

    expect(requestId).toBeDefined();

    const auditEntry = await t.run(async (ctx) => {
      return await ctx.db
        .query("auditLog")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", organizationId),
        )
        .filter((q) => q.eq(q.field("entityId"), collectionId))
        .first();
    });

    expect(auditEntry?.action).toBe("created_move_request");
  });

  test("action returns validation result", async () => {
    const t = convexTest(schema, modules);

    const { organizationId, userId } = await t.run(async (ctx) => {
      const orgId = await ctx.db.insert("organizations", {
        name: "Library Org",
        slug: `library-org-${Math.random().toString(36).slice(2, 8)}`,
        type: "library",
        settings: { enabledModules: ["library"] },
      });
      const uid = await ctx.db.insert("users", {
        name: "Library User",
        email: `library-${Math.random().toString(36).slice(2, 8)}@example.com`,
      });
      const roleId = await ctx.db.insert("roles", {
        organizationId: orgId,
        name: "Member",
        isSystemRole: false,
      });
      await ctx.db.insert("userOrganizations", {
        userId: uid,
        organizationId: orgId,
        roleId,
        joinedAt: Date.now(),
      });
      return { organizationId: orgId, userId: uid };
    });

    const authed = t.withIdentity({
      subject: `${userId}|session-isbn`,
      issuer: "https://example.test",
    });

    const valid = await authed.action(api.library.isbnLookup.validateIsbn, {
      organizationId,
      isbn: "9780140449136",
    });

    expect(valid.valid).toBe(true);

    const invalid = await authed.action(api.library.isbnLookup.validateIsbn, {
      organizationId,
      isbn: "1234567890",
    });

    expect(invalid.valid).toBe(false);
  });
});
