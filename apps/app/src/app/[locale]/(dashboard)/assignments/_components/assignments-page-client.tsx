"use client";

import { formatDistanceLocale } from "@/lib/format-date";
import { useCurrentLocale, useI18n } from "@/locales/client";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/utils";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock,
  ExternalLink,
  FileCheck,
  History,
  Inbox,
  LayoutGrid,
  Microscope,
  Package,
  Presentation,
  Truck,
} from "lucide-react";
import Link from "next/link";

interface PendingApproval {
  _id: string;
  type: "accession" | "loan" | "exhibition" | "conservation";
  title: string;
  subtitle?: string;
  status: string;
  workflowStep?: number;
  createdAt: number;
  urgency: "low" | "medium" | "high";
}

interface RecentlyModified {
  _id: Id<"collections">;
  title: string;
  accessionNumber: string;
  lastModifiedAt: number;
  thumbnailUrl?: string;
}

interface CatalogedItem {
  _id: Id<"collections">;
  title: string;
  accessionNumber: string;
  catalogedAt: number;
  thumbnailUrl?: string;
  status: "active" | "loaned" | "deaccessioned" | "archived" | "deleted";
}

interface AssignmentsData {
  pendingApprovals: PendingApproval[];
  recentlyModified: RecentlyModified[];
  myCatalogedItems: CatalogedItem[];
  stats: {
    totalPendingApprovals: number;
    totalCatalogedItems: number;
    itemsModifiedThisWeek: number;
  };
}

interface AssignmentsPageClientProps {
  assignments: AssignmentsData;
  organizationId: Id<"organizations">;
}

