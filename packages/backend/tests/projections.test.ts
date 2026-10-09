import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { metricTree } from "../convex/utils/projectionStore";
import {
  authedForUser,
  type ConvexTest,
  createConvexTest,
  createOrgUserWithPermissions,
  expectReady,
  rebuildProjection,
} from "./testHarness";

const ADMIN_PERMISSIONS = [
  "organization.manage_settings",
  "organization.view_analytics",
  "collections.create",
  "collections.read",
  "collections.update",
  "collections.delete",
  "loans.create",
  "loans.read",
  "loans.update",
  "loans.approve",
  "media.upload",
  "media.read",
  "media.delete",
];

async function fixture(permissions: string[] = ADMIN_PERMISSIONS) {
  const t = createConvexTest();
  const setup = await createOrgUserWithPermissions(t, permissions, {
    organizationName: "Projection Museum",
    slugPrefix: "projection-museum",
    subscriptionTier: "enterprise",
  });
  const staff = authedForUser(t, setup.userId);
  const settle = () => t.finishAllScheduledFunctions(vi.runAllTimers);
  return { t, staff, settle, ...setup };
}

async function insertObjects(
  t: ConvexTest,
  organizationId: Id<"organizations">,
  userId: Id<"users">,
  count: number,
  prefix = "OBJ",
) {
  return await t.run(async (ctx) => {
    const ids: Id<"collections">[] = [];
    for (let index = 0; index < count; index++) {
      ids.push(
        await ctx.db.insert("collections", {
          organizationId,
          accessionNumber: `${prefix}-${index}`,
          title: `${prefix} ${index}`,
          status: "active",
          catalogedBy: userId,
          catalogedAt: 1_000 + index,
        }),
      );
    }
    return ids;
  });
}

async function reconcile(
  staff: ReturnType<typeof authedForUser>,
  settle: () => Promise<void>,
  organizationId: Id<"organizations">,
) {
  const generationId = await staff.mutation(api.projections.startReconcile, {
    organizationId,
  });
  await settle();
  const health = await staff.query(api.projections.getHealth, {
    organizationId,
  });
  const discrepancies = await staff.query(api.projections.listDiscrepancies, {
    organizationId,
    generationId,
    paginationOpts: { numItems: 50, cursor: null },
  });
  return { generationId, health, discrepancies: discrepancies.page };
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
      definitionVersion: 2,
      stateDefinitionVersion: null,
      active: null,
    });

    await staff.mutation(api.projections.startRebuild, { organizationId });
    expect(
      await staff.query(api.projections.getHealth, { organizationId }),
    ).toMatchObject({
      availability: "unavailable",
      reason: "building",
      building: { status: "building", mode: "rebuild", checkpoint: 0 },
    });
    await expect(
      staff.mutation(api.projections.startRebuild, { organizationId }),
    ).rejects.toThrow("already running");

    await settle();
    expect(
      await staff.query(api.projections.getHealth, { organizationId }),
    ).toMatchObject({
      availability: "ready",
      stateDefinitionVersion: 2,
      active: { status: "completed", processedRows: 1 },
      building: null,
    });
  });

  test("dashboard, report and usage readers are unavailable before the first build instead of reporting zeros", async () => {
    const { staff, organizationId } = await fixture();
    const unavailable = {
      availability: "unavailable",
      reason: "not_built",
      definitionVersion: 2,
    };

    expect(
      await staff.query(api.dashboard.getAnalytics, { organizationId }),
    ).toEqual(unavailable);
    expect(
      await staff.query(api.media.getStorageStats, { organizationId }),
    ).toEqual(unavailable);
    expect(
      await staff.query(api.organizations.getUsageStats, { organizationId }),
    ).toMatchObject({
      metrics: unavailable,
      storage: { used: null },
      objects: { used: null },
    });
  });

  test("cancelling a rebuild stops it, keeps readers unavailable and ignores its pending continuation", async () => {
    const { t, staff, settle, organizationId, userId } = await fixture();
    await insertObjects(t, organizationId, userId, 3);
    const generationId = await staff.mutation(api.projections.startRebuild, {
      organizationId,
    });

    await staff.mutation(api.projections.cancelRebuild, {
      organizationId,
      generationId,
    });
    await settle();

    const health = await staff.query(api.projections.getHealth, {
      organizationId,
    });
    expect(health).toMatchObject({
      availability: "unavailable",
      reason: "not_built",
      building: null,
      active: null,
    });
    expect(health.recentGenerations[0]).toMatchObject({
      _id: generationId,
      status: "cancelled",
      checkpoint: 0,
      processedRows: 0,
      failure: "Cancelled by an administrator",
    });
    await expect(
      staff.mutation(api.projections.cancelRebuild, {
        organizationId,
        generationId,
      }),
    ).rejects.toThrow("Only a running or failed projection job");
  });
});

