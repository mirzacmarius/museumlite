"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { cn } from "@v1/ui/utils";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  AlertCircle,
  ArrowRight,
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
import {
  CARD_CLASS_NAME,
  CARD_GRID_CLASS_NAME,
  WorkSection,
} from "./my-work-sections";

type MyAssignments = FunctionReturnType<
  typeof api.assignments.listMyAssignments
>;
type PendingApproval = MyAssignments["pendingApprovals"][number];
type ObjectStatus = MyAssignments["myCatalogedItems"][number]["status"];

const ASSIGNMENTS_LIMIT = 50;
const VISIBLE_RECENT_OBJECTS = 8;

const APPROVAL_TYPES = {
  accession: {
    icon: FileCheck,
    href: "/accessions",
    className: "border-primary/30 bg-primary/10 text-primary",
  },
  deaccession: {
    icon: FileX,
    href: "/deaccessions",
    className: "border-rose-500/30 bg-rose-500/10 text-rose-400",
  },
  loan: {
    icon: Truck,
    href: "/loans",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  },
  exhibition: {
    icon: Presentation,
    href: "/exhibitions",
    className: "border-purple-500/30 bg-purple-500/10 text-purple-400",
  },
  conservation: {
    icon: Microscope,
    href: "/conservation",
    className: "border-cyan-500/30 bg-cyan-500/10 text-cyan-400",
  },
} satisfies Record<PendingApproval["type"], unknown>;

const STATUS_CLASS_NAMES = {
  active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  loaned: "border-purple-500/30 bg-purple-500/10 text-purple-400",
  deaccessioned: "border-border bg-muted text-muted-foreground",
  archived: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  deleted: "border-red-500/30 bg-red-500/10 text-red-400",
} satisfies Record<ObjectStatus, string>;

function useMyAssignments(organizationId: Id<"organizations">) {
  return useQuery(api.assignments.listMyAssignments, {
    organizationId,
    limit: ASSIGNMENTS_LIMIT,
  });
}

function SectionLink({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground/80"
    >
      {children}
      <ArrowRight className="size-3" />
    </Link>
  );
}

function PendingApprovalCard({ item }: { item: PendingApproval }) {
  const locale = useCurrentLocale();
  const t = useI18n();
  const config = APPROVAL_TYPES[item.type];
  const Icon = config.icon;

  return (
    <li>
      <Link
        href={`${config.href}/${item._id}`}
        className={cn(
          CARD_CLASS_NAME,
          item.urgency === "high" && "border-rose-500/30 bg-rose-500/5",
        )}
      >
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-md border",
            config.className,
          )}
        >
          <Icon className="size-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium text-foreground">
              {item.title}
            </span>
            {item.urgency === "high" ? (
              <span className="shrink-0 rounded bg-rose-500/10 px-1 py-0.5 text-[10px] font-medium text-rose-400">
                {t("assignmentsPage.card.urgent")}
              </span>
            ) : null}
          </span>
          {item.subtitle ? (
            <span className="block truncate text-xs text-muted-foreground">
              {item.subtitle}
            </span>
          ) : null}
          <span className="block truncate text-[11px] text-muted-foreground">
            <ClientRelativeTime
              timestamp={item.createdAt}
              locale={locale}
              options={{ addSuffix: true }}
            />
            {item.workflowStep !== undefined
              ? ` · ${t("assignmentsPage.card.step")} ${item.workflowStep}`
              : null}
          </span>
        </span>
      </Link>
    </li>
  );
}

