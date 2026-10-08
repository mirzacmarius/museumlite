import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import {
  assertBucketCount,
  atOrAfter,
  atOrBefore,
  before,
  between,
  inclusive,
  metric,
  openProjection,
  PROJECTION_MAX_BUCKETS,
  type ProjectionReader,
  type ProjectionUnavailable,
  throughStartOf,
} from "./projectionReads";

type ReadCtx = Pick<QueryCtx, "db" | "runQuery">;

const DAY_MS = 24 * 60 * 60 * 1000;
/** Breakdown rows (audit types/users, location and media types) read per report. */
export const BREAKDOWN_SCOPE_LIMIT = 100;
/** Source rows a preview list may inspect to fill its sample. */
const PREVIEW_SCAN_LIMIT = 200;
const MAX_LOCATION_DEPTH = 12;

const percentage = (part: number, whole: number) =>
  whole > 0 ? Math.round((part / whole) * 100) : 0;

async function userName(ctx: ReadCtx, id: string | undefined) {
  const userId = id ? ctx.db.normalizeId("users", id) : null;
  const user = userId ? await ctx.db.get(userId) : null;
  return user?.name ?? user?.email ?? undefined;
}

async function takeMatching<T>(
  rows: AsyncIterable<T>,
  matches: (row: T) => boolean,
  limit: number,
) {
  const found: T[] = [];
  let inspected = 0;
  for await (const row of rows) {
    if (++inspected > PREVIEW_SCAN_LIMIT) break;
    if (!matches(row)) continue;
    found.push(row);
    if (found.length === limit) break;
  }
  return found;
}

// ============================================
// Compliance
// ============================================