describe("checkpointed rebuild", () => {
  test("a replayed or stale continuation is a no-op and a failed page resumes from its checkpoint without double counting", async () => {
    const { t, staff, settle, organizationId, userId } = await fixture();
    await insertObjects(t, organizationId, userId, 30);
    const generationId = await staff.mutation(api.projections.startRebuild, {
      organizationId,
    });

    const first = await t.mutation(internal.projections.applyGenerationPage, {
      generationId,
      expectedCheckpoint: 0,
    });
    const replay = await t.mutation(internal.projections.applyGenerationPage, {
      generationId,
      expectedCheckpoint: 0,
    });
    expect([first, replay]).toEqual(["continue", "noop"]);

    await t.mutation(internal.projections.markGenerationPageFailed, {
      generationId,
      expectedCheckpoint: 1,
      failure: "Simulated page failure",
    });
    const failed = await staff.query(api.projections.getHealth, {
      organizationId,
    });
    expect(failed).toMatchObject({
      availability: "unavailable",
      reason: "rebuild_failed",
      building: {
        status: "failed",
        checkpoint: 1,
        failure: "Simulated page failure",
      },
    });
    expect(
      await t.mutation(internal.projections.applyGenerationPage, {
        generationId,
        expectedCheckpoint: 1,
      }),
    ).toBe("noop");

    await staff.mutation(api.projections.retryRebuild, {
      organizationId,
      generationId,
    });
    await settle();

    const health = await staff.query(api.projections.getHealth, {
      organizationId,
    });
    expect(health).toMatchObject({
      availability: "ready",
      active: { _id: generationId, attempts: 2, processedRows: 31 },
    });
    expect(
      expectReady(
        await staff.query(api.dashboard.getAnalytics, { organizationId }),
      ).objects,
    ).toMatchObject({ total: 30, active: 30 });
    await expect(
      staff.mutation(api.projections.retryRebuild, {
        organizationId,
        generationId,
      }),
    ).rejects.toThrow("Only the current failed projection job");
  });

  test("a page retried with fewer rows commits only those rows and the rebuild still converges", async () => {
    const { t, staff, settle, organizationId, userId } = await fixture();
    await insertObjects(t, organizationId, userId, 30);
    const generationId = await staff.mutation(api.projections.startRebuild, {
      organizationId,
    });

    // Drive the whole scan with three-row pages, as a retried page would.
    let checkpoint = 0;
    while (
      (await t.mutation(internal.projections.applyGenerationPage, {
        generationId,
        expectedCheckpoint: checkpoint,
        pageSize: 3,
      })) === "continue"
    ) {
      checkpoint += 1;
    }
    const health = await staff.query(api.projections.getHealth, {
      organizationId,
    });
    expect(health.active).toMatchObject({ _id: generationId, maxPageRows: 3 });

    await settle();
    expect(
      expectReady(
        await staff.query(api.dashboard.getAnalytics, { organizationId }),
      ).objects,
    ).toMatchObject({ total: 30, active: 30 });
  });

  test("an operator resumes a failed rebuild from its checkpoint when the start command would refuse", async () => {
    const { t, staff, settle, organizationId, userId } = await fixture();
    await insertObjects(t, organizationId, userId, 30);
    const generationId = await staff.mutation(api.projections.startRebuild, {
      organizationId,
    });
    await t.mutation(internal.projections.applyGenerationPage, {
      generationId,
      expectedCheckpoint: 0,
    });
    await t.mutation(internal.projections.markGenerationPageFailed, {
      generationId,
      expectedCheckpoint: 1,
      failure: "Simulated page failure",
    });

    expect(
      await t.mutation(internal.projections.startRebuildForOrganization, {
        organizationId,
      }),
    ).toBeNull();
    expect(
      await t.mutation(internal.projections.retryFailedForOrganization, {
        organizationId,
      }),
    ).toBe(generationId);
    await settle();

    expect(
      await staff.query(api.projections.getHealth, { organizationId }),
    ).toMatchObject({
      availability: "ready",
      active: { _id: generationId, attempts: 2 },
    });
    expect(
      await t.mutation(internal.projections.retryFailedForOrganization, {
        organizationId,
      }),
    ).toBeNull();
  });

  test("public writes before and after the scan cursor converge to the source-derived totals", async () => {
    const { t, staff, settle, organizationId, userId } = await fixture();
    const ids = await insertObjects(t, organizationId, userId, 30);
    const generationId = await staff.mutation(api.projections.startRebuild, {
      organizationId,
    });

    const health = () =>
      staff.query(api.projections.getHealth, { organizationId });
    let current = await health();
    while (current.building?.step !== "collections") {
      await t.mutation(internal.projections.applyGenerationPage, {
        generationId,
        expectedCheckpoint: current.building?.checkpoint ?? -1,
      });
      current = await health();
    }
    await t.mutation(internal.projections.applyGenerationPage, {
      generationId,
      expectedCheckpoint: current.building.checkpoint,
    });
    expect((await health()).building).toMatchObject({
      step: "collections",
      processedRows: 25,
    });

    const [beforeCursor, afterCursor] = [ids[0], ids[28]];
    if (!beforeCursor || !afterCursor) throw new Error("fixture missing");
    await staff.mutation(api.collections.archiveCollection, {
      collectionId: beforeCursor,
      reason: "Scanned before the write",
    });
    await staff.mutation(api.collections.archiveCollection, {
      collectionId: afterCursor,
      reason: "Scanned after the write",
    });
    await staff.mutation(api.collections.create, {
      organizationId,
      accessionNumber: "NEW-1",
      title: "Created during rebuild",
    });
    expect(
      await staff.query(api.dashboard.getAnalytics, { organizationId }),
    ).toEqual({
      availability: "unavailable",
      reason: "building",
      definitionVersion: 2,
    });

    await settle();
    expect(
      expectReady(
        await staff.query(api.dashboard.getAnalytics, { organizationId }),
      ).objects,
    ).toMatchObject({ total: 31, active: 29 });

    const { health: reconciled } = await reconcile(
      staff,
      settle,
      organizationId,
    );
    expect(reconciled.lastReconciliation).toMatchObject({
      status: "completed",
      mismatchCount: 0,
    });
  });
});

