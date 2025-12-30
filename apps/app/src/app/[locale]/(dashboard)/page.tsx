"use client";

import { CollectionCard } from "@/components/collection-card";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useQuery } from "convex/react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Box,
  CheckCircle,
  Clock,
  FileCheck,
  FileX,
  Handshake,
  Landmark,
  MapPin,
  Plus,
  TrendingUp,
  XCircle,
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
      <div className="flex h-full w-full items-center justify-center bg-zinc-950">
        <p className="text-zinc-500">Loading...</p>
      </div>
    );
  }

  if (!organizations || organizations.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-zinc-950 px-4 py-0">
        <div className="flex flex-col items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-8">
          <Landmark className="h-12 w-12 text-zinc-500" />
          <div className="text-center">
            <h3 className="text-lg font-semibold text-zinc-200">
              No Organization Found
            </h3>
            <p className="mt-2 text-sm text-zinc-400">
              You need to create an organization to view the dashboard.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-zinc-950 px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-8">
          <Landmark className="h-12 w-12 text-zinc-500" />
          <div className="text-center">
            <h3 className="text-lg font-semibold text-zinc-200">
              Select an Organization
            </h3>
            <p className="mt-2 text-sm text-zinc-400">
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
      <div className="flex h-full w-full items-center justify-center bg-zinc-950 px-6 py-8">
        <p className="text-zinc-500">Loading analytics...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-zinc-950 px-6">
      <div className="z-10 mx-auto flex h-full w-full max-w-screen-2xl gap-12">
        <div className="flex w-full flex-col gap-8 pb-10">
          <div className="flex flex-wrap gap-3 pt-6">
            <PermissionGate permission="collections.create">
              <Link href="/objects/new">
                <Button className="gap-2 bg-indigo-600 text-white hover:bg-indigo-500 border border-indigo-500 shadow-lg shadow-indigo-500/20">
                  <Plus className="h-4 w-4" />
                  Add Object
                </Button>
              </Link>
            </PermissionGate>
            <PermissionGate permission="collections.create">
              <Link href="/accessions/new">
                <Button
                  variant="outline"
                  className="gap-2 border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white"
                >
                  <TrendingUp className="h-4 w-4" />
                  New Accession
                </Button>
              </Link>
            </PermissionGate>
            <PermissionGate permission="loans.create">
              <Link href="/loans/new">
                <Button
                  variant="outline"
                  className="gap-2 border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white"
                >
                  <Handshake className="h-4 w-4" />
                  New Loan
                </Button>
              </Link>
            </PermissionGate>
            <PermissionGate permission="locations.create">
              <Link href="/locations/new">
                <Button
                  variant="outline"
                  className="gap-2 border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white"
                >
                  <MapPin className="h-4 w-4" />
                  New Location
                </Button>
              </Link>
            </PermissionGate>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <CollectionCard
              title="Collections"
              subtitle={`${analytics.collections.total} Collection groups`}
              imageSrc="https://images.unsplash.com/photo-1549887552-93f954d31871?q=80&w=600&auto=format&fit=crop"
              href="/collections"
              variant="amber"
              statusText="Permanent"
              statusIcon={Landmark}
              animationDelay={0}
              footer={
                <div className="flex items-center justify-between">
                  <span>Top Valuation</span>
                  <span className="font-medium text-zinc-300">$12.5M</span>
                </div>
              }
            />

            <CollectionCard
              title="Objects"
              subtitle={`${analytics.objects.total} Items • ${analytics.locations.total} Locations`}
              imageSrc="https://images.unsplash.com/photo-1576769939526-9d22d5b6256f?q=80&w=600&auto=format&fit=crop"
              href="/objects"
              variant="rose"
              statusText="On Display"
              statusIcon={Box}
              animationDelay={100}
              footer={
                <div className="flex items-center justify-between">
                  <span>Active Objects</span>
                  <span className="font-medium text-zinc-300">
                    {analytics.objects.active}
                  </span>
                </div>
              }
            />

            <CollectionCard
              title="Loans"
              subtitle={`${analytics.loans.active} Active • ${analytics.loans.total} Total`}
              imageSrc="https://images.unsplash.com/photo-1544211181-70cb8f751430?q=80&w=600&auto=format&fit=crop"
              href="/loans"
              variant="purple"
              statusText="Outgoing Loan"
              statusIcon={Handshake}
              animationDelay={200}
              footer={
                <div className="flex items-center gap-2">
                  <span className="rounded bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 text-[10px] text-purple-300">
                    {analytics.loans.pending} Pending Approval
                  </span>
                </div>
              }
            />

            <CollectionCard
              title="Accessions"
              subtitle={`${analytics.accessions.pending} Pending Review`}
              imageSrc="https://images.unsplash.com/photo-1610701596007-11502861dcfa?q=80&w=600&auto=format&fit=crop"
              href="/accessions"
              variant="cyan"
              statusText="In Storage"
              statusIcon={TrendingUp}
              animationDelay={300}
              footer={
                <div className="flex items-center justify-between">
                  <span>Approved</span>
                  <span className="font-medium text-zinc-300">
                    {analytics.accessions.approved}
                  </span>
                </div>
              }
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-6 shadow-sm backdrop-blur-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-zinc-200">
                  Loans Overview
                </h3>
                <Link href="/loans">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-zinc-400 hover:text-white hover:bg-zinc-800"
                  >
                    View All
                  </Button>
                </Link>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-500" />
                    <span className="text-sm text-zinc-400">Pending</span>
                  </div>
                  <span className="font-semibold text-zinc-200">
                    {analytics.loans.pending}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    <span className="text-sm text-zinc-400">Active</span>
                  </div>
                  <span className="font-semibold text-zinc-200">
                    {analytics.loans.active}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-blue-500" />
                    <span className="text-sm text-zinc-400">Returned</span>
                  </div>
                  <span className="font-semibold text-zinc-200">
                    {analytics.loans.returned}
                  </span>
                </div>
                <div className="border-t border-zinc-800/60 pt-4 mt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ArrowDownRight className="h-4 w-4 text-blue-500" />
                      <span className="text-sm text-zinc-400">Incoming</span>
                    </div>
                    <span className="font-semibold text-zinc-200">
                      {analytics.loans.incoming}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <ArrowUpRight className="h-4 w-4 text-purple-500" />
                      <span className="text-sm text-zinc-400">Outgoing</span>
                    </div>
                    <span className="font-semibold text-zinc-200">
                      {analytics.loans.outgoing}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-6 shadow-sm backdrop-blur-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-zinc-200">
                  Workflows
                </h3>
              </div>
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Link
                      href="/accessions"
                      className="flex items-center gap-2 text-sm font-medium text-zinc-300 hover:text-white hover:underline transition-colors"
                    >
                      <TrendingUp className="h-4 w-4 text-amber-500" />
                      Accessions
                    </Link>
                  </div>
                  <div className="flex gap-4 text-xs text-zinc-500">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {analytics.accessions.pending} pending
                    </span>
                    <span className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3 text-emerald-500" />
                      {analytics.accessions.approved} approved
                    </span>
                    <span className="flex items-center gap-1">
                      <XCircle className="h-3 w-3 text-red-500" />
                      {analytics.accessions.rejected} rejected
                    </span>
                  </div>
                </div>
                <div className="border-t border-zinc-800/60 pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <Link
                      href="/deaccessions"
                      className="flex items-center gap-2 text-sm font-medium text-zinc-300 hover:text-white hover:underline transition-colors"
                    >
                      <FileX className="h-4 w-4 text-red-500" />
                      Deaccessions
                    </Link>
                  </div>
                  <div className="flex gap-4 text-xs text-zinc-500">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {analytics.deaccessions.pending} pending
                    </span>
                    <span className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3 text-emerald-500" />
                      {analytics.deaccessions.approved} approved
                    </span>
                    <span className="flex items-center gap-1">
                      <XCircle className="h-3 w-3 text-red-500" />
                      {analytics.deaccessions.rejected} rejected
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-6 shadow-sm backdrop-blur-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-zinc-200">
                  Recent Activity
                </h3>
              </div>
              {analytics.recentActivity.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-sm text-zinc-500">No recent activity</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {analytics.recentActivity.map((activity) => {
                    const getActivityIcon = () => {
                      switch (activity.type) {
                        case "collection":
                          return (
                            <FileCheck className="h-4 w-4 text-blue-500" />
                          );
                        case "loan":
                          return (
                            <Handshake className="h-4 w-4 text-emerald-500" />
                          );
                        case "accession":
                          return (
                            <TrendingUp className="h-4 w-4 text-amber-500" />
                          );
                        case "deaccession":
                          return <FileX className="h-4 w-4 text-red-500" />;
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
                        className="group flex items-center gap-3 text-sm font-medium transition-all hover:bg-zinc-800/50 p-2 -mx-2 rounded-md"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 border border-zinc-700">
                          {getActivityIcon()}
                        </div>
                        <div className="flex flex-col flex-1 overflow-hidden">
                          <span className="truncate text-zinc-300 group-hover:text-white">
                            {activity.title}
                          </span>
                          {activity.subtitle && (
                            <span className="text-xs text-zinc-500 truncate max-w-[200px]">
                              {activity.subtitle}
                            </span>
                          )}
                        </div>
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
  );
}
