"use client";

import { useOrganization } from "@/components/organization-provider";
import {
  type RecentActivityItem,
  RecentActivityLog,
} from "@/components/recent-activity-log";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { KpiCard } from "@v1/ui/kpi-card";
import { SkeletonCard } from "@v1/ui/skeleton-variants";
import { useQuery } from "convex/react";
import {
  ArrowLeftRight,
  Building2,
  Eye,
  FileClock,
  Package,
  Presentation,
  ScanBarcode,
  Server,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { AssignmentsQueue } from "./_components/assignments-queue";
import { NewArrivalsFeed } from "./_components/new-arrivals-feed";

export default function DashboardPage() {
  const { currentOrganizationId, organizations, isLoading } = useOrganization();

  const analytics = useQuery(
    api.dashboard.getAnalytics,
    currentOrganizationId
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!organizations || organizations.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background px-4">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-8">
          <Building2 className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold text-foreground">
              No Organization Found
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              You need to create an organization to view the dashboard.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background px-6">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-8">
          <Building2 className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold text-foreground">
              Select an Organization
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Please select an organization from the dropdown above to view the
              dashboard.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (analytics === undefined) {
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
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-background">
      <div className="px-6 py-4 border-b border-border bg-background/50 backdrop-blur-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard
            title="Total Objects"
            value={analytics.objects.total.toLocaleString()}
            icon={Package}
          />
          <KpiCard
            title="Objects on Loan"
            value={analytics.objects.loaned.toLocaleString()}
            icon={ArrowLeftRight}
          />
          <KpiCard
            title="Active Loans"
            value={analytics.loans.active.toLocaleString()}
            icon={ArrowLeftRight}
          />
          <KpiCard
            title="Pending Accessions"
            value={analytics.accessions.pending.toLocaleString()}
            icon={FileClock}
          />
        </div>
      </div>

      <div className="px-6 pt-6">
        <Suspense fallback={<SkeletonCard className="h-96" />}>
          <AssignmentsQueue />
        </Suspense>
      </div>

      <div className="px-6 pt-6">
        <Suspense fallback={<SkeletonCard className="h-64" />}>
          <NewArrivalsFeed />
        </Suspense>
      </div>

      <div className="flex-1 overflow-y-auto scroll-smooth p-6">
        <h3 className="text-xs font-semibold text-muted-foreground mb-4 uppercase tracking-wider">
          Departments & Collections
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
          {analytics.recentCollectionGroups.map((group, index) => (
            <Link
              key={group.id}
              href={`/collections?group=${group.id}`}
              className="block"
            >
              <div
                className="hover-trigger group relative bg-card border border-border rounded-xl overflow-hidden hover:border-indigo-500/30 hover:ring-1 hover:ring-indigo-500/30 transition-all duration-300 flex flex-col cursor-pointer shadow-lg hover:shadow-2xl hover:shadow-indigo-900/10 animate-enter"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="relative aspect-[4/3] bg-muted overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-80 z-10" />
                  {group.imageUrl ? (
                    <img
                      src={group.imageUrl}
                      alt={group.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out will-change-transform opacity-90 group-hover:opacity-100"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Package className="w-10 h-10 text-muted-foreground/40" />
                    </div>
                  )}

                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-30 pointer-events-none">
                    <span className="bg-background/60 backdrop-blur-md text-foreground text-[11px] font-medium px-3 py-1.5 rounded-full border border-border shadow-xl transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                      View Collection
                    </span>
                  </div>

                  <div className="absolute top-2 left-2 z-20">
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-background/90 backdrop-blur-md rounded-md border border-border shadow-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span className="text-[10px] font-medium text-foreground/80">
                        {group.itemsCount} Items
                      </span>
                    </div>
                  </div>

                  <div className="absolute bottom-3 left-3 right-3 z-20">
                    <h3 className="text-sm font-semibold text-foreground tracking-tight leading-snug drop-shadow-md line-clamp-1">
                      {group.name}
                    </h3>
                    {group.description && (
                      <p className="text-[11px] text-foreground/70 truncate opacity-90">
                        {group.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-muted/20">
                  <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-[10px]">
                    <div className="group/item">
                      <span className="block text-muted-foreground/60 uppercase tracking-widest text-[9px] mb-0.5">
                        Items
                      </span>
                      <span className="text-foreground/80 font-medium group-hover/item:text-indigo-400 transition-colors flex items-center gap-1">
                        {group.itemsCount.toLocaleString()}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="block text-muted-foreground/60 uppercase tracking-widest text-[9px] mb-0.5">
                        Status
                      </span>
                      <span className="font-mono bg-emerald-900/10 text-emerald-500 px-1 py-0.5 rounded border border-emerald-900/30">
                        Active
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}

          <Link href="/collections" className="block">
            <div
              className="hover-trigger group relative bg-card border border-border rounded-xl overflow-hidden hover:border-blue-500/30 hover:ring-1 hover:ring-blue-500/30 transition-all duration-300 flex flex-col cursor-pointer shadow-lg hover:shadow-2xl hover:shadow-blue-900/10 animate-enter"
              style={{
                animationDelay: `${analytics.recentCollectionGroups.length * 100}ms`,
              }}
            >
              <div className="relative aspect-[4/3] bg-muted overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-80 z-10" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Package className="w-10 h-10 text-muted-foreground/40" />
                </div>

                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-30 pointer-events-none">
                  <span className="bg-background/60 backdrop-blur-md text-foreground text-[11px] font-medium px-3 py-1.5 rounded-full border border-border shadow-xl transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                    View All
                  </span>
                </div>

                <div className="absolute top-2 left-2 z-20">
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-background/90 backdrop-blur-md rounded-md border border-blue-500/30 shadow-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    <span className="text-[10px] font-medium text-blue-400 dark:text-blue-300">
                      {analytics.collections.total} Groups
                    </span>
                  </div>
                </div>

                <div className="absolute bottom-3 left-3 right-3 z-20">
                  <h3 className="text-sm font-semibold text-foreground tracking-tight leading-snug drop-shadow-md">
                    All Collection Groups
                  </h3>
                  <p className="text-[11px] text-foreground/70 truncate opacity-90">
                    {analytics.objects.total.toLocaleString()} Total Objects
                  </p>
                </div>
              </div>

              <div className="p-3 bg-muted/20">
                <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-[10px]">
                  <div className="group/item">
                    <span className="block text-muted-foreground/60 uppercase tracking-widest text-[9px] mb-0.5">
                      Active
                    </span>
                    <span className="text-foreground/80 font-medium group-hover/item:text-blue-400 transition-colors flex items-center gap-1">
                      {analytics.objects.active.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="block text-muted-foreground/60 uppercase tracking-widest text-[9px] mb-0.5">
                      Loaned
                    </span>
                    <span className="font-mono text-muted-foreground">
                      {analytics.objects.loaned}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Link>

          <Link href="/objects/new" className="block">
            <div
              className="hover-trigger group relative bg-card border border-dashed border-border rounded-xl overflow-hidden hover:border-input transition-all duration-300 flex flex-col cursor-pointer hover:bg-muted/40 animate-enter"
              style={{
                animationDelay: `${(analytics.recentCollectionGroups.length + 1) * 100}ms`,
              }}
            >
              <div className="relative aspect-[4/3] flex items-center justify-center flex-col gap-3">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center group-hover:bg-muted/80 transition-colors">
                  <Presentation className="w-6 h-6 text-muted-foreground group-hover:text-foreground" />
                </div>
                <div className="text-center">
                  <h3 className="text-sm font-medium text-foreground/80">
                    Add New Object
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Create catalog entry
                  </p>
                </div>
              </div>
              <div className="p-3 border-t border-border bg-muted/10">
                <div className="text-[10px] text-center text-muted-foreground">
                  Quick Action
                </div>
              </div>
            </div>
          </Link>

          <Link href="/accessions" className="block">
            <div
              className="hover-trigger group relative bg-card border border-border rounded-xl overflow-hidden hover:border-amber-500/30 hover:ring-1 hover:ring-amber-500/30 transition-all duration-300 flex flex-col cursor-pointer shadow-lg animate-enter"
              style={{
                animationDelay: `${(analytics.recentCollectionGroups.length + 2) * 100}ms`,
              }}
            >
              <div className="relative aspect-[4/3] bg-background overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-80 z-10" />

                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-30 pointer-events-none">
                  <span className="bg-background/60 backdrop-blur-md text-foreground text-[11px] font-medium px-3 py-1.5 rounded-full border border-border shadow-xl transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                    View Details
                  </span>
                </div>

                <div className="absolute inset-0 flex items-center justify-center bg-muted">
                  <FileClock className="w-10 h-10 text-muted-foreground/40" />
                </div>

                <div className="absolute top-2 left-2 z-20">
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/90 backdrop-blur-md rounded-md border border-amber-500/30 shadow-sm text-amber-500">
                    <ScanBarcode className="w-3 h-3" />
                    <span className="text-[10px] font-medium">
                      {analytics.accessions.pending} Pending
                    </span>
                  </div>
                </div>

                <div className="absolute bottom-3 left-3 right-3 z-20">
                  <h3 className="text-sm font-medium text-foreground tracking-tight leading-snug">
                    Accessions Workflow
                  </h3>
                  <p className="text-[11px] text-muted-foreground truncate">
                    Review incoming items
                  </p>
                </div>
              </div>

              <div className="p-3 bg-muted/20">
                <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-[10px]">
                  <div className="group/item">
                    <span className="block text-muted-foreground/60 uppercase tracking-widest text-[9px] mb-0.5">
                      Approved
                    </span>
                    <span className="text-muted-foreground group-hover/item:text-amber-400 transition-colors flex items-center gap-1">
                      {analytics.accessions.approved}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="block text-muted-foreground/60 uppercase tracking-widest text-[9px] mb-0.5">
                      Status
                    </span>
                    <span className="font-mono bg-amber-900/10 text-amber-500 px-1 py-0.5 rounded border border-amber-900/30">
                      Processing
                    </span>
                  </div>
                  <div>
                    <span className="block text-muted-foreground/60 uppercase tracking-widest text-[9px] mb-0.5">
                      Rejected
                    </span>
                    <span className="text-muted-foreground flex items-center gap-1 truncate">
                      {analytics.accessions.rejected}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Link>
        </div>

        <div className="mt-8">
          <RecentActivityLog
            activities={analytics.recentActivity as RecentActivityItem[]}
          />
        </div>
      </div>
    </div>
  );
}
