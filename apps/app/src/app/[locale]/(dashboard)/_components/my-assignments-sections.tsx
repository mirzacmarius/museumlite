"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Tooltip, TooltipContent, TooltipTrigger } from "@v1/ui/tooltip";
import { cn } from "@v1/ui/utils";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  ArrowRight,
  FileCheck,
  FileX,
  ImageMinus,
  LayoutGrid,
  type LucideIcon,
  Microscope,
  OctagonAlert,
  Package,
  Presentation,
  Truck,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useState } from "react";
import { ClientRelativeTime } from "@/components/client-date";
import { useCurrentLocale, useI18n } from "@/locales/client";
import { CARD_CLASS_NAME, WorkSection } from "./my-work-sections";
import {
  OVERVIEW_CARD_GAP_PX,
  OVERVIEW_CARD_MIN_WIDTH_PX,
} from "./overview-card";

type MyAssignments = FunctionReturnType<
  typeof api.assignments.listMyAssignments
>;
type PendingApproval = MyAssignments["pendingApprovals"][number];
export type ApprovalType = PendingApproval["type"];
type ObjectStatus = MyAssignments["myCatalogedItems"][number]["status"];

const ASSIGNMENTS_LIMIT = 50;
const MAX_CATALOGED_CARDS = 10;
const IMAGE_DELETIONS_HREF = "/image-deletions";

interface ApprovalTypeConfig {
  icon: LucideIcon;
  href: string;
  pendingHref: (asOf: number) => string;
  /** Where one pending item opens; its record page under `href` by default. */
  itemHref?: (id: string) => string;
  accentClassName: string;
  className: string;
}

export const APPROVAL_TYPES = {
  accession: {
    icon: FileCheck,
    href: "/accessions",
    pendingHref: () => "/accessions?status=pending",
    accentClassName: "text-primary",
    className: "border-primary/30 bg-primary/10 text-primary",
  },
  deaccession: {
    icon: FileX,
    href: "/deaccessions",
    pendingHref: () => "/deaccessions?status=pending",
    accentClassName: "text-rose-400",
    className: "border-rose-500/30 bg-rose-500/10 text-rose-400",
  },
  loan: {
    icon: Truck,
    href: "/loans",
    pendingHref: () => "/loans?status=pending",
    accentClassName: "text-emerald-400",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  },
  exhibition: {
    icon: Presentation,
    href: "/exhibitions",
    pendingHref: (asOf: number) =>
      `/exhibitions?lifecycle=proposed&asOf=${asOf}`,
    accentClassName: "text-purple-400",
    className: "border-purple-500/30 bg-purple-500/10 text-purple-400",
  },
  conservation: {
    icon: Microscope,
    href: "/conservation",
    pendingHref: () => "/conservation?status=proposed",
    accentClassName: "text-cyan-400",
    className: "border-cyan-500/30 bg-cyan-500/10 text-cyan-400",
  },
  imageDeletion: {
    icon: ImageMinus,
    href: IMAGE_DELETIONS_HREF,
    pendingHref: () => IMAGE_DELETIONS_HREF,
    itemHref: () => IMAGE_DELETIONS_HREF,
    accentClassName: "text-orange-400",
    className: "border-orange-500/30 bg-orange-500/10 text-orange-400",
  },
} satisfies Record<ApprovalType, ApprovalTypeConfig>;

const STATUS_DOT_CLASS_NAMES = {
  active: "bg-emerald-400",
  loaned: "bg-purple-400",
  deaccessioned: "bg-muted-foreground",
  archived: "bg-amber-400",
  deleted: "bg-red-400",
} satisfies Record<ObjectStatus, string>;

export function useMyAssignments(organizationId: Id<"organizations">) {
  return useQuery(api.assignments.listMyAssignments, {
    organizationId,
    limit: ASSIGNMENTS_LIMIT,
  });
}

export function SectionLink({
  href,
  children,
}: {
  href: string;
  children: string;
}) {
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

export function PendingApprovalCard({ item }: { item: PendingApproval }) {
  const locale = useCurrentLocale();
  const t = useI18n();
  const config: ApprovalTypeConfig = APPROVAL_TYPES[item.type];
  const Icon = config.icon;

  return (
    <li>
      <Link
        href={config.itemHref?.(item._id) ?? `${config.href}/${item._id}`}
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
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
              {item.title}
            </span>
            {item.urgency === "high" ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    role="img"
                    aria-label={t("assignmentsPage.card.urgent")}
                    className="shrink-0 text-rose-400"
                  >
                    <OctagonAlert className="size-3.5" aria-hidden="true" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {t("assignmentsPage.card.urgent")}
                </TooltipContent>
              </Tooltip>
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
  status,
}: {
  id: Id<"collections">;
  title: string;
  accessionNumber: string;
  thumbnailUrl?: string;
  timestamp: number;
  status: ObjectStatus;
}) {
  const locale = useCurrentLocale();
  const t = useI18n();
  const statusLabel = t(`assignmentsPage.status.${status}`);

  return (
    <li>
      <Link
        href={`/objects/${id}`}
        className={cn(CARD_CLASS_NAME, "gap-2 px-2.5 py-2")}
      >
        <span className="relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
          {thumbnailUrl ? (
            <Image
              src={thumbnailUrl}
              alt=""
              fill
              sizes="32px"
              className="object-cover"
            />
          ) : (
            <Package className="size-4 text-muted-foreground" />
          )}
        </span>
        <span className="min-w-0 flex-1 leading-4">
          <span className="flex items-center gap-1.5">
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
              {title}
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  role="img"
                  aria-label={statusLabel}
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    STATUS_DOT_CLASS_NAMES[status],
                  )}
                />
              </TooltipTrigger>
              <TooltipContent>{statusLabel}</TooltipContent>
            </Tooltip>
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {accessionNumber}
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">
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

/** How many cards of the minimum width fit in one row of the observed list. */
function useCardsPerRow() {
  const [cardsPerRow, setCardsPerRow] = useState(5);
  const listRef = useCallback((list: HTMLUListElement | null) => {
    if (!list) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const fit = Math.floor(
        (entry.contentRect.width + OVERVIEW_CARD_GAP_PX) /
          (OVERVIEW_CARD_MIN_WIDTH_PX + OVERVIEW_CARD_GAP_PX),
      );
      setCardsPerRow(Math.min(MAX_CATALOGED_CARDS, Math.max(1, fit)));
    });
    observer.observe(list);
    return () => observer.disconnect();
  }, []);
  return [listRef, cardsPerRow] as const;
}

/** Objects the viewer cataloged. */
export function CatalogedByYouSection({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const t = useI18n();
  const assignments = useMyAssignments(organizationId);
  const [listRef, cardsPerRow] = useCardsPerRow();
  if (!assignments || assignments.myCatalogedItems.length === 0) return null;
  const { myCatalogedItems, stats } = assignments;

  return (
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
      <ul
        ref={listRef}
        className="grid gap-2"
        style={{
          gridTemplateColumns: `repeat(${cardsPerRow}, minmax(0, 1fr))`,
        }}
      >
        {myCatalogedItems.slice(0, cardsPerRow).map((item) => (
          <ObjectCard
            key={item._id}
            id={item._id}
            title={item.title}
            accessionNumber={item.accessionNumber}
            thumbnailUrl={item.thumbnailUrl}
            timestamp={item.catalogedAt}
            status={item.status}
          />
        ))}
      </ul>
    </WorkSection>
  );
}
