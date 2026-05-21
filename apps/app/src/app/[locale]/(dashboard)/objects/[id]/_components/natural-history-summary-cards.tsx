"use client";

import type { api } from "@v1/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { Calendar, MapPin, TreePine } from "lucide-react";
import { ClientDateFns } from "@/components/client-date";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";

type NaturalHistoryDetails = NonNullable<
  FunctionReturnType<typeof api.naturalHistoryDetails.get>
>;

interface NaturalHistorySummaryCardsProps {
  details: NaturalHistoryDetails;
}

export function NaturalHistorySummaryCards({
  details,
}: NaturalHistorySummaryCardsProps) {
  const locale = useCurrentLocale();
  const t = useScopedI18n("modules.naturalHistory");

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
        <div className="mb-2 flex items-center gap-2">
          <TreePine className="size-4 text-green-500" />
          <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            {t("species")}
          </span>
        </div>
        <span className="text-lg font-light text-foreground">
          {details.species ? `${details.genus} ${details.species}` : "—"}
        </span>
        {details.commonName ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {details.commonName}
          </p>
        ) : null}
      </div>

      <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
        <div className="mb-2 flex items-center gap-2">
          <MapPin className="size-4 text-blue-500" />
          <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            {t("location")}
          </span>
        </div>
        <span className="text-sm font-medium text-foreground">
          {details.latitude && details.longitude
            ? `${details.latitude.toFixed(2)}, ${details.longitude.toFixed(2)}`
            : "—"}
        </span>
        {details.locality ? (
          <p className="mt-1 text-xs text-muted-foreground truncate">
            {details.locality}
          </p>
        ) : null}
      </div>

      <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
        <div className="mb-2 flex items-center gap-2">
          <Calendar className="size-4 text-purple-500" />
          <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            {t("collected")}
          </span>
        </div>
        <span className="text-sm font-medium text-foreground">
          {details.collectionDate ? (
            <ClientDateFns
              timestamp={details.collectionDate}
              format="MMM yyyy"
              locale={locale}
            />
          ) : (
            "—"
          )}
        </span>
        {details.collectorName ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {details.collectorName}
          </p>
        ) : null}
      </div>

      <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
        <div className="mb-2 flex items-center gap-2">
          <TreePine className="size-4 text-amber-500" />
          <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            {t("preservation")}
          </span>
        </div>
        <span className="text-sm font-medium text-foreground">
          {details.preservationMethod || "—"}
        </span>
        {details.storageMedium ? (
          <p className="mt-1 text-xs text-muted-foreground truncate">
            {details.storageMedium}
          </p>
        ) : null}
      </div>
    </div>
  );
}
