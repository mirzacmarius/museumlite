import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
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
  const organizationId = await t.run(async (ctx) => {
    return await ctx.db.insert("organizations", {
      name: "Accounts Org",
      slug: `accounts-org-${Math.random().toString(36).slice(2, 8)}`,
      type: "museum",
      settings: {
        enabledModules: ["accounts"],
      },
    });
  });

  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      name: "Accounts User",
      email: `accounts-${Math.random().toString(36).slice(2, 8)}@test.dev`,
    });
  });

  const roleId = await t.run(async (ctx) => {
    return await ctx.db.insert("roles", {
      organizationId,
      name: "Accounts Role",
      isSystemRole: true,
    });
  });

  for (const permissionName of permissionNames) {
    const permissionId = await t.run(async (ctx) => {
      return await ctx.db.insert("permissions", {
        name: permissionName,
        category: "accounts",
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("rolePermissions", {
        roleId,
        permissionId,
      });
    });
  }

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

describe("Epic 2 audit logging", () => {
  test("create account logs audit entry", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createOrgWithRole(t, [
      "accounts.write",
    ]);

    const authed = t.withIdentity({
      subject: `${userId}|session-accounts`,
      issuer: "https://example.test",
    });

    const accountId = await authed.mutation(api.accounts.create, {
      organizationId,
      accountType: "institution",
      businessName: "Example Institution",
    });

    const auditEntry = await t.run(async (ctx) => {
      return await ctx.db
        .query("auditLog")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", organizationId),
        )
        .filter((q) => q.eq(q.field("entityId"), accountId))
        .first();
    });

    expect(auditEntry?.action).toBe("created_account");
  });

  test("update status logs audit entry", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createOrgWithRole(t, [
      "accounts.write",
      "accounts.manage",
    ]);

    const authed = t.withIdentity({
      subject: `${userId}|session-accounts-status`,
      issuer: "https://example.test",
    });

    const accountId = await authed.mutation(api.accounts.create, {
      organizationId,
      accountType: "institution",
      businessName: "Status Test",
    });

    await authed.mutation(api.accounts.updateStatus, {
      accountId,
      status: "suspended",
    });

    const auditEntry = await t.run(async (ctx) => {
      return await ctx.db
        .query("auditLog")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", organizationId),
        )
        .filter((q) => q.eq(q.field("entityId"), accountId))
        .order("desc")
        .first();
    });

    expect(auditEntry?.action).toBe("updated_account_status");
  });

  test("missing permission blocks account creation", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createOrgWithRole(t, []);

    const authed = t.withIdentity({
      subject: `${userId}|session-accounts-denied`,
      issuer: "https://example.test",
    });

    await expect(
      authed.mutation(api.accounts.create, {
        organizationId,
        accountType: "institution",
        businessName: "Denied Account",
      }),
    ).rejects.toThrow("Permission denied: accounts.write");
  });
});