async function auditBreakdown(
  reader: ProjectionReader,
  category: "auditType" | "auditUser",
  rangeStart: number,
  rangeEnd: number,
) {
  const { rows, complete } = await reader.ranked(category, {
    order: "desc",
    limit: BREAKDOWN_SCOPE_LIMIT,
  });
  const counts = await reader.sumsAcross(
    "audit.timestamp",
    rows.map((row) => row.scope),
    inclusive(rangeStart, rangeEnd),
  );
  return {
    complete,
    entries: rows
      .flatMap((row, index) => {
        const count = counts[index] ?? 0;
        return count > 0 ? [{ id: row.id, count }] : [];
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
  };
}

export async function buildComplianceReport(
  ctx: ReadCtx,
  organizationId: Id<"organizations">,
  now: number,
  rangeStart: number,
  rangeEnd: number,
) {
  const opened = await openProjection(ctx, organizationId);
  if (!opened.ok) return opened.unavailable;
  const { reader } = opened;
  const inRange = (approvedAt: number | undefined) =>
    approvedAt !== undefined &&
    approvedAt >= rangeStart &&
    approvedAt <= rangeEnd;

  const [
    totals,
    pendingAccessions,
    recentAccessions,
    pendingDeaccessions,
    recentDeaccessions,
    recentAudit,
    [totalEvents = 0],
    byType,
    byUser,
  ] = await Promise.all([
    reader.totals(),
    ctx.db
      .query("accessions")
      .withIndex("by_organization_and_status_and_dateReceived", (q) =>
        q.eq("organizationId", organizationId).eq("status", "pending"),
      )
      .order("desc")
      .take(10),
    takeMatching(
      ctx.db
        .query("accessions")
        .withIndex("by_organization_and_approvedAt", (q) =>
          q
            .eq("organizationId", organizationId)
            .gte("approvedAt", rangeStart)
            .lte("approvedAt", rangeEnd),
        )
        .order("desc"),
      (row) =>
        (row.status === "approved" || row.status === "rejected") &&
        inRange(row.approvedAt),
      10,
    ),
    ctx.db
      .query("deaccessions")
      .withIndex("by_organization_and_status_and_dateDeaccessioned", (q) =>
        q.eq("organizationId", organizationId).eq("status", "pending"),
      )
      .order("desc")
      .take(10),
    takeMatching(
      ctx.db
        .query("deaccessions")
        .withIndex("by_organization_and_approvedAt", (q) =>
          q
            .eq("organizationId", organizationId)
            .gte("approvedAt", rangeStart)
            .lte("approvedAt", rangeEnd),
        )
        .order("desc"),
      (row) =>
        (row.status === "approved" || row.status === "rejected") &&
        inRange(row.approvedAt),
      10,
    ),
    ctx.db
      .query("auditLog")
      .withIndex("by_organization_and_timestamp", (q) =>
        q
          .eq("organizationId", organizationId)
          .gte("timestamp", rangeStart)
          .lte("timestamp", rangeEnd),
      )
      .order("desc")
      .take(20),
    reader.sums("audit.timestamp", [inclusive(rangeStart, rangeEnd)]),
    auditBreakdown(reader, "auditType", rangeStart, rangeEnd),
    auditBreakdown(reader, "auditUser", rangeStart, rangeEnd),
  ]);

  return {
    availability: "ready" as const,
    accessions: {
      total: metric(totals, "accessions.total"),
      pending: metric(totals, "accessions.pending"),
      approved: metric(totals, "accessions.approved"),
      rejected: metric(totals, "accessions.rejected"),
      pendingApprovals: await Promise.all(
        pendingAccessions.map(async (accession) => ({
          id: accession._id,
          accessionNumber: accession.accessionNumber,
          source: accession.source,
          dateReceived: accession.dateReceived,
          method: accession.method,
          assignedToName: await userName(ctx, accession.assignedTo),
          workflowStep: accession.workflowStep,
        })),
      ),
      recentApprovals: await Promise.all(
        recentAccessions.map(async (accession) => ({
          id: accession._id,
          accessionNumber: accession.accessionNumber,
          source: accession.source,
          approvedAt: accession.approvedAt as number,
          approvedByName:
            (await userName(ctx, accession.approvedBy)) ?? "Unknown",
          status: accession.status,
        })),
      ),
    },
    deaccessions: {
      total: metric(totals, "deaccessions.total"),
      pending: metric(totals, "deaccessions.pending"),
      approved: metric(totals, "deaccessions.approved"),
      rejected: metric(totals, "deaccessions.rejected"),
      pendingApprovals: pendingDeaccessions.map((deaccession) => ({
        id: deaccession._id,
        deaccessionNumber: deaccession.deaccessionNumber,
        reason: deaccession.reason,
        method: deaccession.method,
        dateDeaccessioned: deaccession.dateDeaccessioned,
        workflowStep: deaccession.workflowStep,
      })),
      recentApprovals: await Promise.all(
        recentDeaccessions.map(async (deaccession) => ({
          id: deaccession._id,
          deaccessionNumber: deaccession.deaccessionNumber,
          reason: deaccession.reason,
          approvedAt: deaccession.approvedAt as number,
          approvedByName:
            (await userName(ctx, deaccession.approvedBy)) ?? "Unknown",
          status: deaccession.status,
          proceedsAmount: deaccession.proceedsAmount,
        })),
      ),
    },
    auditTrail: {
      totalEvents,
      recentEvents: await Promise.all(
        recentAudit.map(async (event) => ({
          id: event._id,
          action: event.action,
          entityType: event.entityType,
          entityId: event.entityId,
          userName: (await userName(ctx, event.userId)) ?? "Unknown",
          timestamp: event.timestamp,
        })),
      ),
      eventsByType: byType.entries.map(({ id, count }) => ({
        entityType: id,
        count,
      })),
      eventsByUser: await Promise.all(
        byUser.entries.map(async ({ id, count }) => ({
          userId: id,
          userName: (await userName(ctx, id)) ?? "Unknown",
          count,
        })),
      ),
      breakdownsComplete: byType.complete && byUser.complete,
    },
    generatedAt: now,
  };
}

// ============================================
// Location utilization
// ============================================

async function locationPath(ctx: ReadCtx, location: Doc<"locations">) {
  const parts = [location.name];
  let parentId = location.parentLocationId;
  for (let depth = 0; parentId && depth < MAX_LOCATION_DEPTH; depth++) {
    const parent: Doc<"locations"> | null = await ctx.db.get(parentId);
    if (!parent || parent.organizationId !== location.organizationId) break;
    parts.unshift(parent.name);
    parentId = parent.parentLocationId;
  }
  return parts.join(" > ");
}

async function describeLocation(
  ctx: ReadCtx,
  organizationId: Id<"organizations">,
  row: { id: string; counts: Record<string, number> },
) {
  const id = ctx.db.normalizeId("locations", row.id);
  const location = id ? await ctx.db.get(id) : null;
  if (!location || location.organizationId !== organizationId) return null;
  const capacity = metric(row.counts, "capacity");
  const occupied = metric(row.counts, "occupied");
  return {
    id: location._id,
    name: location.name,
    type: location.type,
    capacity,
    occupied,
    utilizationPercentage: percentage(occupied, capacity),
    path: await locationPath(ctx, location),
  };
}

export async function buildLocationUtilization(
  ctx: ReadCtx,
  organizationId: Id<"organizations">,
  now: number,
) {
  const opened = await openProjection(ctx, organizationId);
  if (!opened.ok) return opened.unavailable;
  const { reader } = opened;
  const describe = async (
    rows: Array<{ id: string; counts: Record<string, number> }>,
  ) =>
    (
      await Promise.all(
        rows.map((row) => describeLocation(ctx, organizationId, row)),
      )
    ).filter((row): row is NonNullable<typeof row> => row !== null);

  const [totals, types, top, under, full] = await Promise.all([
    reader.totals(),
    reader.ranked("locationType", {
      order: "desc",
      limit: BREAKDOWN_SCOPE_LIMIT,
    }),
    reader.ranked("location", {
      order: "desc",
      limit: 10,
      lower: 0,
      upperExclusive: 0.995,
    }),
    reader.ranked("location", {
      order: "asc",
      limit: PREVIEW_SCAN_LIMIT,
      lower: 0,
      upperExclusive: 0.495,
    }),
    reader.ranked("location", { order: "desc", limit: 10, lower: 1 }),
  ]);
  const totalCapacity = metric(totals, "locations.capacity");
  const totalOccupied = metric(totals, "locations.occupied");
  return {
    availability: "ready" as const,
    summary: {
      totalLocations: metric(totals, "locations.active"),
      locationsWithCapacity: metric(totals, "locations.withCapacity"),
      totalCapacity,
      totalOccupied,
      utilizationPercentage: percentage(totalOccupied, totalCapacity),
    },
    byType: types.rows.map((row) => ({
      type: row.id,
      count: metric(row.counts, "total"),
      withCapacity: metric(row.counts, "withCapacity"),
      totalCapacity: metric(row.counts, "capacity"),
      totalOccupied: metric(row.counts, "occupied"),
      utilizationPercentage: percentage(
        metric(row.counts, "occupied"),
        metric(row.counts, "capacity"),
      ),
    })),
    byTypeComplete: types.complete,
    topUtilized: await describe(top.rows),
    underutilized: await describe(
      under.rows
        .filter((row) => metric(row.counts, "capacity") >= 5)
        .slice(0, 10),
    ),
    atCapacity: (await describe(full.rows)).map(
      ({ utilizationPercentage: _, ...row }) => row,
    ),
    generatedAt: now,
  };
}

// ============================================
// Growth and KPI trends
// ============================================

export async function buildCollectionGrowth(
  ctx: ReadCtx,
  organizationId: Id<"organizations">,
  now: Date,
) {
  const opened = await openProjection(ctx, organizationId);
  if (!opened.ok) return opened.unavailable;
  const months = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (11 - index), 1);
    return {
      month: date.toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
      }),
      start: date.getTime(),
      end: new Date(date.getFullYear(), date.getMonth() + 1, 1).getTime(),
    };
  });
  const counts = await opened.reader.sums(
    "objects.created",
    months.map((month) => between(month.start, month.end)),
  );
  return {
    availability: "ready" as const,
    months: months.map((month, index) => ({
      month: month.month,
      count: counts[index] ?? 0,
    })),
  };
}

