"use client";

import { KpiCard } from "@v1/ui/kpi-card";
import { SkeletonCard } from "@v1/ui/skeleton-variants";

export default function DashboardLoading() {
  return (
    <div className="flex h-full w-full flex-col bg-background">
      <div className="px-6 py-4 border-b border-border bg-background/50 backdrop-blur-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard title="" value="" loading />
          <KpiCard title="" value="" loading />
          <KpiCard title="" value="" loading />
          <KpiCard title="" value="" loading />
        </div>
      </div>

      <div className="px-6 pt-6">
        <SkeletonCard className="h-96" />
      </div>

      <div className="px-6 pt-6">
        <SkeletonCard className="h-64" />
      </div>

      <div className="flex-1 overflow-y-auto scroll-smooth p-6">
        <div className="h-4 w-48 animate-pulse rounded bg-muted/60 mb-4" />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
          {["sk-1", "sk-2", "sk-3", "sk-4", "sk-5", "sk-6", "sk-7", "sk-8"].map(
            (id) => (
              <div
                key={id}
                className="rounded-xl border border-border overflow-hidden"
              >
                <div className="aspect-[4/3] bg-muted animate-pulse" />
                <div className="p-3 bg-muted/20">
                  <div className="h-4 w-24 bg-muted/60 rounded animate-pulse mb-2" />
                  <div className="h-3 w-32 bg-muted/40 rounded animate-pulse" />
                </div>
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
