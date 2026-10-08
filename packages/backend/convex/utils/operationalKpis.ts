import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  EXHIBITION_METRIC_DEFINITION,
  matchesExhibitionMetric,
} from "./exhibitionMetrics";
import { hasModuleEnabled } from "./featureGates";
import {
  before,
  between,
  metric,
  openProjection,
  type ProjectionReader,
  type ProjectionUnavailable,
  throughStartOf,
} from "./projectionReads";

interface ValuationSummary {
  totalValue: number | null;
  itemCount: number | null;
  valuedCount: number | null;
}

function startOfDay(date: Date): number {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
}

function addDays(timestamp: number, days: number): number {
  return timestamp + days * 24 * 60 * 60 * 1000;
}

function createEmptyValuationSummary(available: boolean): ValuationSummary {
  return available
    ? { totalValue: null, itemCount: 0, valuedCount: 0 }
    : { totalValue: null, itemCount: null, valuedCount: null };
}

export interface OperationalKpisData {
  availability: "ready";
  updating: boolean;
  definitionId: typeof EXHIBITION_METRIC_DEFINITION;
  scope: { organizationId: Id<"organizations">; excludeExhibitionLoans: true };
  inventory: {
    available: boolean;
    unavailableReason?: string;
    totalValue: number | null;
    fineArt: ValuationSummary;
    wine: ValuationSummary;
    vehicles: ValuationSummary;
  };
  loans: {
    overdue: number;
    dueToday: number;
    dueNext7Days: number;
    dueNext30Days: number;
    upcomingReturns: Array<{
      id: string;
      loanNumber: string;
      lenderBorrowerName: string;
      type: "incoming" | "outgoing";
      endDate: number;
      daysRemaining: number;
      status: string;
    }>;
  };
  exhibitions: {
    proposed: number;
    approved: number;
    installing: number;
    active: number;
    deinstalling: number;
    closed: number;
    rejected: number;
    unclassified: number;
    excludedLoans: number;
    legacyContradictions: number;
    bySchedule: { current: number; upcoming: number; past: number };
    upcomingStarts: Array<{
      id: string;
      title: string;
      location?: string;
      startDate: number;
      endDate?: number;
      status?: string;
      daysUntilStart: number;
    }>;
    activeNow: Array<{
      id: string;
      title: string;
      location?: string;
      startDate: number;
      endDate?: number;
    }>;
  };
  asOf: number;
  generatedAt: number;
}

/** Rows inspected when building a schedule preview list. */
const EXHIBITION_PREVIEW_SCAN_LIMIT = 200;

function valuationFromTotals(
  available: boolean,
  totals: Record<string, number>,
  kind: "fineArt" | "wine" | "vehicles",
): ValuationSummary {
  if (!available) return createEmptyValuationSummary(false);
  return {
    totalValue: null,
    itemCount: metric(totals, `valuation.${kind}.count`),
    valuedCount: metric(totals, `valuation.${kind}.valued`),
  };
}

async function upcomingReturns(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  now: number,
) {
  const [active, dispatched] = await Promise.all(
    (["active", "dispatched"] as const).map((status) =>
      ctx.db
        .query("loans")
        .withIndex("by_organization_and_status_and_endDate", (q) =>
          q
            .eq("organizationId", organizationId)
            .eq("status", status)
            .gte("endDate", Number.NEGATIVE_INFINITY),
        )
        .take(10),
    ),
  );
  return [...(active ?? []), ...(dispatched ?? [])]
    .sort((a, b) => (a.endDate ?? 0) - (b.endDate ?? 0))
    .slice(0, 10)
    .map((loan) => ({
      id: loan._id,
      loanNumber: loan.loanNumber,
      lenderBorrowerName: loan.lenderBorrowerName,
      type: loan.type,
      endDate: loan.endDate as number,
      daysRemaining: Math.ceil(
        ((loan.endDate as number) - now) / (24 * 60 * 60 * 1000),
      ),
      status: loan.status,
    }));
}

