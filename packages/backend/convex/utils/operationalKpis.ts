import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { hasModuleEnabled } from "./featureGates";

interface ValuationSummary {
  totalValue: number;
  itemCount: number;
  valuedCount: number;
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

function createEmptyValuationSummary(): ValuationSummary {
  return { totalValue: 0, itemCount: 0, valuedCount: 0 };
}

export interface OperationalKpisData {
  inventory: {
    totalValue: number;
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
    active: number;
    closed: number;
    rejected: number;
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
  generatedAt: number;
}

export async function loadOperationalKpis(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
): Promise<OperationalKpisData> {
  const hasInventoryValuationModule = await hasModuleEnabled(
    ctx,
    organizationId,
    "inventory_valuation",
  );

  const now = Date.now();
  const todayStart = startOfDay(new Date());
  const todayEnd = addDays(todayStart, 1);
  const next7Days = addDays(todayStart, 7);
  const next30Days = addDays(todayStart, 30);

  let fineArtValuation = createEmptyValuationSummary();
  let wineValuation = createEmptyValuationSummary();
  let vehicleValuation = createEmptyValuationSummary();

  if (hasInventoryValuationModule) {
    const fineArtDetails = await ctx.db
      .query("fineArtDetails")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .collect();

    fineArtValuation = fineArtDetails.reduce(
      (acc, item) => {
        acc.itemCount++;
        if (item.appraisedValue != null && item.appraisedValue > 0) {
          acc.valuedCount++;
          acc.totalValue += item.appraisedValue;
        }
        return acc;
      },
      createEmptyValuationSummary(),
    );

    const wineDetails = await ctx.db
      .query("wineDetails")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .collect();

    wineValuation = wineDetails.reduce(
      (acc, item) => {
        acc.itemCount++;
        if (item.currentValue != null && item.currentValue > 0) {
          acc.valuedCount++;
          const quantity = item.quantity ?? 1;
          acc.totalValue += item.currentValue * quantity;
        }
        return acc;
      },
      createEmptyValuationSummary(),
    );

    const vehicleDetails = await ctx.db
      .query("vehicleDetails")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .collect();

    vehicleValuation = vehicleDetails.reduce(
      (acc, item) => {
        acc.itemCount++;
        if (item.insuranceValue != null && item.insuranceValue > 0) {
          acc.valuedCount++;
          acc.totalValue += item.insuranceValue;
        }
        return acc;
      },
      createEmptyValuationSummary(),
    );
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
      if (!loan.endDate) return acc;
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

  const exhibitionsByStatus = allExhibitions.reduce(
    (acc, exhibition) => {
      const status = exhibition.status ?? "proposed";
      if (status === "proposed") acc.proposed++;
      else if (status === "approved") acc.approved++;
      else if (status === "active") acc.active++;
      else if (status === "closed") acc.closed++;
      else if (status === "rejected") acc.rejected++;
      return acc;
    },
    { proposed: 0, approved: 0, active: 0, closed: 0, rejected: 0 },
  );

  const upcomingExhibitions = allExhibitions
    .filter(
      (e) =>
        e.startDate > now &&
        (e.status === "proposed" || e.status === "approved"),
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
    .filter(
      (e) =>
        e.status === "active" ||
        e.isCurrent ||
        (e.startDate <= now && (e.endDate == null || e.endDate >= now)),
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
    inventory: {
      totalValue:
        fineArtValuation.totalValue +
        wineValuation.totalValue +
        vehicleValuation.totalValue,
      fineArt: fineArtValuation,
      wine: wineValuation,
      vehicles: vehicleValuation,
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
    generatedAt: now,
  };
}
