"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Badge } from "@v1/ui/badge";
import { useQuery } from "convex/react";
import Link from "next/link";
import { DashboardListPageSkeleton } from "@/components/dashboard-list-page-skeleton";
import { useOrganization } from "@/components/organization-provider";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { TransitPhysicalHandoffsPanel } from "./_components/transit-physical-handoffs-panel";

const statusColor: Record<string, string> = {
  draft: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  scheduled: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  in_transit: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  out_for_delivery: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  delivered: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  delayed: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  held: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  returned: "bg-primary/10 text-primary border-primary/20",
  cancelled: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

export function TransitDetailClient({
  transitRecordId,
}: {
  transitRecordId: Id<"transitRecords">;
}) {
  const locale = useCurrentLocale();
  const t = useScopedI18n("untranslatedDashboard.transit");
  const th = useScopedI18n("untranslatedDashboard.transit.handoffs");
  const { currentOrganizationId, isLoading } = useOrganization();

  const transit = useQuery(api.transit.getTransitRecord, { transitRecordId });

  if (isLoading || transit === undefined) {
    return (
      <DashboardListPageSkeleton
        layout="list"
        filtersCount={0}
        actionsCount={0}
      />
    );
  }

  if (transit === null) {
    return (
      <div className="p-8 text-sm text-muted-foreground">{th("notFound")}</div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
      <div>
        <Link
          href={`/${locale}/transit`}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {th("backToList")}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-foreground">
            {transit.transitNumber}
          </h1>
          <Badge
            variant="outline"
            className={
              statusColor[transit.status] ??
              "border-border text-muted-foreground"
            }
          >
            {t(`statusOptions.${transit.status}`)}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {transit.originName} → {transit.destinationName} · {transit.carrier}
        </p>
        {transit.loan ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {th("linkedLoan")}{" "}
            <Link
              href={`/${locale}/loans/${transit.loan._id}`}
              className="text-primary hover:underline"
            >
              {transit.loan.loanNumber}
            </Link>
          </p>
        ) : null}
        {transit.exhibition ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {th("linkedExhibition")}{" "}
            <Link
              href={`/${locale}/exhibitions/${transit.exhibition._id}`}
              className="text-primary hover:underline"
            >
              {transit.exhibition.title}
            </Link>
          </p>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">
        {th("carrierVsReceiptHint")}
      </p>

      {currentOrganizationId ? (
        <TransitPhysicalHandoffsPanel
          transitRecordId={transitRecordId}
          organizationId={currentOrganizationId as Id<"organizations">}
          defaultDestinationLocationId={transit.destinationLocationId}
          linkedExhibitionId={transit.exhibitionId}
        />
      ) : null}
    </div>
  );
}
