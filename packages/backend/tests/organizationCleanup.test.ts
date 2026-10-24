import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";
import { datedEntries, metricTree } from "../convex/utils/projectionStore";
import { rebuildProjection } from "./testHarness";
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

  test("orphaned object commentary prevents organization purge", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createAdminOrganization(
      t,
      "Cleanup Object Commentary Org",
    );
    await t.run(async (ctx) => {
      await ctx.db.patch(organizationId, { type: "library" });
    });
    const commentId = await t.run(async (ctx) => {
      const collectionId = await ctx.db.insert("collections", {
        organizationId,
        accessionNumber: "ORPHAN-1",
        title: "Legacy object",
        status: "active",
        catalogedBy: userId,
        catalogedAt: 99,
      });
      const commentId = await ctx.db.insert("objectComments", {
        organizationId,
        objectId: collectionId,
        userId,
        content: "Original condition note",
        createdAt: 100,
      });
      await ctx.db.delete(collectionId);
      return commentId;
    });
    const admin = authedForUser(t, userId);

    await expect(
      admin.mutation(api.organizationCleanup.purgeOrganizations, {
        organizationIds: [organizationId],
        dryRun: false,
      }),
    ).rejects.toThrow("Permanent evidence");
    const [organization, comment] = await t.run(async (ctx) =>
      Promise.all([ctx.db.get(organizationId), ctx.db.get(commentId)]),
    );
    expect(organization?._id).toBe(organizationId);
    expect(comment?.content).toBe("Original condition note");
  });

  test("standalone workflow history prevents organization purge", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createAdminOrganization(
      t,
      "Cleanup Workflow Evidence Org",
    );
    await t.run(async (ctx) => {
      await ctx.db.patch(organizationId, { type: "library" });
    });
    const workflowEntryId = await t.run(async (ctx) =>
      ctx.db.insert("workflowHistory", {
        organizationId,
        workflowType: "accession",
        entityId: "legacy-accession-id",
        fromStep: 1,
        toStep: 2,
        action: "approved",
        performedBy: userId,
        performedAt: 101,
        comment: "Original approval decision",
      }),
    );
    const admin = authedForUser(t, userId);

    await expect(
      admin.mutation(api.organizationCleanup.purgeOrganizations, {
        organizationIds: [organizationId],
        dryRun: false,
      }),
    ).rejects.toThrow("Permanent evidence");
    const [organization, workflowEntry] = await t.run(async (ctx) =>
      Promise.all([ctx.db.get(organizationId), ctx.db.get(workflowEntryId)]),
    );
    expect(organization?._id).toBe(organizationId);
    expect(workflowEntry?.comment).toBe("Original approval decision");
  });

  test("internal purge preserves standalone documentary files and their blobs", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createAdminOrganization(
      t,
      "Cleanup Document Evidence Org",
    );
    await t.run(async (ctx) => {
      await ctx.db.patch(organizationId, { type: "library" });
    });
    const [documentId, storageId] = await t.run(async (ctx) => {
      const accountId = await ctx.db.insert("accounts", {
        organizationId,
        accountNumber: "ACC-HIST-1",
        accountType: "institution",
        businessName: "Historical lender",
        createdBy: userId,
        createdAt: 99,
      });
      const storageId = await ctx.storage.store(
        new Blob(["Original agreement"], { type: "application/pdf" }),
      );
      const documentId = await ctx.db.insert("accountDocuments", {
        organizationId,
        accountId,
        storageId,
        filename: "agreement.pdf",
        mimeType: "application/pdf",
        size: 18,
        documentType: "agreement",
        uploadedBy: userId,
        uploadedAt: 99,
      });
      return [documentId, storageId] as const;
    });

    await expect(
      t.mutation(internal.organizationCleanup.purgeOrganizationsInternal, {
        organizationIds: [organizationId],
        dryRun: false,
      }),
    ).rejects.toThrow("Permanent evidence");
    const [organization, document, originalFile] = await t.run(async (ctx) =>
      Promise.all([
        ctx.db.get(organizationId),
        ctx.db.get(documentId),
        ctx.db.system.get(storageId),
      ]),
    );
    expect(organization?._id).toBe(organizationId);
    expect(document?._id).toBe(documentId);
    expect(originalFile).not.toBeNull();
  });

  test("orphaned object audit history prevents organization purge", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createAdminOrganization(
      t,
      "Cleanup Orphan Audit Org",
    );
    await t.run(async (ctx) => {
      await ctx.db.patch(organizationId, { type: "library" });
    });
    const auditEntryId = await t.run(async (ctx) =>
      ctx.db.insert("auditLog", {
        organizationId,
        userId,
        action: "updated_collection",
        entityType: "collection",
        entityId: "missing-historical-collection",
        timestamp: 100,
      }),
    );
    const admin = authedForUser(t, userId);

    await expect(
      admin.mutation(api.organizationCleanup.purgeOrganizations, {
        organizationIds: [organizationId],
        dryRun: false,
      }),
    ).rejects.toThrow("Permanent evidence");
    const [organization, auditEntry] = await t.run(async (ctx) =>
      Promise.all([ctx.db.get(organizationId), ctx.db.get(auditEntryId)]),
    );
    expect(organization?._id).toBe(organizationId);
    expect(auditEntry?.entityId).toBe("missing-historical-collection");
  });

  test("purging a library removes its environmental devices, probes and alert episodes", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createAdminOrganization(
      t,
      "Cleanup Environment Org",
    );
    await t.run(async (ctx) => {
      await ctx.db.patch(organizationId, { type: "library" });
      const locationId = await ctx.db.insert("locations", {
        organizationId,
        name: "Reading Room",
        type: "room",
        sortOrder: 0,
        isActive: true,
      });
      const deviceId = await ctx.db.insert("environmentalDevices", {
        organizationId,
        name: "Reading room logger",
        credentialPrefix: "env_cleanup0",
        credentialHash: "0".repeat(64),
        status: "active",
        createdBy: userId,
        createdAt: 1,
      });
      const probeId = await ctx.db.insert("environmentalProbes", {
        organizationId,
        deviceId,
        probeId: "probe-1",
        locationId,
        isActive: true,
        boundBy: userId,
        boundAt: 1,
      });
      const episodeId = await ctx.db.insert("alertEpisodes", {
        organizationId,
        locationId,
        status: "open",
        startedAt: 2,
        lastObservedAt: 2,
        thresholds: { humidityMax: 55 },
        breaches: [{ measure: "humidity", direction: "above" }],
        ranges: { humidity: { min: 61, max: 61 } },
        escalationLevel: 0,
        readingCount: 1,
        outOfRangeCount: 1,
        lateReadingCount: 0,
        sources: [{ probe: probeId, lastObservedAt: 2 }],
      });
      await ctx.db.insert("environmentalReadings", {
        organizationId,
        locationId,
        humidity: 61,
        recordedAt: 2,
        source: "sensor",
        sensorDeviceId: deviceId,
        sensorProbeId: "probe-1",
        externalReadingId: "r1",
        alertTriggered: true,
        episodeId,
      });
    });
    const admin = authedForUser(t, userId);

    const [dryRun] = await admin.mutation(
      api.organizationCleanup.purgeOrganizations,
      { organizationIds: [organizationId], dryRun: true },
    );
    await t.mutation(internal.organizationCleanup.purgeOrganizationsInternal, {
      organizationIds: [organizationId],
      dryRun: false,
    });
    const remaining = await t.run(async (ctx) => ({
      environmentalDevices: (
        await ctx.db.query("environmentalDevices").collect()
      ).length,
      environmentalProbes: (await ctx.db.query("environmentalProbes").collect())
        .length,
      alertEpisodes: (await ctx.db.query("alertEpisodes").collect()).length,
      environmentalReadings: (
        await ctx.db.query("environmentalReadings").collect()
      ).length,
    }));

    expect(dryRun?.tableCounts).toEqual(
      expect.arrayContaining([
        { table: "environmentalDevices", count: 1 },
        { table: "environmentalProbes", count: 1 },
        { table: "alertEpisodes", count: 1 },
        { table: "environmentalReadings", count: 1 },
      ]),
    );
    expect(remaining).toEqual({
      environmentalDevices: 0,
      environmentalProbes: 0,
      alertEpisodes: 0,
      environmentalReadings: 0,
    });
  });

  test("purging a library removes its search backfill state and bulk field edits", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, userId } = await createAdminOrganization(
      t,
      "Cleanup Bulk Edit Org",
    );
    await t.run(async (ctx) => {
      await ctx.db.patch(organizationId, { type: "library" });
      await ctx.db.insert("objectSearchBackfills", {
        organizationId,
        version: 1,
        startedAt: 1,
        completedAt: 2,
      });
      await ctx.db.insert("bulkFieldEdits", {
        organizationId,
        requestedBy: userId,
        status: "completed",
        scope: { kind: "filters", filters: { search: "vase" } },
        edit: { field: "culture", operation: "set", value: "Roman" },
        cursor: null,
        position: 0,
        checkpoint: 1,
        attempts: 0,
        checked: 0,
        changed: 0,
        skipped: 0,
        startedAt: 1,
        updatedAt: 2,
        finishedAt: 2,
      });
    });

    await t.mutation(internal.organizationCleanup.purgeOrganizationsInternal, {
      organizationIds: [organizationId],
      dryRun: false,
    });
    const remaining = await t.run(async (ctx) => ({
      objectSearchBackfills: (
        await ctx.db.query("objectSearchBackfills").collect()
      ).length,
      bulkFieldEdits: (await ctx.db.query("bulkFieldEdits").collect()).length,
    }));

    expect(remaining).toEqual({ objectSearchBackfills: 0, bulkFieldEdits: 0 });
  });

  test("purging a library removes its export jobs, projection data and metric aggregate entries", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    const { organizationId, roleId, userId } = await createAdminOrganization(
      t,
      "Cleanup Derived Data Org",
    );
    await t.run(async (ctx) => {
      await ctx.db.patch(organizationId, { type: "library" });
      const permissionId = await ctx.db.insert("permissions", {
        name: "collections.read",
        category: "collections",
      });
      await ctx.db.insert("rolePermissions", { roleId, permissionId });
      await ctx.db.insert("auditLog", {
        organizationId,
        userId,
        action: "scheduled_organization_deletion",
        entityType: "organization",
        entityId: organizationId,
        timestamp: 100,
      });
    });
    const admin = authedForUser(t, userId);
    const jobId = await admin.mutation(api.exports.create, {
      organizationId,
      requestKey: "purge-derived",
      format: "jsonl",
      source: { kind: "objects", mode: "filtered", filters: {} },
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    await rebuildProjection(t, organizationId);
    const namespaces = await t.run(async (ctx) => {
      const generations = await ctx.db
        .query("projectionGenerations")
        .withIndex("by_organizationId_and_startedAt", (q) =>
          q.eq("organizationId", organizationId),
        )
        .take(10);
      const found = new Set<string>();
      for (const generation of generations) {
        const contributions = await ctx.db
          .query("projectionContributions")
          .withIndex("by_generationId", (q) =>
            q.eq("generationId", generation._id),
          )
          .take(100);
        for (const contribution of contributions)
          for (const entry of datedEntries(
            generation,
            contribution.sourceTable,
            contribution.sourceId,
            contribution.facts,
          ).values())
            found.add(entry.namespace);
      }
      return [...found];
    });
    expect(namespaces.length).toBeGreaterThan(0);
    const dryRun = await admin.mutation(
      api.organizationCleanup.purgeOrganizations,
      { organizationIds: [organizationId], dryRun: true },
    );
    const countedTables = dryRun[0]!.tableCounts.map((entry) => entry.table);
    expect(countedTables).toEqual(
      expect.arrayContaining([
        "exportJobs",
        "organizationProjectionStates",
        "projectionGenerations",
        "projectionContributions",
        "projectionTotals",
      ]),
    );

    await t.mutation(internal.organizationCleanup.purgeOrganizationsInternal, {
      organizationIds: [organizationId],
      dryRun: false,
    });

    const remaining = await t.run(async (ctx) => {
      const counts: Record<string, number> = {
        exportJobs: (
          await ctx.db
            .query("exportJobs")
            .withIndex("by_organizationId", (q) =>
              q.eq("organizationId", organizationId),
            )
            .take(1)
        ).length,
        exportChunks: (
          await ctx.db
            .query("exportChunks")
            .withIndex("by_jobId_and_sequence", (q) => q.eq("jobId", jobId))
            .take(1)
        ).length,
        organizationProjectionStates: (
          await ctx.db
            .query("organizationProjectionStates")
            .withIndex("by_organizationId", (q) =>
              q.eq("organizationId", organizationId),
            )
            .take(1)
        ).length,
        projectionGenerations: (
          await ctx.db
            .query("projectionGenerations")
            .withIndex("by_organizationId_and_startedAt", (q) =>
              q.eq("organizationId", organizationId),
            )
            .take(1)
        ).length,
        projectionContributions: (
          await ctx.db.query("projectionContributions").take(1)
        ).length,
        projectionTotals: (await ctx.db.query("projectionTotals").take(1))
          .length,
      };
      for (const namespace of namespaces)
        counts[namespace] = await metricTree.count(ctx, {
          namespace,
          bounds: {},
        });
      return counts;
    });
    expect(Object.values(remaining).every((count) => count === 0)).toBe(true);
    vi.useRealTimers();
  });
});
