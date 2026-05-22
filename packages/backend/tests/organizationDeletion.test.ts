import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";
import {
  ORGANIZATION_DELETION_FINAL_NOTICE_DISPLAY_MS,
  ORGANIZATION_DELETION_GRACE_MS,
  ORGANIZATION_DELETION_PURGE_AFTER_FINAL_NOTICE_MS,
  ORGANIZATION_DELETION_WAIT_BEFORE_FINAL_NOTICE_MS,
} from "../convex/utils/organizationDeletionTimings";
import { modules } from "./testSetup";

function authedForUser(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.withIdentity({
    subject: `${userId}|session-1`,
    issuer: "https://example.test",
  });
}

async function createOwnerOrganization(t: ReturnType<typeof convexTest>) {
  const ownerUserId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      name: "Deletion Owner",
      email: `owner-${Math.random().toString(36).slice(2, 8)}@test.dev`,
    });
  });
  const memberUserId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      name: "Deletion Member",
      email: `member-${Math.random().toString(36).slice(2, 8)}@test.dev`,
    });
  });
  const organizationId = await t.run(async (ctx) => {
    return await ctx.db.insert("organizations", {
      name: "Deletion Test Org",
      slug: `deletion-org-${Math.random().toString(36).slice(2, 8)}`,
      type: "museum",
      subscriptionTier: "pro",
      ownerUserId,
      isActive: true,
    });
  });
  const roleId = await t.run(async (ctx) => {
    return await ctx.db.insert("roles", {
      organizationId,
      name: "admin",
      isSystemRole: true,
    });
  });

  const permissionId = await t.run(async (ctx) => {
    return await ctx.db.insert("permissions", {
      name: "organization.manage_settings",
      category: "organization",
    });
  });

  await t.run(async (ctx) => {
    await ctx.db.insert("rolePermissions", {
      roleId,
      permissionId,
    });
    await ctx.db.insert("userOrganizations", {
      userId: ownerUserId,
      organizationId,
      roleId,
      joinedAt: Date.now(),
    });
    await ctx.db.insert("userOrganizations", {
      userId: memberUserId,
      organizationId,
      roleId,
      joinedAt: Date.now(),
    });
  });

  return { organizationId, ownerUserId, memberUserId, roleId };
}