export async function buildKpiTrends(
  ctx: ReadCtx,
  organizationId: Id<"organizations">,
  now: number,
) {
  const opened = await openProjection(ctx, organizationId);
  if (!opened.ok) return opened.unavailable;
  const days = Array.from({ length: 7 }, (_, index) =>
    atOrBefore(now - (6 - index) * DAY_MS),
  );
  const [totalObjects, objectsOnLoan, activeLoans, pendingAccessions] =
    await Promise.all(
      [
        "objects.created",
        "objects.loaned.created",
        "loans.active.created",
        "accessions.pending.created",
      ].map((name) => opened.reader.sums(name, days)),
    );
  return {
    availability: "ready" as const,
    totalObjects: totalObjects ?? [],
    objectsOnLoan: objectsOnLoan ?? [],
    activeLoans: activeLoans ?? [],
    pendingAccessions: pendingAccessions ?? [],
  };
}

// ============================================
// Reporting trends
// ============================================

export type TrendPeriod = "daily" | "weekly" | "monthly";
export interface TrendBucket {
  start: number;
  end: number;
  label: string;
}

const MIN_PERIOD_MS: Record<TrendPeriod, number> = {
  daily: DAY_MS,
  weekly: 7 * DAY_MS,
  monthly: 28 * DAY_MS,
};

