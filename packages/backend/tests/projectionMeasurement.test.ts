import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import {
  authedForUser,
  type ConvexTest,
  createConvexTest,
  createOrgUserWithPermissions,
  expectReady,
} from "./testHarness";

const DAY = 24 * 60 * 60 * 1000;
const START = Date.UTC(2024, 0, 1);
const LARGE = process.env.PROJECTION_MEASURE === "large";

interface Profile {
  name: string;
  objects: number;
  auditEntries: number;
  locations: number;
  loans: number;
  itemsPerLoan: number;
  mediaFiles: number;
}

const SMALL: Profile = {
  name: "small",
  objects: 60,
  auditEntries: 40,
  locations: 4,
  loans: 3,
  itemsPerLoan: 4,
  mediaFiles: 10,
};

const LARGE_PROFILE: Profile = {
  name: "large",
  objects: 5_200,
  auditEntries: 1_200,
  locations: 40,
  loans: 30,
  itemsPerLoan: 10,
  mediaFiles: 400,
};

const realNow = () => vi.getRealSystemTime();
const elapsedMs = (from: number) => realNow() - from;

async function seed(
  t: ConvexTest,
  organizationId: Id<"organizations">,
  userId: Id<"users">,
  profile: Profile,
) {
  const locationIds = await t.run(async (ctx) => {
    const ids: Id<"locations">[] = [];
    for (let index = 0; index < profile.locations; index++) {
      ids.push(
        await ctx.db.insert("locations", {
          organizationId,
          name: `Store ${index}`,
          locationCode: `S-${index}`,
          type: "storage",
          sortOrder: index,
          isActive: true,
          capacity: 200,
        }),
      );
    }
    return ids;
  });
  const objectIds: Id<"collections">[] = [];
  for (let offset = 0; offset < profile.objects; offset += 500) {
    const batch = await t.run(async (ctx) => {
      const ids: Id<"collections">[] = [];
      const end = Math.min(offset + 500, profile.objects);
      for (let index = offset; index < end; index++) {
        ids.push(
          await ctx.db.insert("collections", {
            organizationId,
            accessionNumber: `M-${index}`,
            title: `Object ${index}`,
            status: index % 20 === 0 ? "archived" : "active",
            catalogedBy: userId,
            catalogedAt: START + (index % 730) * DAY,
            currentLocationId: locationIds[index % locationIds.length],
          }),
        );
      }
      return ids;
    });
    objectIds.push(...batch);
  }
  await t.run(async (ctx) => {
    for (let loan = 0; loan < profile.loans; loan++) {
      const loanId = await ctx.db.insert("loans", {
        organizationId,
        loanNumber: `L-${loan}`,
        type: "outgoing",
        status: loan % 3 === 0 ? "dispatched" : "active",
        lenderBorrowerName: `Venue ${loan}`,
        startDate: START + loan * 7 * DAY,
        endDate: START + (loan * 7 + 90) * DAY,
      });
      for (let item = 0; item < profile.itemsPerLoan; item++) {
        const objectId = objectIds[loan * profile.itemsPerLoan + item + 1];
        if (objectId) {
          await ctx.db.insert("loanItems", { loanId, collectionId: objectId });
        }
      }
    }
    const storageId = await ctx.storage.store(new Blob(["synthetic"]));
    for (let index = 0; index < profile.mediaFiles; index++) {
      const collectionId = objectIds[index];
      if (!collectionId) break;
      await ctx.db.insert("mediaFiles", {
        collectionId,
        organizationId,
        storageId,
        fileName: `m-${index}.png`,
        fileType: "image",
        fileSize: 1_000 + index,
        mimeType: "image/png",
        isPrimary: true,
        uploadedBy: userId,
        uploadedAt: START + (index % 365) * DAY,
        uploadStatus: "completed",
      });
    }
  });
  for (let offset = 0; offset < profile.auditEntries; offset += 500) {
    await t.run(async (ctx) => {
      const end = Math.min(offset + 500, profile.auditEntries);
      for (let index = offset; index < end; index++) {
        await ctx.db.insert("auditLog", {
          organizationId,
          userId,
          action: index % 2 === 0 ? "update" : "create",
          entityType: "collection",
          entityId: `synthetic-${index}`,
          timestamp: START + (index % 400) * DAY,
        });
      }
    });
  }
}

async function projectionSnapshot(
  t: ConvexTest,
  generationId: Id<"projectionGenerations">,
) {
  const rows = await t.run(async (ctx) => {
    const contributions = await ctx.db
      .query("projectionContributions")
      .withIndex("by_generationId", (q) => q.eq("generationId", generationId))
      .collect();
    const totals = await ctx.db
      .query("projectionTotals")
      .withIndex("by_generationId", (q) => q.eq("generationId", generationId))
      .collect();
    return {
      contributions: contributions.map(
        (row) =>
          [
            `${row.sourceTable}:${row.sourceId}`,
            JSON.stringify(row.facts),
          ] as const,
      ),
      totals: totals.map(
        (row) => [String(row._id), JSON.stringify(row.counts)] as const,
      ),
    };
  });
  return {
    contributions: new Map(rows.contributions),
    totals: new Map(rows.totals),
  };
}

function changedKeys(before: Map<string, string>, after: Map<string, string>) {
  const keys = new Set([...before.keys(), ...after.keys()]);
  return [...keys].filter((key) => before.get(key) !== after.get(key));
}

