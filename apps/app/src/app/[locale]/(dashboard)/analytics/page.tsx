"use client";

import { useOrganization } from "@/components/organization-provider";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Skeleton } from "@v1/ui/skeleton";
import { useQuery } from "convex/react";
import { BarChart3 } from "lucide-react";
import { ExhibitionPipelineCard } from "./_components/exhibition-pipeline-card";
import { InventoryValuationCard } from "./_components/inventory-valuation-card";
import { LoanCalendarCard } from "./_components/loan-calendar-card";

export default function AnalyticsPage() {
  const { currentOrganizationId } = useOrganization();
  const kpis = useQuery(
    api.dashboard.getOperationalKpis,
    currentOrganizationId
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );

  if (!currentOrganizationId) return null;

  if (!kpis) {
    return (
      <div className="flex flex-col h-full space-y-6 p-6 overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 h-full">
          <Skeleton className="h-[400px] w-full rounded-xl bg-muted/20" />
          <Skeleton className="h-[400px] w-full rounded-xl bg-muted/20" />
          <Skeleton className="h-[400px] w-full rounded-xl bg-muted/20" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-6 p-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-indigo-400" />
            Operational KPIs
          </h2>
          <p className="text-sm text-muted-foreground">
            Real-time insights into collection assets, loans, and exhibitions.
          </p>
        </div>
        <div className="text-xs text-muted-foreground font-mono bg-muted/30 px-2 py-1 rounded border border-border">
          Updated: {new Date(kpis.generatedAt).toLocaleTimeString()}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        <InventoryValuationCard data={kpis.inventory} />
        <LoanCalendarCard data={kpis.loans} />
        <ExhibitionPipelineCard data={kpis.exhibitions} />
      </div>
    </div>
  );
}
