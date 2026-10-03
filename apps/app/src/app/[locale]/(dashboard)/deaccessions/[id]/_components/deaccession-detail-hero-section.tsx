"use client";

import { ClientDateFns } from "@/components/client-date";
import { useI18n } from "@/locales/client";
import { DeaccessionDetailStatusBadge } from "./deaccession-detail-status-badge";
import { formatDeaccessionMethodLabel } from "./deaccession-detail-types";
import type { DeaccessionDetailViewProps } from "./deaccession-detail-view-props";
export function DeaccessionDetailHeroSection({
  deaccession,
  locale,
  actionLabel,
  collection,
  collectionStatusLabel,
  reviewStateLabel,
}: Pick<
  DeaccessionDetailViewProps,
  | "deaccession"
  | "locale"
  | "actionLabel"
  | "collection"
  | "collectionStatusLabel"
  | "reviewStateLabel"
>) {
  const tRoot = useI18n();
  return (
    <div className="border-b border-border/60 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_38%),linear-gradient(135deg,rgba(255,255,255,0.04),transparent_55%)] px-5 py-5 sm:px-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground/75">
            {tRoot("untranslatedRecords.deaccessions.detail.reviewTitle")}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {deaccession.deaccessionNumber}
            </h1>
            <DeaccessionDetailStatusBadge status={deaccession.status} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <ClientDateFns
              timestamp={deaccession.dateDeaccessioned}
              format="MMMM d, yyyy"
              locale={locale}
            />
            <span className="size-1 rounded-full bg-muted-foreground/50" />
            <span>{actionLabel}</span>
            <span className="size-1 rounded-full bg-muted-foreground/50" />
            <span>
              {formatDeaccessionMethodLabel(deaccession.method, tRoot)}
            </span>
            {collection ? (
              <>
                <span className="size-1 rounded-full bg-muted-foreground/50" />
                <span className="truncate">{collection.title}</span>
              </>
            ) : null}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-5 gap-y-2 text-sm lg:text-right">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/65">
              {tRoot("untranslatedRecords.deaccessions.detail.objectStatus")}
            </p>
            <p className="mt-1 font-medium">
              {collectionStatusLabel ||
                tRoot("untranslatedRecords.deaccessions.detail.unavailable")}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/65">
              {tRoot("untranslatedRecords.deaccessions.detail.reviewState")}
            </p>
            <p className="mt-1 font-medium">{reviewStateLabel}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