describe("writer parity", () => {
  test("catalog create, update, archive and restore keep metrics current and match a source-derived reconciliation", async () => {
    const { staff, settle, organizationId, t } = await fixture();
    await rebuildProjection(t, organizationId);

    const vaseId = await staff.mutation(api.collections.create, {
      organizationId,
      accessionNumber: "W-1",
      title: "Vase",
    });
    await staff.mutation(api.collections.create, {
      organizationId,
      accessionNumber: "W-2",
      title: "Bowl",
    });
    await staff.mutation(api.collections.update, {
      collectionId: vaseId,
      condition: "Poor",
    });
    await staff.mutation(api.collections.archiveCollection, {
      collectionId: vaseId,
      reason: "Stored",
    });

    const archived = expectReady(
      await staff.query(api.dashboard.getAnalytics, { organizationId }),
    );
    expect(archived.objects).toMatchObject({ total: 2, active: 1 });

    await staff.mutation(api.collections.restoreCollection, {
      collectionId: vaseId,
    });
    expect(
      expectReady(
        await staff.query(api.dashboard.getAnalytics, { organizationId }),
      ).objects,
    ).toMatchObject({ total: 2, active: 2 });
    expect(
      await staff.query(api.organizations.getUsageStats, { organizationId }),
    ).toMatchObject({
      metrics: { availability: "ready" },
      objects: { used: 2 },
    });

    const { health } = await reconcile(staff, settle, organizationId);
    expect(health.lastReconciliation).toMatchObject({ mismatchCount: 0 });
  });

  test("loan association changes reclassify inventory without a rebuild", async () => {
    const { staff, settle, organizationId, t } = await fixture();
    await rebuildProjection(t, organizationId);

    await staff.mutation(api.collections.create, {
      organizationId,
      accessionNumber: "OWN-1",
      title: "Owned vase",
    });
    const borrowedId = await staff.mutation(api.collections.create, {
      organizationId,
      accessionNumber: "IN-1",
      title: "Borrowed bowl",
    });
    const loanId = await staff.mutation(api.loans.create, {
      organizationId,
      loanNumber: "L-IN-1",
      type: "incoming",
      lenderBorrowerName: "Lender",
      startDate: 1_000,
      collectionIds: [borrowedId],
    });

    expect(
      await staff.query(api.dashboard.getAnalytics, { organizationId }),
    ).toMatchObject({
      availability: "ready",
      objects: { total: 1, active: 1, incomingLoanExcluded: 1 },
      loans: { total: 1, pending: 1, incoming: 1, outgoing: 0 },
    });

    const [item] = await t.run((ctx) =>
      ctx.db
        .query("loanItems")
        .withIndex("by_loan", (q) => q.eq("loanId", loanId))
        .take(1),
    );
    if (!item) throw new Error("loan item missing");
    await staff.mutation(api.loans.removeItems, {
      loanId,
      loanItemIds: [item._id],
    });

    expect(
      await staff.query(api.dashboard.getAnalytics, { organizationId }),
    ).toMatchObject({
      objects: { total: 2, incomingLoanExcluded: 0 },
    });
    const { health } = await reconcile(staff, settle, organizationId);
    expect(health.lastReconciliation).toMatchObject({ mismatchCount: 0 });
  });

  test("media uploads update storage usage exactly once per file", async () => {
    const { staff, settle, organizationId, userId, t } = await fixture();
    await rebuildProjection(t, organizationId);
    const collectionId = await staff.mutation(api.collections.create, {
      organizationId,
      accessionNumber: "M-1",
      title: "Photographed object",
    });
    const upload = (contents: string) =>
      t.run(async (ctx) => {
        const id = await ctx.storage.store(new Blob([contents]));
        await ctx.db.insert("storageOwnership", {
          storageId: id,
          uploadedBy: userId,
          organizationId,
          uploadedAt: 1_000,
        });
        return id;
      });

    await staff.mutation(api.media.create, {
      organizationId,
      collectionId,
      storageId: await upload("0123456789"),
      fileName: "report.pdf",
      fileSize: 10,
      mimeType: "application/pdf",
    });
    expect(
      await staff.query(api.media.getStorageStats, { organizationId }),
    ).toMatchObject({
      availability: "ready",
      totalFiles: 1,
      totalSize: 10,
      byType: [{ count: 1, size: 10 }],
    });

    await staff.mutation(api.media.create, {
      organizationId,
      collectionId,
      storageId: await upload("01234"),
      fileName: "notes.pdf",
      fileSize: 5,
      mimeType: "application/pdf",
    });
    expect(
      await staff.query(api.media.getStorageStats, { organizationId }),
    ).toMatchObject({
      totalFiles: 2,
      totalSize: 15,
      byType: [{ count: 2, size: 15 }],
    });
    expect(
      await staff.query(api.organizations.getUsageStats, { organizationId }),
    ).toMatchObject({ storage: { used: 15 }, objects: { used: 1 } });

    const { health } = await reconcile(staff, settle, organizationId);
    expect(health.lastReconciliation).toMatchObject({ mismatchCount: 0 });
  });
});

