import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";
import { modules } from "./testSetup";

function authedForUser(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.withIdentity({
    subject: `${userId}|session-1`,
    issuer: "https://example.test",
  });
}

async function createAdminOrganization(
  t: ReturnType<typeof convexTest>,
  name: string,
) {
  return await t.run(async (ctx) => {
    const [userId, organizationId] = await Promise.all([
      ctx.db.insert("users", {
        name: `${name} Admin`,
        email: `${name.toLowerCase().replace(/\s+/g, "-")}@example.com`,
      }),
      ctx.db.insert("organizations", {
        name,
        slug: `${name.toLowerCase().replace(/\s+/g, "-")}-${Math.random()
          .toString(36)
          .slice(2, 8)}`,
        type: "museum",
      }),
    ]);
    const roleId = await ctx.db.insert("roles", {
      organizationId,
      name: "admin",
      isSystemRole: true,
    });

    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId,
      joinedAt: Date.now(),
    });

    return { organizationId, roleId, userId };
  });
}

describe("organizationCleanup", () => {
  test("reports organization footprints for admin organizations", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createAdminOrganization(
      t,
      "Cleanup Report Org",
    );

    await t.run(async (ctx) => {
      await ctx.db.insert("organizationUsageCounters", {
        organizationId,
        objectCount: 12,
        mediaFileCount: 3,
        mediaVersionCount: 1,
        storageBytes: 4096,
        mediaByType: {
          image: {
            count: 3,
            bytes: 4096,
          },
        },
        lastUpdatedAt: Date.now(),
      });

      await ctx.db.insert("notifications", {
        organizationId,
        userId,
        type: "task_assigned",
        title: "Assigned",
        message: "New task",
        read: false,
        createdAt: Date.now(),
      });

      await ctx.db.insert("workflowSlaConfigs", {
        organizationId,
        workflowType: "loan",
        slaDays: 5,
        isActive: true,
        createdBy: userId,
        createdAt: Date.now(),
      });

      await ctx.db.insert("auditLog", {
        organizationId,
        userId,
        action: "created_collection",
        entityType: "collection",
        entityId: "collection_1",
        timestamp: Date.now(),
      });
    });

    const authed = authedForUser(t, userId);
    const report = await authed.query(
      api.organizationCleanup.getOrganizationFootprints,
      {
        organizationIds: [organizationId],
      },
    );

    expect(report).toHaveLength(1);
    expect(report[0].organizationId).toBe(organizationId);
    expect(report[0].objectCount).toBe(12);
    expect(report[0].storageBytes).toBe(4096);
    expect(report[0].notificationCount).toBe(1);
    expect(report[0].workflowSlaConfigCount).toBe(1);
    expect(report[0].recentActivityCount).toBe(1);
  });

  test("dry-run is rerunnable and museum purge preserves its footprint", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createAdminOrganization(
      t,
      "Cleanup Purge Org",
    );

    const storageId = await t.run(async (ctx) => {
      return await ctx.storage.store(
        new Blob([new Uint8Array([1, 2, 3, 4])], { type: "image/jpeg" }),
      );
    });

    await t.run(async (ctx) => {
      const collectionId = await ctx.db.insert("collections", {
        organizationId,
        accessionNumber: "PURGE-001",
        title: "Purge Me",
        status: "active",
        catalogedBy: userId,
        catalogedAt: Date.now(),
      });

      await ctx.db.insert("mediaFiles", {
        organizationId,
        collectionId,
        storageId,
        fileName: "purge.jpg",
        fileType: "image",
        fileSize: 4,
        mimeType: "image/jpeg",
        mediaCategory: "image",
        isPrimary: true,
        uploadedBy: userId,
        uploadedAt: Date.now(),
        uploadStatus: "completed",
      });

      await ctx.db.insert("organizationUsageCounters", {
        organizationId,
        objectCount: 1,
        mediaFileCount: 1,
        mediaVersionCount: 0,
        storageBytes: 4,
        mediaByType: {
          image: {
            count: 1,
            bytes: 4,
          },
        },
        lastUpdatedAt: Date.now(),
      });

      await ctx.db.insert("userPreferences", {
        userId,
        organizationId,
        key: "organization.activeOrgId",
        value: organizationId,
        updatedAt: Date.now(),
      });

      return await ctx.db.insert("workflowSlaConfigs", {
        organizationId,
        workflowType: "loan",
        slaDays: 7,
        isActive: true,
        createdBy: userId,
        createdAt: Date.now(),
      });
    });

    const authed = authedForUser(t, userId);

    const dryRun = await authed.mutation(
      api.organizationCleanup.purgeOrganizations,
      {
        organizationIds: [organizationId],
        dryRun: true,
      },
    );

    expect(dryRun).toHaveLength(1);
    expect(dryRun[0].dryRun).toBe(true);
    expect(dryRun[0].storageFiles).toBe(1);
    expect(
      dryRun[0].tableCounts.some((entry) => entry.table === "organizations"),
    ).toBe(true);
    expect(
      dryRun[0].tableCounts.some((entry) => entry.table === "collections"),
    ).toBe(true);

    await expect(
      authed.mutation(api.organizationCleanup.purgeOrganizations, {
        organizationIds: [organizationId],
        dryRun: false,
      }),
    ).rejects.toThrow("Permanent evidence");
    const repeated = await authed.mutation(
      api.organizationCleanup.purgeOrganizations,
      {
        organizationIds: [organizationId],
        dryRun: true,
      },
    );
    expect(repeated).toEqual(dryRun);
    const footprints = await authed.query(
      api.organizationCleanup.getOrganizationFootprints,
      { organizationIds: [organizationId] },
    );
    expect(footprints[0]?.objectCount).toBe(1);
    expect(footprints[0]?.storageBytes).toBe(4);
  });
});
