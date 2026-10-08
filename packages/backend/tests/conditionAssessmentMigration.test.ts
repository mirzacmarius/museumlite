import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "../convex/_generated/api";
import schema from "../convex/schema";
import {
  ADMIN_ROLE_NAME,
  CATALOGER_ROLE_NAME,
  COLLECTION_MANAGER_ROLE_NAME,
  CURATOR_ROLE_NAME,
  LEGACY_ADMIN_ROLE_NAME,
  LEGACY_CATALOGER_ROLE_NAME,
  LEGACY_CURATOR_ROLE_NAME,
  LEGACY_REGISTRAR_ROLE_NAME,
  LEGACY_VIEWER_ROLE_NAME,
} from "../convex/utils/systemRoles";
import { SUPER_ADMIN_ROLE_NAME } from "../convex/utils/superAdmins";
import { modules } from "./testSetup";

const ACCEPT_CONDITION = "collections.accept_condition";

describe("condition assessment review permission migration", () => {
  test("grants accept_condition to current and legacy privileged system roles only, once", async () => {
    const t = convexTest(schema, modules);
    const roles = await t.run(async (ctx) => {
      const organizationId = await ctx.db.insert("organizations", {
        name: "Legacy Roles Museum",
        slug: `legacy-roles-${Math.random().toString(36).slice(2, 8)}`,
        type: "museum",
      });
      const role = (name: string, isSystemRole = true) =>
        ctx.db.insert("roles", { organizationId, name, isSystemRole });
      return {
        organizationId,
        granted: {
          superAdmin: await role(SUPER_ADMIN_ROLE_NAME),
          legacyAdmin: await role(LEGACY_ADMIN_ROLE_NAME),
          admin: await role(ADMIN_ROLE_NAME),
          legacyCurator: await role(LEGACY_CURATOR_ROLE_NAME),
          curator: await role(CURATOR_ROLE_NAME),
          legacyRegistrar: await role(LEGACY_REGISTRAR_ROLE_NAME),
          collectionManager: await role(COLLECTION_MANAGER_ROLE_NAME),
        },
        notGranted: {
          legacyCataloger: await role(LEGACY_CATALOGER_ROLE_NAME),
          cataloger: await role(CATALOGER_ROLE_NAME),
          legacyViewer: await role(LEGACY_VIEWER_ROLE_NAME),
          customRegistrar: await role(LEGACY_REGISTRAR_ROLE_NAME, false),
          customCurator: await role(CURATOR_ROLE_NAME, false),
        },
      };
    });

    const run = () =>
      t.mutation(internal.conditionAssessmentMigration.grantReviewPermission, {
        organizationId: roles.organizationId,
      });
    await run();
    await run();

    const grantCounts = await t.run(async (ctx) => {
      const permission = await ctx.db
        .query("permissions")
        .withIndex("by_category", (q) => q.eq("category", "collections"))
        .filter((q) => q.eq(q.field("name"), ACCEPT_CONDITION))
        .unique();
      const count = async (roleId: (typeof roles.granted)["admin"]) =>
        (
          await ctx.db
            .query("rolePermissions")
            .withIndex("by_role", (q) => q.eq("roleId", roleId))
            .collect()
        ).filter((grant) => grant.permissionId === permission?._id).length;
      const counts = async (
        group: Record<string, typeof roles.granted.admin>,
      ) =>
        Object.fromEntries(
          await Promise.all(
            Object.entries(group).map(async ([key, roleId]) => [
              key,
              await count(roleId),
            ]),
          ),
        );
      return {
        granted: await counts(roles.granted),
        notGranted: await counts(roles.notGranted),
      };
    });

    expect(grantCounts.granted).toEqual({
      superAdmin: 1,
      legacyAdmin: 1,
      admin: 1,
      legacyCurator: 1,
      curator: 1,
      legacyRegistrar: 1,
      collectionManager: 1,
    });
    expect(grantCounts.notGranted).toEqual({
      legacyCataloger: 0,
      cataloger: 0,
      legacyViewer: 0,
      customRegistrar: 0,
      customCurator: 0,
    });
  });
});