describe("failed writes", () => {
  test("a write that fails after inserting its source row rolls back the source and its projection contribution together", async () => {
    const { staff, settle, organizationId, userId, t } = await fixture();
    const [objectId] = await insertObjects(t, organizationId, userId, 1);
    if (!objectId) throw new Error("fixture missing");
    await rebuildProjection(t, organizationId);

    await expect(
      staff.mutation(api.loans.create, {
        organizationId,
        loanNumber: "L-FAIL-1",
        type: "outgoing",
        lenderBorrowerName: "Borrower",
        startDate: 1_000,
        collectionIds: [objectId, objectId],
      }),
    ).rejects.toThrow("Duplicate collection in loan items");

    const loans = await t.run(
      async (ctx) =>
        await ctx.db
          .query("loans")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organizationId),
          )
          .collect(),
    );
    expect(loans).toEqual([]);
    expect(
      expectReady(
        await staff.query(api.dashboard.getAnalytics, { organizationId }),
      ).loans,
    ).toMatchObject({ total: 0 });
    const { health, discrepancies } = await reconcile(
      staff,
      settle,
      organizationId,
    );
    expect(health.lastReconciliation).toMatchObject({ mismatchCount: 0 });
    expect(discrepancies).toEqual([]);
  });
});

describe("wide fan-out", () => {
  test("loan status changes wider than the fan-out limit keep readers serving, flagged as updating, and converge without a rebuild", async () => {
    const { staff, settle, organizationId, userId, t } = await fixture();
    const objectIds = await insertObjects(t, organizationId, userId, 101);
    const loanId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("loans", {
        organizationId,
        loanNumber: "WIDE-1",
        type: "outgoing",
        status: "pending",
        lenderBorrowerName: "Partner",
        startDate: 1_000,
      });
      for (const collectionId of objectIds) {
        await ctx.db.insert("loanItems", { loanId: id, collectionId });
      }
      return id;
    });
    await rebuildProjection(t, organizationId);
    const before = await staff.query(api.projections.getHealth, {
      organizationId,
    });
    expect(before).toMatchObject({ availability: "ready", updating: false });

    await staff.mutation(api.loans.approve, { loanId });
    const updating = await staff.query(api.projections.getHealth, {
      organizationId,
    });
    expect(updating).toMatchObject({
      availability: "ready",
      updating: true,
      revision: before.revision,
      active: { _id: before.active?._id },
      building: null,
    });
    const served = expectReady(
      await staff.query(api.dashboard.getAnalytics, { organizationId }),
    );
    expect(served.updating).toBe(true);
    expect(served.loans).toMatchObject({ total: 1, pending: 0, active: 1 });

    await settle();
    const settled = await staff.query(api.projections.getHealth, {
      organizationId,
    });
    expect(settled).toMatchObject({
      availability: "ready",
      updating: false,
      active: { _id: before.active?._id },
    });
    expect(
      expectReady(
        await staff.query(api.dashboard.getAnalytics, { organizationId }),
      ).updating,
    ).toBe(false);
    expect(settled.recentGenerations).toHaveLength(
      before.recentGenerations.length,
    );
    const { health } = await reconcile(staff, settle, organizationId);
    expect(health.lastReconciliation).toMatchObject({
      status: "completed",
      mismatchCount: 0,
    });
  });

  test("moving a location with more than the fan-out limit of objects to another site converges without blanking metrics", async () => {
    const { staff, settle, organizationId, userId, t } = await fixture([
      ...ADMIN_PERMISSIONS,
      "locations.update",
    ]);
    const { locationId, mainSiteId, otherSiteId } = await t.run(async (ctx) => {
      const siteId = await ctx.db.insert("sites", {
        organizationId,
        name: "Main",
        isActive: true,
        isPrimary: true,
      });
      const otherSiteId = await ctx.db.insert("sites", {
        organizationId,
        name: "Annex",
        isActive: true,
        isPrimary: false,
      });
      const locationId = await ctx.db.insert("locations", {
        organizationId,
        siteId,
        name: "Store",
        type: "room",
        sortOrder: 0,
        isActive: true,
      });
      return { locationId, mainSiteId: siteId, otherSiteId };
    });
    const objectIds = await insertObjects(t, organizationId, userId, 101);
    await t.run(async (ctx) => {
      for (const id of objectIds)
        await ctx.db.patch(id, { currentLocationId: locationId });
    });
    await rebuildProjection(t, organizationId);
    const before = await staff.query(api.projections.getHealth, {
      organizationId,
    });
    await staff.mutation(api.locations.update, {
      locationId,
      siteId: otherSiteId,
    });
    expect(
      await staff.query(api.projections.getHealth, { organizationId }),
    ).toMatchObject({ availability: "ready", updating: true, building: null });
    await staff.mutation(api.locations.update, {
      locationId,
      siteId: mainSiteId,
    });
    await staff.mutation(api.locations.update, {
      locationId,
      siteId: otherSiteId,
    });
    expect(
      await staff.query(api.projections.getHealth, { organizationId }),
    ).toMatchObject({
      availability: "ready",
      updating: true,
      revision: before.revision,
      building: null,
    });
    await settle();
    expect(
      await staff.query(api.projections.getHealth, { organizationId }),
    ).toMatchObject({ availability: "ready", updating: false });
    const { health } = await reconcile(staff, settle, organizationId);
    expect(health.lastReconciliation).toMatchObject({ mismatchCount: 0 });
  });
});

