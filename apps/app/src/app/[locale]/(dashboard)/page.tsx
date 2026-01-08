"use client";

import { useOrganization } from "@/components/organization-provider";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import {
  ArrowLeftRight,
  Building2,
  Eye,
  FileCheck,
  FileClock,
  FileX,
  Handshake,
  Package,
  Presentation,
  ScanBarcode,
  Server,
  Settings,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "Just now";
}

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
      <div className="flex h-full w-full items-center justify-center bg-background px-6">
        <p className="text-muted-foreground">Loading analytics...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-background">
      <div className="px-6 py-4 border-b border-border bg-background/50 backdrop-blur-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-muted/30 border border-border rounded-lg p-3 flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-md border border-indigo-500/20">
              <Package className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                Total Objects
              </div>
              <div className="text-lg font-semibold text-foreground">
                {analytics.objects.total.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="bg-muted/30 border border-border rounded-lg p-3 flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-md border border-emerald-500/20">
              <Eye className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                Items on Display
              </div>
              <div className="text-lg font-semibold text-foreground">
                {analytics.objects.active.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="bg-muted/30 border border-border rounded-lg p-3 flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-md border border-amber-500/20">
              <FileClock className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                Pending Accessions
              </div>
              <div className="text-lg font-semibold text-foreground">
                {analytics.accessions.pending}
              </div>
            </div>
          </div>

          <div className="bg-muted/30 border border-border rounded-lg p-3 flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-md border border-blue-500/20">
              <ArrowLeftRight className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                Active Loans
              </div>
              <div className="text-lg font-semibold text-foreground">
                {analytics.loans.active}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-smooth p-6">
        <h3 className="text-xs font-semibold text-muted-foreground mb-4 uppercase tracking-wider">
          Departments & Collections
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
          <Link href="/collections" className="block">
            <div
              className="hover-trigger group relative bg-card border border-border rounded-xl overflow-hidden hover:border-indigo-500/30 hover:ring-1 hover:ring-indigo-500/30 transition-all duration-300 flex flex-col cursor-pointer shadow-lg hover:shadow-2xl hover:shadow-indigo-900/10 animate-enter"
              style={{ animationDelay: "0ms" }}
            >
              <div className="relative aspect-[4/3] bg-muted overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-80 z-10" />
                <img
                  src="https://images.unsplash.com/photo-1577083552431-6e5fd01aa342?q=80&w=600&auto=format&fit=crop"
                  alt="Collections"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out will-change-transform opacity-90 group-hover:opacity-100"
                />

                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-30 pointer-events-none">
                  <span className="bg-background/60 backdrop-blur-md text-foreground text-[11px] font-medium px-3 py-1.5 rounded-full border border-border shadow-xl transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                    View Details
                  </span>
                </div>

                <div className="absolute top-2 right-2 z-20 flex flex-col gap-2 hover-target">
                  <button
                    type="button"
                    onClick={(e) => e.preventDefault()}
                    className="w-8 h-8 bg-background/80 backdrop-blur-md rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground border border-border hover:border-input transition-all shadow-lg"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </div>

                <div className="absolute top-2 left-2 z-20">
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-background/90 backdrop-blur-md rounded-md border border-border shadow-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span className="text-[10px] font-medium text-foreground/80">
                      Active Dept
                    </span>
                  </div>
                </div>

                <div className="absolute bottom-3 left-3 right-3 z-20">
                  <h3 className="text-sm font-semibold text-foreground tracking-tight leading-snug drop-shadow-md">
                    Collection Groups
                  </h3>
                  <p className="text-[11px] text-foreground/70 truncate opacity-90">
                    {analytics.collections.total} Groups Available
                  </p>
                </div>
              </div>

              <div className="p-3 bg-muted/20">
                <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-[10px]">
                  <div className="group/item">
                    <span className="block text-muted-foreground/60 uppercase tracking-widest text-[9px] mb-0.5">
                      Cataloged Items
                    </span>
                    <span className="text-foreground/80 font-medium group-hover/item:text-indigo-400 transition-colors flex items-center gap-1">
                      {analytics.objects.total.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="block text-muted-foreground/60 uppercase tracking-widest text-[9px] mb-0.5">
                      Pending Accessions
                    </span>
                    <span className="font-mono text-muted-foreground">
                      {analytics.accessions.pending} Items
                    </span>
                  </div>
                  <div>
                    <span className="block text-muted-foreground/60 uppercase tracking-widest text-[9px] mb-0.5">
                      Storage
                    </span>
                    <span className="text-muted-foreground flex items-center gap-1 truncate">
                      <Server className="w-3 h-3 text-muted-foreground/60" />
                      All Zones
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="block text-muted-foreground/60 uppercase tracking-widest text-[9px] mb-0.5">
                      Active
                    </span>
                    <span className="text-foreground/80">
                      {analytics.objects.active}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Link>

          <Link href="/objects" className="block">
            <div
              className="hover-trigger group relative bg-card border border-border rounded-xl overflow-hidden hover:border-blue-500/30 hover:ring-1 hover:ring-blue-500/30 transition-all duration-300 flex flex-col cursor-pointer shadow-lg hover:shadow-2xl hover:shadow-blue-900/10 animate-enter"
              style={{ animationDelay: "100ms" }}
            >
              <div className="relative aspect-[4/3] bg-muted overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-80 z-10" />
                <img
                  src="https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?q=80&w=600&auto=format&fit=crop"
                  alt="Objects"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out will-change-transform opacity-90 group-hover:opacity-100"
                />

                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-30 pointer-events-none">
                  <span className="bg-background/60 backdrop-blur-md text-foreground text-[11px] font-medium px-3 py-1.5 rounded-full border border-border shadow-xl transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                    View Details
                  </span>
                </div>

                <div className="absolute top-2 right-2 z-20 flex flex-col gap-2 hover-target">
                  <button
                    type="button"
                    onClick={(e) => e.preventDefault()}
                    className="w-8 h-8 bg-background/80 backdrop-blur-md rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground border border-border hover:border-input transition-all shadow-lg"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </div>

                <div className="absolute top-2 left-2 z-20">
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-background/90 backdrop-blur-md rounded-md border border-blue-500/30 shadow-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    <span className="text-[10px] font-medium text-blue-400 dark:text-blue-300">
                      {analytics.objects.loaned} Loaned
                    </span>
                  </div>
                </div>

                <div className="absolute bottom-3 left-3 right-3 z-20">
                  <h3 className="text-sm font-semibold text-foreground tracking-tight leading-snug drop-shadow-md">
                    Object Catalog
                  </h3>
                  <p className="text-[11px] text-foreground/70 truncate opacity-90">
                    {analytics.objects.active} Active Items
                  </p>
                </div>
              </div>

              <div className="p-3 bg-muted/20">
                <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-[10px]">
                  <div className="group/item">
                    <span className="block text-muted-foreground/60 uppercase tracking-widest text-[9px] mb-0.5">
                      Cataloged Items
                    </span>
                    <span className="text-foreground/80 font-medium group-hover/item:text-blue-400 transition-colors flex items-center gap-1">
                      {analytics.objects.total.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="block text-muted-foreground/60 uppercase tracking-widest text-[9px] mb-0.5">
                      Loans Out
                    </span>
                    <span className="font-mono text-muted-foreground">
                      {analytics.objects.loaned} Items
                    </span>
                  </div>
                  <div>
                    <span className="block text-muted-foreground/60 uppercase tracking-widest text-[9px] mb-0.5">
                      Storage
                    </span>
                    <span className="text-muted-foreground flex items-center gap-1 truncate">
                      <Server className="w-3 h-3 text-muted-foreground/60" />
                      All Zones
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="block text-muted-foreground/60 uppercase tracking-widest text-[9px] mb-0.5">
                      Deaccessioned
                    </span>
                    <span className="text-foreground/80">
                      {analytics.objects.deaccessioned}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Link>

          <div
            className="hover-trigger group relative bg-card border border-dashed border-border rounded-xl overflow-hidden hover:border-input transition-all duration-300 flex flex-col cursor-pointer hover:bg-muted/40 animate-enter"
            style={{ animationDelay: "200ms" }}
          >
            <div className="relative aspect-[4/3] flex items-center justify-center flex-col gap-3">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center group-hover:bg-muted/80 transition-colors">
                <Presentation className="w-6 h-6 text-muted-foreground group-hover:text-foreground" />
              </div>
              <div className="text-center">
                <h3 className="text-sm font-medium text-foreground/80">
                  New Exhibition
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Draft a proposal
                </p>
              </div>
            </div>
            <div className="p-3 border-t border-border bg-muted/10">
              <div className="text-[10px] text-center text-muted-foreground">
                Curatorial Team
              </div>
            </div>
          </div>

          <Link href="/accessions" className="block">
            <div
              className="hover-trigger group relative bg-card border border-border rounded-xl overflow-hidden hover:border-amber-500/30 hover:ring-1 hover:ring-amber-500/30 transition-all duration-300 flex flex-col cursor-pointer shadow-lg animate-enter"
              style={{ animationDelay: "300ms" }}
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
          <h3 className="text-xs font-semibold text-muted-foreground mb-4 uppercase tracking-wider">
            Recent Activity Log
          </h3>
          <div className="rounded-xl border border-border overflow-hidden bg-card">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 text-muted-foreground font-medium">
                <tr>
                  <th className="px-4 py-3 font-medium">Object / Collection</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {analytics.recentActivity.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      No recent activity
                    </td>
                  </tr>
                ) : (
                  analytics.recentActivity.map((activity) => {
                    const getActivityIcon = () => {
                      switch (activity.type) {
                        case "collection":
                          return <FileCheck className="w-4 h-4" />;
                        case "loan":
                          return <Handshake className="w-4 h-4" />;
                        case "accession":
                          return <TrendingUp className="w-4 h-4" />;
                        case "deaccession":
                          return <FileX className="w-4 h-4" />;
                        default:
                          return <FileCheck className="w-4 h-4" />;
                      }
                    };

                    const getActivityBadgeColor = () => {
                      switch (activity.type) {
                        case "collection":
                          return "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
                        case "loan":
                          return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
                        case "accession":
                          return "bg-amber-500/10 text-amber-400 border-amber-500/20";
                        case "deaccession":
                          return "bg-red-500/10 text-red-400 border-red-500/20";
                        default:
                          return "bg-muted text-muted-foreground border-border";
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
                        default:
                          return "#";
                      }
                    };

                    const getInitials = () => {
                      switch (activity.type) {
                        case "collection":
                          return "OB";
                        case "loan":
                          return "LN";
                        case "accession":
                          return "AC";
                        case "deaccession":
                          return "DA";
                        default:
                          return "??";
                      }
                    };

                    const handleNavigate = () => {
                      window.location.href = getActivityLink();
                    };

                    return (
                      <tr
                        key={`${activity.type}-${activity.id}`}
                        className="hover:bg-muted/40 transition-colors cursor-pointer"
                        onClick={handleNavigate}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleNavigate();
                          }
                        }}
                        tabIndex={0}
                        role="button"
                      >
                        <td className="px-4 py-3 text-foreground/80">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded bg-muted flex items-center justify-center text-[10px] text-muted-foreground">
                              {getInitials()}
                            </div>
                            {activity.title}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] border ${getActivityBadgeColor()}`}
                          >
                            {activity.subtitle || activity.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          System
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground font-mono text-[10px]">
                          {formatRelativeTime(activity.timestamp)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