describe("organizationDeletion", () => {
  test("owner can request deletion and inactivate organization", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, ownerUserId } = await createOwnerOrganization(t);
    const authed = authedForUser(t, ownerUserId);

    const summary = await authed.mutation(api.organizationDeletion.requestDeletion, {
      organizationId,
    });

    expect(summary.status).toBe("grace_period");

    const organization = await t.run(async (ctx) => ctx.db.get(organizationId));
    expect(organization?.isActive).toBe(false);

    const auditEntry = await t.run(async (ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .order("desc")
        .first(),
    );
    expect(auditEntry?.action).toBe("scheduled_organization_deletion");
    expect(auditEntry?.userId).toBe(ownerUserId);
  });

  test("owner can cancel deletion and reactivate organization", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, ownerUserId } = await createOwnerOrganization(t);
    const authed = authedForUser(t, ownerUserId);

    await authed.mutation(api.organizationDeletion.requestDeletion, {
      organizationId,
    });
    await authed.mutation(api.organizationDeletion.cancelDeletion, {
      organizationId,
    });

    const organization = await t.run(async (ctx) => ctx.db.get(organizationId));
    expect(organization?.isActive).toBe(true);

    const status = await authed.query(api.organizationDeletion.getDeletionStatus, {
      organizationId,
    });
    expect(status).toBeNull();
  });

  test("cancel deletion works with email token without authentication", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, ownerUserId } = await createOwnerOrganization(t);
    const authed = authedForUser(t, ownerUserId);

    const summary = await authed.mutation(api.organizationDeletion.requestDeletion, {
      organizationId,
    });

    await t.mutation(api.organizationDeletion.cancelDeletion, {
      token: summary.cancelToken,
    });

    const organization = await t.run(async (ctx) => ctx.db.get(organizationId));
    expect(organization?.isActive).toBe(true);
  });

  test("transferring ownership cancels active deletion", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, ownerUserId, memberUserId } =
      await createOwnerOrganization(t);
    const authed = authedForUser(t, ownerUserId);

    await authed.mutation(api.organizationDeletion.requestDeletion, {
      organizationId,
    });

    await authed.mutation(api.organizationDeletion.transferOwnership, {
      organizationId,
      newOwnerUserId: memberUserId,
    });

    const [organization, status] = await Promise.all([
      t.run(async (ctx) => ctx.db.get(organizationId)),
      authed.query(api.organizationDeletion.getDeletionStatus, {
        organizationId,
      }),
    ]);

    expect(status).toBeNull();
    expect(organization?.isActive).toBe(true);
    expect(organization?.ownerUserId).toBe(memberUserId);
    expect(organization?.requiresPlanSelection).toBe(true);
    expect(organization?.preservedSubscriptionTier).toBe("pro");
    expect(organization?.subscriptionTier).toBe("pro");
  });

  test("cron advances deletion phases and purges organization", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, ownerUserId } = await createOwnerOrganization(t);
    const authed = authedForUser(t, ownerUserId);

    const summary = await authed.mutation(api.organizationDeletion.requestDeletion, {
      organizationId,
    });

    const now = Date.now();
    await t.run(async (ctx) => {
      const deletion = await ctx.db.get(summary.deletionId);
      if (!deletion) {
        throw new Error("Deletion record missing");
      }
      await ctx.db.patch(deletion._id, {
        graceEndsAt: now - 1,
        finalNoticeAt: now - 1,
      });
    });

    const afterGrace: { advanced: number; purged: number } = await t.mutation(
      internal.organizationDeletion.processOrganizationDeletionsInternal,
      {},
    );
    expect(afterGrace.advanced).toBeGreaterThan(0);

    await t.run(async (ctx) => {
      const deletion = await ctx.db.get(summary.deletionId);
      if (!deletion) {
        throw new Error("Deletion record missing");
      }
      await ctx.db.patch(deletion._id, {
        status: "pending_purge",
        scheduledPurgeAt: now - 1,
        scheduledDeletionDate: now + ORGANIZATION_DELETION_FINAL_NOTICE_DISPLAY_MS,
      });
    });

    const afterPurge: { advanced: number; purged: number } = await t.mutation(
      internal.organizationDeletion.processOrganizationDeletionsInternal,
      {},
    );
    expect(afterPurge.purged).toBe(1);

    const organization = await t.run(async (ctx) => ctx.db.get(organizationId));
    expect(organization).toBeNull();
  });

  test("schedules expected phase timestamps on request", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, ownerUserId } = await createOwnerOrganization(t);
    const authed = authedForUser(t, ownerUserId);

    const before = Date.now();
    const summary = await authed.mutation(api.organizationDeletion.requestDeletion, {
      organizationId,
    });
    const after = Date.now();

    expect(summary.graceEndsAt).toBeGreaterThanOrEqual(
      before + ORGANIZATION_DELETION_GRACE_MS,
    );
    expect(summary.graceEndsAt).toBeLessThanOrEqual(
      after + ORGANIZATION_DELETION_GRACE_MS,
    );
    expect(summary.finalNoticeAt).toBeGreaterThanOrEqual(
      summary.graceEndsAt + ORGANIZATION_DELETION_WAIT_BEFORE_FINAL_NOTICE_MS,
    );
    expect(summary.finalNoticeAt).toBeLessThanOrEqual(
      after +
        ORGANIZATION_DELETION_GRACE_MS +
        ORGANIZATION_DELETION_WAIT_BEFORE_FINAL_NOTICE_MS,
    );
    expect(summary.scheduledPurgeAt).toBeNull();
  });

  test("final notice sets purge window seven days after notice", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, ownerUserId } = await createOwnerOrganization(t);
    const authed = authedForUser(t, ownerUserId);

    const summary = await authed.mutation(api.organizationDeletion.requestDeletion, {
      organizationId,
    });

    const phaseStart = Date.now();
    await t.run(async (ctx) => {
      const deletion = await ctx.db.get(summary.deletionId);
      if (!deletion) {
        throw new Error("Deletion record missing");
      }
      await ctx.db.patch(deletion._id, {
        status: "awaiting_final_notice",
        graceEndsAt: phaseStart - 1,
        finalNoticeAt: phaseStart - 1,
      });
    });

    await t.mutation(internal.organizationDeletion.processOrganizationDeletionsInternal, {});

    const deletion = await t.run(async (ctx) => ctx.db.get(summary.deletionId));
    expect(deletion?.status).toBe("pending_purge");
    expect(deletion?.scheduledDeletionDate).toBeGreaterThanOrEqual(
      phaseStart + ORGANIZATION_DELETION_FINAL_NOTICE_DISPLAY_MS,
    );
    expect(deletion?.scheduledPurgeAt).toBeGreaterThanOrEqual(
      phaseStart + ORGANIZATION_DELETION_PURGE_AFTER_FINAL_NOTICE_MS,
    );
  });
});