describe("metric aggregate storage", () => {
  test("repeated rebuilds reuse metric aggregate namespaces instead of accumulating them", async () => {
    const { settle, organizationId, userId, t } = await fixture();
    await insertObjects(t, organizationId, userId, 3);
    await t.run(async (ctx) => {
      await ctx.db.insert("loans", {
        organizationId,
        loanNumber: "NS-1",
        type: "outgoing",
        status: "active",
        lenderBorrowerName: "Partner",
        startDate: 1_000,
      });
    });
    const namespaceCount = () =>
      t.run(async (ctx) => {
        let count = 0;
        for await (const _ of metricTree.iterNamespaces(ctx)) count += 1;
        return count;
      });
    await rebuildProjection(t, organizationId);
    const afterFirst = await namespaceCount();
    expect(afterFirst).toBeGreaterThan(0);
    for (let rebuild = 0; rebuild < 3; rebuild++) {
      await t.mutation(internal.projections.startRebuildForOrganization, {
        organizationId,
      });
      await settle();
    }
    expect(await namespaceCount()).toBeLessThanOrEqual(afterFirst * 2);
    await t.mutation(internal.projections.startRebuildForOrganization, {
      organizationId,
    });
    await settle();
    expect(await namespaceCount()).toBeLessThanOrEqual(afterFirst * 2);
  });
});

