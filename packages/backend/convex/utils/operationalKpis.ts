import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  EXHIBITION_METRIC_DEFINITION,
  matchesExhibitionMetric,
  summarizeExhibitionMetrics,
} from "./exhibitionMetrics";
import { hasModuleEnabled } from "./featureGates";

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

export async function loadOperationalKpis(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  now: number,
): Promise<OperationalKpisData> {
  const hasInventoryValuationModule = await hasModuleEnabled(
    ctx,
    organizationId,
    "inventory_valuation",
  );

  const todayStart = startOfDay(new Date(now));
  const todayEnd = addDays(todayStart, 1);
  const next7Days = addDays(todayStart, 7);
  const next30Days = addDays(todayStart, 30);

  let fineArtValuation = createEmptyValuationSummary(
    hasInventoryValuationModule,
  );
  let wineValuation = createEmptyValuationSummary(hasInventoryValuationModule);
  let vehicleValuation = createEmptyValuationSummary(
    hasInventoryValuationModule,
  );

  if (hasInventoryValuationModule) {
    const fineArtDetails = await ctx.db
      .query("fineArtDetails")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .collect();

    fineArtValuation = fineArtDetails.reduce((acc, item) => {
      acc.itemCount = (acc.itemCount ?? 0) + 1;
      if (item.appraisedValue != null) {
        acc.valuedCount = (acc.valuedCount ?? 0) + 1;
      }
      return acc;
    }, createEmptyValuationSummary(true));

    const wineDetails = await ctx.db
      .query("wineDetails")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .collect();

    wineValuation = wineDetails.reduce((acc, item) => {
      acc.itemCount = (acc.itemCount ?? 0) + 1;
      if (item.currentValue != null) {
        acc.valuedCount = (acc.valuedCount ?? 0) + 1;
      }
      return acc;
    }, createEmptyValuationSummary(true));

    const vehicleDetails = await ctx.db
      .query("vehicleDetails")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .collect();

    vehicleValuation = vehicleDetails.reduce((acc, item) => {
      acc.itemCount = (acc.itemCount ?? 0) + 1;
      if (item.insuranceValue != null) {
        acc.valuedCount = (acc.valuedCount ?? 0) + 1;
      }
      return acc;
    }, createEmptyValuationSummary(true));
  }

  const allLoans = await ctx.db
    .query("loans")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .collect();

  const activeLoans = allLoans.filter(
    (l) => l.status === "active" || l.status === "dispatched",
  );

  const loanBuckets = activeLoans.reduce(
    (acc, loan) => {
      if (loan.endDate === undefined) return acc;
      if (loan.endDate < todayStart) {
        acc.overdue++;
      } else if (loan.endDate >= todayStart && loan.endDate < todayEnd) {
        acc.dueToday++;
      } else if (loan.endDate >= todayEnd && loan.endDate < next7Days) {
        acc.dueNext7Days++;
      } else if (loan.endDate >= next7Days && loan.endDate < next30Days) {
        acc.dueNext30Days++;
      }
      return acc;
    },
    { overdue: 0, dueToday: 0, dueNext7Days: 0, dueNext30Days: 0 },
  );

  const upcomingReturns = activeLoans
    .filter((l) => l.endDate != null)
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

  const allExhibitions = await ctx.db
    .query("exhibitions")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .collect();

  const exhibitionsByStatus = summarizeExhibitionMetrics(allExhibitions, now);

  const upcomingExhibitions = allExhibitions
    .filter((e) =>
      matchesExhibitionMetric(e, { asOf: now, schedule: "upcoming" }),
    )
    .sort((a, b) => a.startDate - b.startDate)
    .slice(0, 10)
    .map((e) => ({
      id: e._id,
      title: e.title,
      location: e.location,
      startDate: e.startDate,
      endDate: e.endDate,
      status: e.status,
      daysUntilStart: Math.ceil((e.startDate - now) / (24 * 60 * 60 * 1000)),
    }));

  const activeExhibitions = allExhibitions
    .filter((e) =>
      matchesExhibitionMetric(e, { asOf: now, schedule: "current" }),
    )
    .slice(0, 10)
    .map((e) => ({
      id: e._id,
      title: e.title,
      location: e.location,
      startDate: e.startDate,
      endDate: e.endDate,
    }));

  return {
    definitionId: EXHIBITION_METRIC_DEFINITION,
    scope: { organizationId, excludeExhibitionLoans: true },
    inventory: {
      available: false,
      unavailableReason: hasInventoryValuationModule
        ? "valuation_currency_not_recorded"
        : "inventory_valuation_module_disabled",
      totalValue: null,
      fineArt: { ...fineArtValuation, totalValue: null },
      wine: { ...wineValuation, totalValue: null },
      vehicles: { ...vehicleValuation, totalValue: null },
    },
    loans: {
      ...loanBuckets,
      upcomingReturns,
    },
    exhibitions: {
      ...exhibitionsByStatus,
      upcomingStarts: upcomingExhibitions,
      activeNow: activeExhibitions,
    },
    asOf: now,
    generatedAt: now,
  };
}
