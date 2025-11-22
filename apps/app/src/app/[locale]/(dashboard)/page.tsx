"use client";

import { Header } from "@/app/[locale]/(dashboard)/_components/header";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useQuery } from "convex/react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  CheckCircle,
  Clock,
  FileCheck,
  FileX,
  Handshake,
  MapPin,
  Plus,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";
import Link from "next/link";

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
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!organizations || organizations.length === 0) {
    return (
      <>
        <div className="flex h-full w-full items-center justify-center bg-secondary px-4 py-0 dark:bg-black">
          <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-8 dark:bg-black">
            <Building2 className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <h3 className="text-lg font-semibold">No Organization Found</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                You need to create an organization to view the dashboard.
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!currentOrganizationId) {
    return (
      <>
        <div className="flex h-full w-full items-center justify-center bg-secondary px-6 py-8 dark:bg-black">
          <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-8 dark:bg-black">
            <Building2 className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <h3 className="text-lg font-semibold">Select an Organization</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Please select an organization from the dropdown above to view
                the dashboard.
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (analytics === undefined) {
    return (
      <>
        <div className="flex h-full w-full items-center justify-center bg-secondary px-6 py-8 dark:bg-black">
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex h-full w-full bg-secondary px-6 py-8 dark:bg-black">
        <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
          <div className="flex w-full flex-col gap-6">
            {/* Quick Actions */}
            <div className="flex flex-wrap gap-3">
              <PermissionGate permission="collections.create">
                <Link href="/collections/new">
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    New Collection
                  </Button>
                </Link>
              </PermissionGate>
              <PermissionGate permission="collections.create">
                <Link href="/accessions/new">
                  <Button variant="outline" className="gap-2">
                    <TrendingUp className="h-4 w-4" />
                    New Accession
                  </Button>
                </Link>
              </PermissionGate>
              <PermissionGate permission="loans.create">
                <Link href="/loans/new">
                  <Button variant="outline" className="gap-2">
                    <Handshake className="h-4 w-4" />
                    New Loan
                  </Button>
                </Link>
              </PermissionGate>
              <PermissionGate permission="locations.create">
                <Link href="/locations/new">
                  <Button variant="outline" className="gap-2">
                    <MapPin className="h-4 w-4" />
                    New Location
                  </Button>
                </Link>
              </PermissionGate>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* Collections Card */}
              <Link
                href="/collections"
                className="group relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-blue-50 to-blue-100/50 p-6 shadow-sm transition-all hover:shadow-md dark:from-blue-950/20 dark:to-blue-900/10"
              >
                <div className="relative z-10 flex flex-col gap-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground">
                        Collections
                      </p>
                      <p className="mt-2 text-4xl font-bold text-blue-700 dark:text-blue-400">
                        {analytics.collections.total}
                      </p>
                    </div>
                    <FileCheck className="h-6 w-6 flex-shrink-0 text-blue-700 dark:text-blue-400" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Active</span>
                      <span className="font-semibold">
                        {analytics.collections.active}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-blue-200 dark:bg-blue-900/30">
                      <div
                        className="h-full rounded-full bg-blue-600 transition-all"
                        style={{
                          width: `${
                            analytics.collections.total > 0
                              ? (analytics.collections.active /
                                  analytics.collections.total) *
                                100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>{analytics.collections.loaned} loaned</span>
                      <span>
                        {analytics.collections.deaccessioned} deaccessioned
                      </span>
                    </div>
                  </div>
                </div>
              </Link>

              {/* Loans Card */}
              <Link
                href="/loans"
                className="group relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-green-50 to-emerald-100/50 p-6 shadow-sm transition-all hover:shadow-md dark:from-green-950/20 dark:to-emerald-900/10"
              >
                <div className="relative z-10 flex flex-col gap-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground">
                        Loans
                      </p>
                      <p className="mt-2 text-4xl font-bold text-green-700 dark:text-green-400">
                        {analytics.loans.total}
                      </p>
                    </div>
                    <Handshake className="h-6 w-6 flex-shrink-0 text-green-700 dark:text-green-400" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Active</span>
                      <span className="font-semibold">
                        {analytics.loans.active}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-green-200 dark:bg-green-900/30">
                      <div
                        className="h-full rounded-full bg-green-600 transition-all"
                        style={{
                          width: `${
                            analytics.loans.total > 0
                              ? (analytics.loans.active /
                                  analytics.loans.total) *
                                100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>{analytics.loans.pending} pending</span>
                      <span>{analytics.loans.returned} returned</span>
                    </div>
                  </div>
                </div>
              </Link>

              {/* Accessions Card */}
              <Link
                href="/accessions"
                className="group relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-amber-50 to-yellow-100/50 p-6 shadow-sm transition-all hover:shadow-md dark:from-amber-950/20 dark:to-yellow-900/10"
              >
                <div className="relative z-10 flex flex-col gap-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground">
                        Accessions
                      </p>
                      <p className="mt-2 text-4xl font-bold text-amber-700 dark:text-amber-400">
                        {analytics.accessions.pending}
                      </p>
                    </div>
                    <TrendingUp className="h-6 w-6 flex-shrink-0 text-amber-700 dark:text-amber-400" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Pending</span>
                      <span className="font-semibold">
                        {analytics.accessions.pending}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-amber-200 dark:bg-amber-900/30">
                      <div
                        className="h-full rounded-full bg-amber-600 transition-all"
                        style={{
                          width: `${
                            analytics.accessions.pending +
                              analytics.accessions.approved +
                              analytics.accessions.rejected >
                            0
                              ? (analytics.accessions.pending /
                                  (analytics.accessions.pending +
                                    analytics.accessions.approved +
                                    analytics.accessions.rejected)) *
                                100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>{analytics.accessions.approved} approved</span>
                      <span>{analytics.accessions.rejected} rejected</span>
                    </div>
                  </div>
                </div>
              </Link>

              {/* Locations Card */}
              <Link
                href="/locations"
                className="group relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-purple-50 to-violet-100/50 p-6 shadow-sm transition-all hover:shadow-md dark:from-purple-950/20 dark:to-violet-900/10"
              >
                <div className="relative z-10 flex flex-col gap-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground">
                        Locations
                      </p>
                      <p className="mt-2 text-4xl font-bold text-purple-700 dark:text-purple-400">
                        {analytics.locations.total}
                      </p>
                    </div>
                    <MapPin className="h-6 w-6 flex-shrink-0 text-purple-700 dark:text-purple-400" />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Active locations in use
                  </div>
                </div>
              </Link>
            </div>

            {/* Detailed Stats */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Loans Breakdown */}
              <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Loans Overview</h3>
                  <Link href="/loans">
                    <Button variant="ghost" size="sm">
                      View All
                    </Button>
                  </Link>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-yellow-600" />
                      <span className="text-sm">Pending</span>
                    </div>
                    <span className="font-semibold">
                      {analytics.loans.pending}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm">Active</span>
                    </div>
                    <span className="font-semibold">
                      {analytics.loans.active}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-blue-600" />
                      <span className="text-sm">Returned</span>
                    </div>
                    <span className="font-semibold">
                      {analytics.loans.returned}
                    </span>
                  </div>
                  <div className="border-t border-border pt-4 mt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ArrowDownRight className="h-4 w-4 text-blue-600" />
                        <span className="text-sm">Incoming</span>
                      </div>
                      <span className="font-semibold">
                        {analytics.loans.incoming}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2">
                        <ArrowUpRight className="h-4 w-4 text-purple-600" />
                        <span className="text-sm">Outgoing</span>
                      </div>
                      <span className="font-semibold">
                        {analytics.loans.outgoing}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Workflows Breakdown */}
              <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Workflows</h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Link
                        href="/accessions"
                        className="flex items-center gap-2 text-sm font-medium hover:underline"
                      >
                        <TrendingUp className="h-4 w-4" />
                        Accessions
                      </Link>
                    </div>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>
                        <Clock className="inline h-3 w-3 mr-1" />
                        {analytics.accessions.pending} pending
                      </span>
                      <span>
                        <CheckCircle className="inline h-3 w-3 mr-1 text-green-600" />
                        {analytics.accessions.approved} approved
                      </span>
                      <span>
                        <XCircle className="inline h-3 w-3 mr-1 text-red-600" />
                        {analytics.accessions.rejected} rejected
                      </span>
                    </div>
                  </div>
                  <div className="border-t border-border pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <Link
                        href="/deaccessions"
                        className="flex items-center gap-2 text-sm font-medium hover:underline"
                      >
                        <FileX className="h-4 w-4" />
                        Deaccessions
                      </Link>
                    </div>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>
                        <Clock className="inline h-3 w-3 mr-1" />
                        {analytics.deaccessions.pending} pending
                      </span>
                      <span>
                        <CheckCircle className="inline h-3 w-3 mr-1 text-green-600" />
                        {analytics.deaccessions.approved} approved
                      </span>
                      <span>
                        <XCircle className="inline h-3 w-3 mr-1 text-red-600" />
                        {analytics.deaccessions.rejected} rejected
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Recent Activity</h3>
                </div>
                {analytics.recentActivity.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground">
                      No recent activity
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {analytics.recentActivity.map((activity) => {
                      const getActivityIcon = () => {
                        switch (activity.type) {
                          case "collection":
                            return (
                              <FileCheck className="h-4 w-4 text-blue-600" />
                            );
                          case "loan":
                            return (
                              <Handshake className="h-4 w-4 text-green-600" />
                            );
                          case "accession":
                            return (
                              <TrendingUp className="h-4 w-4 text-amber-600" />
                            );
                          case "deaccession":
                            return <FileX className="h-4 w-4 text-red-600" />;
                        }
                      };

                      const getActivityLink = () => {
                        switch (activity.type) {
                          case "collection":
                            return `/collections/${activity.id}`;
                          case "loan":
                            return `/loans/${activity.id}`;
                          case "accession":
                            return `/accessions/${activity.id}`;
                          case "deaccession":
                            return `/deaccessions/${activity.id}`;
                        }
                      };

                      return (
                        <Link
                          key={`${activity.type}-${activity.id}`}
                          href={getActivityLink()}
                          className="group flex items-center gap-2 text-sm font-medium hover:underline"
                        >
                          {getActivityIcon()}
                          <span className="flex-1 truncate">
                            {activity.title}
                          </span>
                          {activity.subtitle && (
                            <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                              {activity.subtitle}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