describe("reconciliation", () => {
  test("reconcile records categorized discrepancies without repairing source or the published projection", async () => {
    const { staff, settle, organizationId, userId, t } = await fixture();
    const [patchedId] = await insertObjects(t, organizationId, userId, 2);
    if (!patchedId) throw new Error("fixture missing");
    await rebuildProjection(t, organizationId);

    const insertedId = await t.run(async (ctx) => {
      await ctx.db.patch(patchedId, { status: "archived" });
      return await ctx.db.insert("collections", {
        organizationId,
        accessionNumber: "RESTORED-1",
        title: "Imported outside the app",
        status: "active",
        catalogedBy: userId,
        catalogedAt: 9_000,
      });
    });

    const { health, discrepancies } = await reconcile(
      staff,
      settle,
      organizationId,
    );
    expect(health).toMatchObject({
      availability: "ready",
      lastReconciliation: { status: "completed", mode: "reconcile" },
    });
    expect(
      discrepancies
        .flatMap((row) =>
          row.sourceTable === "collections"
            ? [[row.category, row.sourceId]]
            : [],
        )
        .sort(),
    ).toEqual(
      [
        ["contribution_mismatch", patchedId],
        ["missing_from_projection", insertedId],
      ].sort(),
    );
    expect(
      discrepancies.find(
        (row) =>
          row.category === "counter_mismatch" &&
          row.metric === "inventory.owned" &&
          row.scope === "all",
      ),
    ).toMatchObject({ expected: 3, actual: 2 });

    const sourceRows = await t.run(async (ctx) => {
      const patched = await ctx.db.get(patchedId);
      const inserted = await ctx.db.get(insertedId);
      return [patched?.status, inserted?.status];
    });
    expect(sourceRows).toEqual(["archived", "active"]);
    expect(
      expectReady(
        await staff.query(api.dashboard.getAnalytics, { organizationId }),
      ).objects,
    ).toMatchObject({ total: 2, active: 2 });

    await staff.mutation(api.projections.startRebuild, { organizationId });
    await settle();
    expect(
      expectReady(
        await staff.query(api.dashboard.getAnalytics, { organizationId }),
      ).objects,
    ).toMatchObject({ total: 3, active: 2 });
  });

  test("reconcile requires a ready projection", async () => {
    const { staff, organizationId } = await fixture();
    await expect(
      staff.mutation(api.projections.startReconcile, { organizationId }),
    ).rejects.toThrow("Reconciliation needs a ready projection");
  });
});