/** Rejects non-finite ranges and ranges that would exceed the bucket cap. */
export function assertTrendRange(
  startDate: number,
  endDate: number,
  period: TrendPeriod,
) {
  if (!Number.isFinite(startDate) || !Number.isFinite(endDate)) {
    throw new ConvexError("Trend range must have finite start and end dates");
  }
  if (endDate < startDate) {
    throw new ConvexError("Trend range end must not be before its start");
  }
  if (
    (endDate - startDate) / MIN_PERIOD_MS[period] >
    PROJECTION_MAX_BUCKETS + 1
  ) {
    throw new ConvexError(
      `Requested range exceeds ${PROJECTION_MAX_BUCKETS} ${period} buckets; narrow the range`,
    );
  }
}

async function bucketSums(
  reader: ProjectionReader,
  name: string,
  buckets: TrendBucket[],
) {
  return await reader.sums(
    name,
    buckets.map((bucket) => between(bucket.start, bucket.end)),
  );
}

export async function buildCollectionTrendSeries(
  reader: ProjectionReader,
  buckets: TrendBucket[],
) {
  assertBucketCount(buckets.length);
  const [accessions, deaccessions] = await Promise.all([
    bucketSums(reader, "accessions.approvedAt", buckets),
    bucketSums(reader, "deaccessions.approvedAt", buckets),
  ]);
  return buckets.map((bucket, index) => {
    const newAccessions = accessions[index] ?? 0;
    const removed = deaccessions[index] ?? 0;
    return {
      date: bucket.label,
      timestamp: bucket.start,
      totalObjects: null,
      newAccessions,
      deaccessions: removed,
      netChange: newAccessions - removed,
    };
  });
}

export async function buildLoanTrendSeries(
  reader: ProjectionReader,
  buckets: TrendBucket[],
) {
  assertBucketCount(buckets.length);
  const [newLoans, returned, active, overdue] = await Promise.all([
    bucketSums(reader, "loans.startDate", buckets),
    bucketSums(reader, "loans.returned.startDate", buckets),
    reader.sums(
      "loans.open.startDate",
      buckets.map((bucket) => atOrBefore(bucket.end)),
    ),
    reader.sums(
      "loans.open.overdueKey",
      buckets.map((bucket) => throughStartOf(bucket.end)),
    ),
  ]);
  return buckets.map((bucket, index) => ({
    date: bucket.label,
    timestamp: bucket.start,
    newLoans: newLoans[index] ?? 0,
    returnedLoans: returned[index] ?? 0,
    activeLoans: active[index] ?? 0,
    overdueLoans: overdue[index] ?? 0,
  }));
}

export async function buildConservationTrendSeries(
  reader: ProjectionReader,
  buckets: TrendBucket[],
) {
  assertBucketCount(buckets.length);
  const [performed, completed, cost] = await Promise.all([
    bucketSums(reader, "treatments.performed", buckets),
    bucketSums(reader, "treatments.completed", buckets),
    bucketSums(reader, "treatments.completedCost", buckets),
  ]);
  return buckets.map((bucket, index) => ({
    date: bucket.label,
    timestamp: bucket.start,
    newTreatments: performed[index] ?? 0,
    completedTreatments: completed[index] ?? 0,
    totalCost: cost[index] ?? 0,
    averageDuration: undefined,
  }));
}

// ============================================
// Collection health
// ============================================

