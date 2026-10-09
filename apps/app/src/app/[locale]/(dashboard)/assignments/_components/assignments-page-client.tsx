"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { cn } from "@v1/ui/utils";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock,
  ExternalLink,
  FileCheck,
  FileX,
  History,
  LayoutGrid,
  Microscope,
  Package,
  Presentation,
  Truck,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ClientRelativeTime } from "@/components/client-date";
import { useCurrentLocale, useI18n } from "@/locales/client";
import { MyWorkSections } from "./my-work-sections";

interface PendingApproval {
  _id: string;
  type: "accession" | "deaccession" | "loan" | "exhibition" | "conservation";
  title: string;
  subtitle?: ReactNode;
  status: string;
  workflowStep?: number;
  createdAt: number;
  urgency: "low" | "medium" | "high";
  slaDueAt?: number;
  slaBreached?: boolean;
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
  organizationId,
}: AssignmentsPageClientProps) {
  const locale = useCurrentLocale();
  const t = useI18n();
  const { pendingApprovals, recentlyModified, myCatalogedItems, stats } =
    assignments;

  return (
    <div className="flex size-full flex-col bg-background">
      <header className="h-14 border-b border-border flex items-center justify-between px-6 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <ClipboardList className="size-5 text-primary" />
          <h1 className="text-lg font-semibold text-foreground">
            {t("caseTasks.myWork.title")}
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-6 text-xs">
            <div className="flex items-center gap-2">
              <div className="flex size-6 items-center justify-center rounded-full bg-amber-500/10 text-amber-400">
                <Clock className="size-3.5" />
              </div>
              <span className="text-muted-foreground">
                {stats.totalPendingApprovals}{" "}
                {t("assignmentsPage.stats.pending")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex size-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                <CheckCircle2 className="size-3.5" />
              </div>
              <span className="text-muted-foreground">
                {stats.totalCatalogedItems}{" "}
                {t("assignmentsPage.stats.cataloged")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex size-6 items-center justify-center rounded-full bg-blue-500/10 text-blue-400">
                <History className="size-3.5" />
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
          <p className="text-sm text-muted-foreground">
            {t("caseTasks.myWork.description")}
          </p>
          <MyWorkSections organizationId={organizationId} />

          {pendingApprovals.length > 0 && (
            <section>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="size-4 text-amber-400" />
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
                  <History className="size-4 text-blue-400" />
                  <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
                    {t("assignmentsPage.sections.recentlyModified")}
                  </h2>
                </div>
                <Link
                  href="/activity"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground/80 transition-colors"
                >
                  {t("assignmentsPage.links.viewAllActivity")}
                  <ArrowRight className="size-3" />
                </Link>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {recentlyModified.map((item) => (
                  <CollectionCard
                    key={item._id}
                    item={item}
                    subtitle={
                      <>
                        {t("untranslatedDashboard.assignments.modifiedPrefix")}{" "}
                        <ClientRelativeTime
                          timestamp={item.lastModifiedAt}
                          locale={locale}
                          options={{ addSuffix: true }}
                        />
                      </>
                    }
                  />
                ))}
              </div>
            </section>
          )}

          {myCatalogedItems.length > 0 && (
            <section>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <LayoutGrid className="size-4 text-emerald-400" />
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
                  <ArrowRight className="size-3" />
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
                    subtitle={
                      <>
                        {t("untranslatedDashboard.assignments.catalogedPrefix")}{" "}
                        <ClientRelativeTime
                          timestamp={item.catalogedAt}
                          locale={locale}
                          options={{ addSuffix: true }}
                        />
                      </>
                    }
                    status={item.status}
                  />
                ))}
              </div>
            </section>
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
    deaccession: {
      icon: FileX,
      color: "rose",
      href: "/deaccessions",
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
  const caseDetailHref = `${config.href}/${item._id}`;

  const urgencyColors = {
    low: "border-border hover:border-border",
    medium: "border-amber-500/30 hover:border-amber-500/50",
    high: "border-rose-500/30 hover:border-rose-500/50 bg-rose-500/5",
  };

  return (
    <Link href={caseDetailHref}>
      <div
        className={cn(
          "group relative rounded-xl border bg-card p-4 transition-all duration-300 hover:bg-muted/60 cursor-pointer shadow-lg hover:shadow-2xl",
          urgencyColors[item.urgency],
        )}
      >
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-lg border",
              item.type === "accession" &&
                "bg-primary/10 border-primary/30 text-primary",
              item.type === "loan" &&
                "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
              item.type === "exhibition" &&
                "bg-purple-500/10 border-purple-500/30 text-purple-400",
              item.type === "conservation" &&
                "bg-cyan-500/10 border-cyan-500/30 text-cyan-400",
            )}
          >
            <Icon className="size-5" />
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
            <h3 className="text-sm font-medium text-foreground truncate">
              {item.title}
            </h3>
            {item.subtitle && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {item.subtitle}
              </p>
            )}
          </div>

          <ExternalLink className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/50 pt-3">
          <span>
            <ClientRelativeTime
              timestamp={item.createdAt}
              locale={locale}
              options={{ addSuffix: true }}
            />
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
  subtitle?: ReactNode;
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
            <Image
              src={item.thumbnailUrl}
              alt={item.title}
              fill
              sizes="(max-width: 768px) 100vw, 400px"
              className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out opacity-60 group-hover:opacity-80"
            />
          ) : (
            <div className="size-full flex items-center justify-center">
              <Package className="size-8 text-muted-foreground" />
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
            <ExternalLink className="size-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
      </div>
    </Link>
  );
}