async function measure(profile: Profile) {
  const t = createConvexTest();
  const setup = await createOrgUserWithPermissions(
    t,
    [
      "organization.manage_settings",
      "organization.view_analytics",
      "collections.create",
      "collections.read",
      "collections.update",
      "collections.delete",
    ],
    {
      organizationName: `Measured ${profile.name}`,
      slugPrefix: `measured-${profile.name}`,
      subscriptionTier: "enterprise",
    },
  );
  const { organizationId, userId } = setup;
  const staff = authedForUser(t, userId);
  await seed(t, organizationId, userId, profile);

  const rebuildStart = realNow();
  await staff.mutation(api.projections.startRebuild, { organizationId });
  await t.finishAllScheduledFunctions(vi.runAllTimers, 20_000);
  const rebuildMs = elapsedMs(rebuildStart);

  const health = await staff.query(api.projections.getHealth, {
    organizationId,
  });
  const active = health.active;
  if (!active) throw new Error("rebuild did not publish");

  const readStart = realNow();
  const analytics = expectReady(
    await staff.query(api.dashboard.getAnalytics, { organizationId }),
  );
  const analyticsMs = elapsedMs(readStart);
  const kpiStart = realNow();
  expectReady(
    await staff.query(api.dashboard.getOperationalKpis, { organizationId }),
  );
  const kpiMs = elapsedMs(kpiStart);

  const archivedId = await t.run(async (ctx) => {
    const row = await ctx.db
      .query("collections")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .order("desc")
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();
    if (!row) throw new Error("no active object");
    return row._id;
  });
  const before = await projectionSnapshot(t, active._id);
  await staff.mutation(api.collections.archiveCollection, {
    collectionId: archivedId,
    reason: "Measured archive",
  });
  const after = await projectionSnapshot(t, active._id);
  const changedContributions = changedKeys(
    before.contributions,
    after.contributions,
  );

  const reconcileStart = realNow();
  await staff.mutation(api.projections.startReconcile, { organizationId });
  await t.finishAllScheduledFunctions(vi.runAllTimers, 20_000);
  const reconcileMs = elapsedMs(reconcileStart);
  const verified = await staff.query(api.projections.getHealth, {
    organizationId,
  });
  const reconciliationId = verified.lastReconciliation?._id;
  const discrepancyCategories = reconciliationId
    ? (
        await staff.query(api.projections.listDiscrepancies, {
          organizationId,
          generationId: reconciliationId,
          paginationOpts: { numItems: 50, cursor: null },
        })
      ).page.map((row) => `${row.category}:${row.metric ?? row.sourceTable}`)
    : [];

  const result = {
    profile: profile.name,
    sourceRows: {
      objects: profile.objects,
      auditEntries: profile.auditEntries,
      locations: profile.locations,
      loans: profile.loans,
      loanItems: profile.loans * profile.itemsPerLoan,
      mediaFiles: profile.mediaFiles,
    },
    rebuild: {
      processedRows: active.processedRows,
      checkpointPages: active.checkpoint,
      maxPageRows: active.maxPageRows,
      maxPageWrites: active.maxPageWrites,
      totalWrites: active.totalWrites,
      elapsedMs: Math.round(rebuildMs),
    },
    reads: {
      analyticsMs: Math.round(analyticsMs),
      operationalKpisMs: Math.round(kpiMs),
    },
    singleArchiveAmplification: {
      contributionRowsChanged: changedContributions.length,
      contributionSources: changedContributions
        .map((key) => key.split(":")[0])
        .sort(),
      totalRowsChanged: changedKeys(before.totals, after.totals).length,
    },
    reconcile: {
      elapsedMs: Math.round(reconcileMs),
      discrepancies: verified.lastReconciliation?.discrepancyCount ?? null,
      mismatches: verified.lastReconciliation?.mismatchCount ?? null,
      categories: discrepancyCategories,
    },
  };
  console.info(`[projection-measurement] ${JSON.stringify(result)}`);
  return { result, analytics, health };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("synthetic institution measurement", () => {
  test("a small institution rebuilds in bounded pages and reconciles cleanly", async () => {
    const { result, analytics } = await measure(SMALL);
    expect(analytics.objects).toMatchObject({ total: SMALL.objects });
    expect(result.rebuild).toMatchObject({
      processedRows: 130,
      checkpointPages: 28,
      maxPageRows: 25,
    });
    expect(result.singleArchiveAmplification).toMatchObject({
      contributionRowsChanged: 2,
      contributionSources: ["auditLog", "collections"],
      totalRowsChanged: 4,
    });
    expect(result.reconcile).toMatchObject({
      discrepancies: 0,
      mismatches: 0,
    });
  });

  test.runIf(LARGE)(
    "a large institution (>5,000 objects, >1,000 audit entries) rebuilds in bounded pages and reconciles cleanly",
    async () => {
      const { result, analytics } = await measure(LARGE_PROFILE);
      expect(analytics.objects).toMatchObject({
        total: LARGE_PROFILE.objects,
      });
      expect(result.rebuild.maxPageRows).toBeLessThanOrEqual(25);
      expect(result.singleArchiveAmplification.contributionRowsChanged).toBe(2);
      expect(result.reconcile).toMatchObject({
        discrepancies: 0,
        mismatches: 0,
      });
    },
    1_800_000,
  );
});