export async function buildCollectionHealth(
  ctx: ReadCtx,
  organizationId: Id<"organizations">,
  now: number,
) {
  const opened = await openProjection(ctx, organizationId);
  if (!opened.ok) return opened.unavailable;
  const { reader } = opened;
  const yearStart = new Date(new Date(now).getFullYear(), 0, 1).getTime();
  const thirtyDaysFromNow = now + 30 * DAY_MS;
  const threeYearsAgo = now - 3 * 365 * DAY_MS;

  const [
    totals,
    [completedTreatmentsThisYear = 0],
    [overdueAssessments = 0],
    [expiringPolicies = 0],
    [staleAppraisals = 0],
    [overdueLoans = 0, dueSoon = 0],
    [expiringLicenses = 0],
  ] = await Promise.all([
    reader.totals(),
    reader.sums("treatments.completed", [atOrAfter(yearStart)]),
    reader.sums("assessments.due", [before(now)]),
    reader.sums("insurance.expiration", [before(thirtyDaysFromNow)]),
    reader.sums("appraisals.date", [before(threeYearsAgo)]),
    reader.sums("loans.open.endDate", [
      before(now),
      between(now, thirtyDaysFromNow),
    ]),
    reader.sums("media.licenseExpiry", [before(thirtyDaysFromNow)]),
  ]);

  const totalObjects = metric(totals, "health.objects");
  const condition = {
    good: metric(totals, "health.condition.good"),
    fair: metric(totals, "health.condition.fair"),
    poor: metric(totals, "health.condition.poor"),
    unknown: metric(totals, "health.condition.unknown"),
  };
  const objectsWithCoverage = metric(totals, "health.withCoverage");
  const objectsWithoutCoverage = totalObjects - objectsWithCoverage;
  const objectsWithLocation = metric(totals, "health.withLocation");
  const objectsWithoutLocation = totalObjects - objectsWithLocation;
  const objectsWithMedia = metric(totals, "health.withMedia");
  const objectsWithoutMedia = totalObjects - objectsWithMedia;
  const totalMediaFiles = metric(totals, "usage.mediaFileCount");
  const unknownRights = metric(totals, "media.unknownRights");
  const overCapacityLocations = metric(totals, "locations.overCapacity");
  const activeLoans = metric(totals, "loans.open");
  const totalLoans = metric(totals, "loans.total");
  const returnedLoans = metric(totals, "loans.returned");
  const returnedWithEnd = metric(totals, "loans.returned.withEnd");

  let healthScore = 100;
  const criticalIssues: string[] = [];
  const warningIssues: string[] = [];
  const recommendations: string[] = [];
  const poorConditionPercent =
    totalObjects > 0 ? (condition.poor / totalObjects) * 100 : 0;
  if (poorConditionPercent > 20) {
    healthScore -= 20;
    criticalIssues.push("High percentage of objects in poor condition");
    recommendations.push(
      "Prioritize conservation treatments for objects in poor condition",
    );
  } else if (poorConditionPercent > 10) {
    healthScore -= 10;
    warningIssues.push("Elevated number of objects in poor condition");
  }
  if (overdueAssessments > 10) {
    healthScore -= 10;
    warningIssues.push("Multiple overdue conservation assessments");
    recommendations.push("Schedule overdue conservation assessments");
  }
  if (objectsWithoutCoverage > totalObjects * 0.3) {
    healthScore -= 15;
    criticalIssues.push("Many objects lack insurance coverage");
    recommendations.push("Review insurance coverage for uncovered objects");
  }
  if (expiringPolicies > 0) {
    healthScore -= 5;
    warningIssues.push(`${expiringPolicies} insurance policies expiring soon`);
    recommendations.push("Renew expiring insurance policies");
  }
  if (staleAppraisals > totalObjects * 0.2) {
    healthScore -= 5;
    warningIssues.push("Many objects have stale appraisals");
    recommendations.push("Update appraisals older than 3 years");
  }
  if (objectsWithoutLocation > totalObjects * 0.1) {
    healthScore -= 10;
    warningIssues.push("Objects without assigned locations");
    recommendations.push("Assign locations to unlocated objects");
  }
  if (overCapacityLocations > 0) {
    healthScore -= 5;
    warningIssues.push(`${overCapacityLocations} locations are over capacity`);
    recommendations.push("Redistribute objects from over-capacity locations");
  }
  if (overdueLoans > activeLoans * 0.2 && activeLoans > 0) {
    healthScore -= 10;
    criticalIssues.push("High percentage of overdue loans");
    recommendations.push("Follow up on overdue loans");
  }
  if (objectsWithoutMedia > totalObjects * 0.5) {
    healthScore -= 5;
    warningIssues.push("Many objects lack media documentation");
    recommendations.push("Add photographs for undocumented objects");
  }
  if (unknownRights > totalMediaFiles * 0.3 && totalMediaFiles > 0) {
    healthScore -= 5;
    warningIssues.push("Many media files have unknown rights status");
    recommendations.push("Review and update media rights information");
  }

  return {
    availability: "ready" as const,
    conservation: {
      totalObjects,
      goodCondition: condition.good,
      fairCondition: condition.fair,
      poorCondition: condition.poor,
      unknownCondition: condition.unknown,
      pendingTreatments:
        metric(totals, "treatments.proposed") +
        metric(totals, "treatments.approved"),
      activeTreatments: metric(totals, "treatments.in_progress"),
      completedTreatmentsThisYear,
      overdueAssessments,
    },
    insurance: {
      totalCoveredValue: metric(totals, "insurance.coveredValue"),
      objectsWithCoverage,
      objectsWithoutCoverage,
      expiringPolicies,
      pendingClaims: metric(totals, "insurance.claims.pending"),
      staleAppraisals,
    },
    locations: {
      totalLocations: metric(totals, "locations.active"),
      objectsWithLocation,
      objectsWithoutLocation,
      atCapacityLocations: metric(totals, "locations.atCapacity"),
      overCapacityLocations,
      utilizationPercentage: percentage(
        metric(totals, "locations.occupied"),
        metric(totals, "locations.capacity"),
      ),
    },
    loans: {
      activeLoans,
      overdueLoans,
      dueSoon,
      returnRate: percentage(returnedLoans, totalLoans),
      averageLoanDuration:
        returnedWithEnd > 0
          ? Math.round(
              metric(totals, "loans.returned.durationSum") /
                returnedWithEnd /
                DAY_MS,
            )
          : 0,
    },
    media: {
      totalMediaFiles,
      objectsWithMedia,
      objectsWithoutMedia,
      unknownRights,
      expiringLicenses,
    },
    overall: {
      healthScore: Math.max(0, Math.min(100, healthScore)),
      criticalIssues: criticalIssues.length,
      warningIssues: warningIssues.length,
      recommendations,
    },
    generatedAt: now,
  };
}

