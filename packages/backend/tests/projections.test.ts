import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";
import { modules } from "./testSetup";

async function fixture(
  permissions: string[] = [
    "organization.manage_settings",
    "organization.view_analytics",
  ],
) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const organizationId = await ctx.db.insert("organizations", {
      name: "Projection Museum",
      slug: "projection-museum",
      type: "museum",
      subscriptionTier: "enterprise",
    });
    const userId = await ctx.db.insert("users", { name: "Registrar" });
    const roleId = await ctx.db.insert("roles", {
      organizationId,
      name: "Administrator",
      isSystemRole: false,
    });
    for (const name of permissions) {
      const permissionId = await ctx.db.insert("permissions", {
        name,
        category: "organization",
      });
      await ctx.db.insert("rolePermissions", { roleId, permissionId });
    }
    await ctx.db.insert("userOrganizations", {
      organizationId,
      userId,
      roleId,
      joinedAt: 1,
    });
    return { organizationId, userId };
  });
  const staff = t.withIdentity({
    subject: `${ids.userId}|session`,
    issuer: "https://example.test",
  });
  const settle = () => t.finishAllScheduledFunctions(vi.runAllTimers);
  return { t, staff, settle, ...ids };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("projection health and rebuild", () => {
  test("an organization without a built projection reports it unavailable until an authorized rebuild completes", async () => {
    const { staff, settle, organizationId } = await fixture();

    expect(
      await staff.query(api.projections.getHealth, { organizationId }),
    ).toMatchObject({
      availability: "unavailable",
      reason: "not_built",
      active: null,
    });

    await staff.mutation(api.projections.startRebuild, { organizationId });
    expect(
      await staff.query(api.projections.getHealth, { organizationId }),
    ).toMatchObject({
      availability: "unavailable",
      reason: "building",
      building: { status: "building", mode: "rebuild" },
    });

    await settle();
    expect(
      await staff.query(api.projections.getHealth, { organizationId }),
    ).toMatchObject({
      availability: "ready",
      active: { status: "completed", processedRows: 1 },
      building: null,
    });
  });
});