function ObjectCard({
  id,
  title,
  accessionNumber,
  thumbnailUrl,
  timestamp,
  timestampPrefix,
  status,
}: {
  id: Id<"collections">;
  title: string;
  accessionNumber: string;
  thumbnailUrl?: string;
  timestamp: number;
  timestampPrefix: string;
  status?: ObjectStatus;
}) {
  const locale = useCurrentLocale();
  const t = useI18n();

  return (
    <li>
      <Link href={`/objects/${id}`} className={CARD_CLASS_NAME}>
        <span className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
          {thumbnailUrl ? (
            <Image
              src={thumbnailUrl}
              alt=""
              fill
              sizes="36px"
              className="object-cover"
            />
          ) : (
            <Package className="size-4 text-muted-foreground" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium text-foreground">
              {title}
            </span>
            {status ? (
              <span
                className={cn(
                  "shrink-0 rounded border px-1 py-px text-[10px] font-medium",
                  STATUS_CLASS_NAMES[status],
                )}
              >
                {t(`assignmentsPage.status.${status}`)}
              </span>
            ) : null}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {accessionNumber}
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {timestampPrefix}{" "}
            <ClientRelativeTime
              timestamp={timestamp}
              locale={locale}
              options={{ addSuffix: true }}
            />
          </span>
        </span>
      </Link>
    </li>
  );
}

function CardGrid({ children }: { children: ReactNode }) {
  return <ul className={CARD_GRID_CLASS_NAME}>{children}</ul>;
}

/** Workflow cases waiting for the viewer's approval at their current step. */
export function PendingApprovalsSection({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const t = useI18n();
  const assignments = useMyAssignments(organizationId);
  if (!assignments || assignments.pendingApprovals.length === 0) return null;

  return (
    <WorkSection
      icon={<AlertCircle className="size-4 text-amber-400" />}
      title={t("assignmentsPage.sections.pendingApproval")}
      badge={
        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium tabular-nums text-amber-400">
          {assignments.stats.totalPendingApprovals}
        </span>
      }
    >
      <CardGrid>
        {assignments.pendingApprovals.map((item) => (
          <PendingApprovalCard key={item._id} item={item} />
        ))}
      </CardGrid>
    </WorkSection>
  );
}

/** Objects the viewer recently modified or cataloged. */
export function MyRecentObjectsSections({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const t = useI18n();
  const assignments = useMyAssignments(organizationId);
  if (!assignments) return null;
  const { recentlyModified, myCatalogedItems, stats } = assignments;

  return (
    <>
      {recentlyModified.length > 0 ? (
        <WorkSection
          icon={<History className="size-4 text-blue-400" />}
          title={t("assignmentsPage.sections.recentlyModified")}
          badge={
            <span className="text-xs text-muted-foreground">
              {stats.itemsModifiedThisWeek}{" "}
              {t("assignmentsPage.stats.thisWeek")}
            </span>
          }
          action={
            <SectionLink href="/activity">
              {t("assignmentsPage.links.viewAllActivity")}
            </SectionLink>
          }
        >
          <CardGrid>
            {recentlyModified.slice(0, VISIBLE_RECENT_OBJECTS).map((item) => (
              <ObjectCard
                key={item._id}
                id={item._id}
                title={item.title}
                accessionNumber={item.accessionNumber}
                thumbnailUrl={item.thumbnailUrl}
                timestamp={item.lastModifiedAt}
                timestampPrefix={t(
                  "untranslatedDashboard.assignments.modifiedPrefix",
                )}
              />
            ))}
          </CardGrid>
        </WorkSection>
      ) : null}

      {myCatalogedItems.length > 0 ? (
        <WorkSection
          icon={<LayoutGrid className="size-4 text-emerald-400" />}
          title={t("assignmentsPage.sections.catalogedByYou")}
          badge={
            <span className="text-xs tabular-nums text-muted-foreground">
              {stats.totalCatalogedItems}
            </span>
          }
          action={
            <SectionLink href="/objects">
              {t("assignmentsPage.links.viewAllObjects")}
            </SectionLink>
          }
        >
          <CardGrid>
            {myCatalogedItems.slice(0, VISIBLE_RECENT_OBJECTS).map((item) => (
              <ObjectCard
                key={item._id}
                id={item._id}
                title={item.title}
                accessionNumber={item.accessionNumber}
                thumbnailUrl={item.thumbnailUrl}
                timestamp={item.catalogedAt}
                timestampPrefix={t(
                  "untranslatedDashboard.assignments.catalogedPrefix",
                )}
                status={item.status}
              />
            ))}
          </CardGrid>
        </WorkSection>
      ) : null}
    </>
  );
}