// ============================================
// Media storage and organization usage
// ============================================

export async function buildStorageStats(
  ctx: ReadCtx,
  organizationId: Id<"organizations">,
  recentSince: number,
) {
  const opened = await openProjection(ctx, organizationId);
  if (!opened.ok) return opened.unavailable;
  const { reader } = opened;
  const [totals, types, [recentUploads = 0]] = await Promise.all([
    reader.totals(),
    reader.ranked("mediaType", { order: "desc", limit: BREAKDOWN_SCOPE_LIMIT }),
    reader.sums("media.uploaded", [atOrAfter(recentSince)]),
  ]);
  return {
    availability: "ready" as const,
    totalFiles: metric(totals, "usage.mediaFileCount"),
    totalSize: metric(totals, "usage.storageBytes"),
    byType: types.rows.map((row) => ({
      type: row.id,
      count: metric(row.counts, "count"),
      size: metric(row.counts, "bytes"),
    })),
    recentUploads,
  };
}

/** Projected usage, or the reason it is unavailable. */
export async function loadProjectedUsage(
  ctx: ReadCtx,
  organizationId: Id<"organizations">,
): Promise<
  | { availability: "ready"; storageBytes: number; objectCount: number }
  | ProjectionUnavailable
> {
  const opened = await openProjection(ctx, organizationId);
  if (!opened.ok) return opened.unavailable;
  const totals = await opened.reader.totals();
  return {
    availability: "ready",
    storageBytes: metric(totals, "usage.storageBytes"),
    objectCount: metric(totals, "usage.objectCount"),
  };
}