async function exhibitionPreviews(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  now: number,
) {
  const upcomingStarts: OperationalKpisData["exhibitions"]["upcomingStarts"] =
    [];
  const upcoming = ctx.db
    .query("exhibitions")
    .withIndex("by_organization_and_startDate", (q) =>
      q.eq("organizationId", organizationId).gt("startDate", now),
    );
  let inspected = 0;
  for await (const exhibition of upcoming) {
    if (
      ++inspected > EXHIBITION_PREVIEW_SCAN_LIMIT ||
      upcomingStarts.length === 10
    )
      break;
    if (
      !matchesExhibitionMetric(exhibition, { asOf: now, schedule: "upcoming" })
    )
      continue;
    upcomingStarts.push({
      id: exhibition._id,
      title: exhibition.title,
      location: exhibition.location,
      startDate: exhibition.startDate,
      endDate: exhibition.endDate,
      status: exhibition.status,
      daysUntilStart: Math.ceil(
        (exhibition.startDate - now) / (24 * 60 * 60 * 1000),
      ),
    });
  }

  const activeNow: OperationalKpisData["exhibitions"]["activeNow"] = [];
  const started = ctx.db
    .query("exhibitions")
    .withIndex("by_organization_and_startDate", (q) =>
      q.eq("organizationId", organizationId).lte("startDate", now),
    )
    .order("desc");
  inspected = 0;
  for await (const exhibition of started) {
    if (++inspected > EXHIBITION_PREVIEW_SCAN_LIMIT || activeNow.length === 10)
      break;
    if (
      !matchesExhibitionMetric(exhibition, { asOf: now, schedule: "current" })
    )
      continue;
    activeNow.push({
      id: exhibition._id,
      title: exhibition.title,
      location: exhibition.location,
      startDate: exhibition.startDate,
      endDate: exhibition.endDate,
    });
  }
  return { upcomingStarts, activeNow };
}

/**
 * Exhibition lifecycle counts come from maintained totals; schedule phase is
 * evaluated at `asOf` from start/end interval series, so counts never freeze
 * at the last rebuild.
 */
export async function exhibitionSummaryAt(
  reader: ProjectionReader,
  totals: Record<string, number>,
  asOf: number,
) {
  const [[started = 0], [current = 0], [currentFlagged = 0]] =
    await Promise.all([
      reader.sums("exhibitions.started", [throughStartOf(asOf)]),
      reader.sums("exhibitions.current", [throughStartOf(asOf)]),
      reader.sums("exhibitions.currentFlagTrue", [throughStartOf(asOf)]),
    ]);
  const total = metric(totals, "exhibitions.total");
  const flagged = metric(totals, "exhibitions.flagTrue");
  return {
    proposed: metric(totals, "exhibitions.proposed"),
    approved: metric(totals, "exhibitions.approved"),
    installing: metric(totals, "exhibitions.installing"),
    active: metric(totals, "exhibitions.active"),
    deinstalling: metric(totals, "exhibitions.deinstalling"),
    closed: metric(totals, "exhibitions.closed"),
    rejected: metric(totals, "exhibitions.rejected"),
    unclassified: metric(totals, "exhibitions.unclassified"),
    excludedLoans: metric(totals, "exhibitions.excludedLoans"),
    legacyContradictions: flagged - currentFlagged + (current - currentFlagged),
    bySchedule: {
      current,
      upcoming: total - started,
      past: started - current,
    },
  };
}

export async function loadOperationalKpis(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  now: number,
): Promise<OperationalKpisData | ProjectionUnavailable> {
  const opened = await openProjection(ctx, organizationId);
  if (!opened.ok) return opened.unavailable;
  const { reader } = opened;
  const hasInventoryValuationModule = await hasModuleEnabled(
    ctx,
    organizationId,
    "inventory_valuation",
  );

  const todayStart = startOfDay(new Date(now));
  const todayEnd = addDays(todayStart, 1);
  const next7Days = addDays(todayStart, 7);
  const next30Days = addDays(todayStart, 30);

  const totals = await reader.totals();
  const [
    [overdue = 0, dueToday = 0, dueNext7Days = 0, dueNext30Days = 0],
    exhibitions,
    previews,
    returns,
  ] = await Promise.all([
    reader.sums("loans.open.endDate", [
      before(todayStart),
      between(todayStart, todayEnd),
      between(todayEnd, next7Days),
      between(next7Days, next30Days),
    ]),
    exhibitionSummaryAt(reader, totals, now),
    exhibitionPreviews(ctx, organizationId, now),
    upcomingReturns(ctx, organizationId, now),
  ]);

  return {
    availability: "ready",
    updating: opened.reader.updating,
    definitionId: EXHIBITION_METRIC_DEFINITION,
    scope: { organizationId, excludeExhibitionLoans: true },
    inventory: {
      available: false,
      unavailableReason: hasInventoryValuationModule
        ? "valuation_currency_not_recorded"
        : "inventory_valuation_module_disabled",
      totalValue: null,
      fineArt: valuationFromTotals(
        hasInventoryValuationModule,
        totals,
        "fineArt",
      ),
      wine: valuationFromTotals(hasInventoryValuationModule, totals, "wine"),
      vehicles: valuationFromTotals(
        hasInventoryValuationModule,
        totals,
        "vehicles",
      ),
    },
    loans: {
      overdue,
      dueToday,
      dueNext7Days,
      dueNext30Days,
      upcomingReturns: returns,
    },
    exhibitions: {
      ...exhibitions,
      upcomingStarts: previews.upcomingStarts,
      activeNow: previews.activeNow,
    },
    asOf: now,
    generatedAt: now,
  };
}