describe("authorization", () => {
  test("anonymous callers and members without organization.manage_settings cannot read health or control jobs", async () => {
    const { t, organizationId } = await fixture();
    const viewerId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { name: "Viewer" });
      const roleId = await ctx.db.insert("roles", {
        organizationId,
        name: "Viewer",
        isSystemRole: false,
      });
      const permissionId = await ctx.db.insert("permissions", {
        name: "organization.view_analytics",
        category: "organization",
      });
      await ctx.db.insert("rolePermissions", { roleId, permissionId });
      await ctx.db.insert("userOrganizations", {
        organizationId,
        userId,
        roleId,
        joinedAt: 1,
      });
      return userId;
    });

    for (const caller of [t, authedForUser(t, viewerId)]) {
      await expect(
        caller.query(api.projections.getHealth, { organizationId }),
      ).rejects.toThrow();
      await expect(
        caller.mutation(api.projections.startRebuild, { organizationId }),
      ).rejects.toThrow();
      await expect(
        caller.mutation(api.projections.startReconcile, { organizationId }),
      ).rejects.toThrow();
    }
    const states = await t.run((ctx) =>
      ctx.db.query("organizationProjectionStates").take(5),
    );
    expect(states).toEqual([]);
  });

  test("an administrator of another organization cannot read or control this organization's jobs, even with its IDs", async () => {
    const { t, staff, organizationId } = await fixture();
    const other = await createOrgUserWithPermissions(
      t,
      ["organization.manage_settings"],
      { subscriptionTier: "enterprise", slugPrefix: "other-museum" },
    );
    const otherAdmin = authedForUser(t, other.userId);
    const generationId = await staff.mutation(api.projections.startRebuild, {
      organizationId,
    });

    await expect(
      otherAdmin.query(api.projections.getHealth, { organizationId }),
    ).rejects.toThrow();
    await expect(
      otherAdmin.mutation(api.projections.cancelRebuild, {
        organizationId,
        generationId,
      }),
    ).rejects.toThrow();
    for (const call of [
      otherAdmin.mutation(api.projections.cancelRebuild, {
        organizationId: other.organizationId,
        generationId,
      }),
      otherAdmin.mutation(api.projections.retryRebuild, {
        organizationId: other.organizationId,
        generationId,
      }),
      otherAdmin.query(api.projections.listDiscrepancies, {
        organizationId: other.organizationId,
        generationId,
        paginationOpts: { numItems: 10, cursor: null },
      }),
    ]) {
      await expect(call).rejects.toThrow("Projection job not found");
    }
    expect(
      (await staff.query(api.projections.getHealth, { organizationId }))
        .building,
    ).toMatchObject({ _id: generationId, status: "building" });
  });
});