export function AssignmentsPageClient({
  assignments,
}: AssignmentsPageClientProps) {
  const locale = useCurrentLocale();
  const t = useI18n();
  const { pendingApprovals, recentlyModified, myCatalogedItems, stats } =
    assignments;

  return (
    <div className="flex h-full w-full flex-col bg-background">
      <header className="h-14 border-b border-border flex items-center justify-between px-6 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-5 w-5 text-indigo-400" />
          <h1 className="text-lg font-semibold text-white">
            {t("assignmentsPage.title")}
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-6 text-xs">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/10 text-amber-400">
                <Clock className="h-3.5 w-3.5" />
              </div>
              <span className="text-muted-foreground">
                {stats.totalPendingApprovals}{" "}
                {t("assignmentsPage.stats.pending")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
              </div>
              <span className="text-muted-foreground">
                {stats.totalCatalogedItems}{" "}
                {t("assignmentsPage.stats.cataloged")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/10 text-blue-400">
                <History className="h-3.5 w-3.5" />
              </div>
              <span className="text-muted-foreground">
                {stats.itemsModifiedThisWeek}{" "}
                {t("assignmentsPage.stats.thisWeek")}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-screen-xl space-y-8">
          {pendingApprovals.length > 0 && (
            <section>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-400" />
                  <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
                    {t("assignmentsPage.sections.pendingApproval")}
                  </h2>
                  <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400">
                    {pendingApprovals.length}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {pendingApprovals.map((item) => (
                  <PendingApprovalCard key={item._id} item={item} />
                ))}
              </div>
            </section>
          )}

          {recentlyModified.length > 0 && (
            <section>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-blue-400" />
                  <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
                    {t("assignmentsPage.sections.recentlyModified")}
                  </h2>
                </div>
                <Link
                  href="/activity"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground/80 transition-colors"
                >
                  {t("assignmentsPage.links.viewAllActivity")}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {recentlyModified.map((item) => (
                  <CollectionCard
                    key={item._id}
                    item={item}
                    subtitle={`Modified ${formatDistanceLocale(new Date(item.lastModifiedAt), locale, { addSuffix: true })}`}
                  />
                ))}
              </div>
            </section>
          )}

          {myCatalogedItems.length > 0 && (
            <section>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <LayoutGrid className="h-4 w-4 text-emerald-400" />
                  <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
                    {t("assignmentsPage.sections.catalogedByYou")}
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    ({stats.totalCatalogedItems}{" "}
                    {t("assignmentsPage.stats.total")})
                  </span>
                </div>
                <Link
                  href="/objects"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground/80 transition-colors"
                >
                  {t("assignmentsPage.links.viewAllObjects")}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {myCatalogedItems.map((item) => (
                  <CollectionCard
                    key={item._id}
                    item={{
                      _id: item._id,
                      title: item.title,
                      accessionNumber: item.accessionNumber,
                      thumbnailUrl: item.thumbnailUrl,
                      lastModifiedAt: item.catalogedAt,
                    }}
                    subtitle={`Cataloged ${formatDistanceLocale(new Date(item.catalogedAt), locale, { addSuffix: true })}`}
                    status={item.status}
                  />
                ))}
              </div>
            </section>
          )}

          {pendingApprovals.length === 0 &&
            recentlyModified.length === 0 &&
            myCatalogedItems.length === 0 && (
              <div className="flex h-64 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-muted/20">
                <Inbox className="h-12 w-12 text-muted-foreground" />
                <div className="text-center">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    {t("assignmentsPage.empty.title")}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("assignmentsPage.empty.description")}
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/objects/new">
                    {t("assignmentsPage.empty.catalogNew")}
                  </Link>
                </Button>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

function PendingApprovalCard({ item }: { item: PendingApproval }) {
  const locale = useCurrentLocale();
  const t = useI18n();
  const typeConfig = {
    accession: {
      icon: FileCheck,
      color: "indigo",
      href: "/accessions",
    },
    loan: {
      icon: Truck,
      color: "emerald",
      href: "/loans",
    },
    exhibition: {
      icon: Presentation,
      color: "purple",
      href: "/exhibitions",
    },
    conservation: {
      icon: Microscope,
      color: "cyan",
      href: "/conservation",
    },
  };

  const config = typeConfig[item.type];
  const Icon = config.icon;

  const urgencyColors = {
    low: "border-border hover:border-border",
    medium: "border-amber-500/30 hover:border-amber-500/50",
    high: "border-rose-500/30 hover:border-rose-500/50 bg-rose-500/5",
  };

  return (
    <Link href={config.href}>
      <div
        className={cn(
          "group relative rounded-xl border bg-card p-4 transition-all duration-300 hover:bg-muted/60 cursor-pointer shadow-lg hover:shadow-2xl",
          urgencyColors[item.urgency],
        )}
      >
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border",
              item.type === "accession" &&
                "bg-indigo-500/10 border-indigo-500/30 text-indigo-400",
              item.type === "loan" &&
                "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
              item.type === "exhibition" &&
                "bg-purple-500/10 border-purple-500/30 text-purple-400",
              item.type === "conservation" &&
                "bg-cyan-500/10 border-cyan-500/30 text-cyan-400",
            )}
          >
            <Icon className="h-5 w-5" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {item.type}
              </span>
              {item.urgency === "high" && (
                <span className="rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-medium text-rose-400">
                  {t("assignmentsPage.card.urgent")}
                </span>
              )}
            </div>
            <h3 className="text-sm font-medium text-white truncate group-hover:text-foreground">
              {item.title}
            </h3>
            {item.subtitle && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {item.subtitle}
              </p>
            )}
          </div>

          <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/50 pt-3">
          <span>
            {formatDistanceLocale(new Date(item.createdAt), locale, {
              addSuffix: true,
            })}
          </span>
          {item.workflowStep !== undefined && (
            <span className="text-muted-foreground">
              {t("assignmentsPage.card.step")} {item.workflowStep}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function CollectionCard({
  item,
  subtitle,
  status,
}: {
  item: RecentlyModified;
  subtitle?: string;
  status?: "active" | "loaned" | "deaccessioned" | "archived" | "deleted";
}) {
  const t = useI18n();
  const statusColors: Record<string, string> = {
    active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    loaned: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    deaccessioned: "bg-muted text-muted-foreground border-border",
    archived: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    deleted: "bg-red-500/10 text-red-400 border-red-500/30",
  };

  return (
    <Link href={`/objects/${item._id}`}>
      <div className="hover-trigger group relative rounded-xl border border-border bg-card overflow-hidden transition-all duration-300 hover:border-border hover:bg-muted/60 cursor-pointer shadow-lg hover:shadow-2xl">
        <div className="relative aspect-[2/1] bg-muted overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-90 z-10" />
          {item.thumbnailUrl ? (
            <img
              src={item.thumbnailUrl}
              alt={item.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out opacity-60 group-hover:opacity-80"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
          )}

          {status && (
            <div className="absolute top-2 left-2 z-20">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium backdrop-blur-md bg-background/90",
                  statusColors[status],
                )}
              >
                {t(
                  `assignmentsPage.status.${status}` as "assignmentsPage.status.active",
                )}
              </span>
            </div>
          )}

          <div className="absolute bottom-3 left-3 right-3 z-20">
            <h3 className="text-sm font-semibold text-white tracking-tight leading-snug drop-shadow-md truncate">
              {item.title}
            </h3>
            <p className="text-[11px] text-foreground/80 truncate opacity-90">
              {item.accessionNumber}
            </p>
          </div>
        </div>

        <div className="p-3 bg-muted/20">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/50 pt-2">
            <span>{subtitle}</span>
            <ExternalLink className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
      </div>
    </Link>
  );
}
