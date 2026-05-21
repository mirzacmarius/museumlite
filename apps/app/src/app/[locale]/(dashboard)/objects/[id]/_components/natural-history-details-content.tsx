"use client";

import type { api } from "@v1/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { Calendar, MapPin, TreePine } from "lucide-react";
import { ClientDateFns } from "@/components/client-date";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";

type NaturalHistoryDetails = NonNullable<
  FunctionReturnType<typeof api.naturalHistoryDetails.get>
>;

interface NaturalHistoryDetailsContentProps {
  details: NaturalHistoryDetails;
}

export function NaturalHistoryDetailsContent({
  details,
}: NaturalHistoryDetailsContentProps) {
  const locale = useCurrentLocale();
  const t = useScopedI18n("modules.naturalHistory");
  const common = useScopedI18n("modules.common");
  return (
    <div className="space-y-8">
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
          {details.commonName && (
            <p className="mt-1 text-xs text-muted-foreground">
              {details.commonName}
            </p>
          )}
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
          {details.locality && (
            <p className="mt-1 text-xs text-muted-foreground truncate">
              {details.locality}
            </p>
          )}
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
          {details.collectorName && (
            <p className="mt-1 text-xs text-muted-foreground">
              {details.collectorName}
            </p>
          )}
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
          {details.storageMedium && (
            <p className="mt-1 text-xs text-muted-foreground truncate">
              {details.storageMedium}
            </p>
          )}
        </div>
      </div>

      <div>
        <h3 className="mb-4 flex items-center gap-2 text-xs font-medium text-foreground">
          <TreePine className="size-4 text-green-500" />
          {t("taxonomicClassification")}
        </h3>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-border/60 bg-secondary/20 p-3">
            <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
              {t("kingdom")}
            </div>
            <div className="text-sm font-medium text-foreground">
              {details.kingdom || "—"}
            </div>
          </div>
          <div className="rounded-lg border border-border/60 bg-secondary/20 p-3">
            <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
              {t("phylum")}
            </div>
            <div className="text-sm font-medium text-foreground">
              {details.phylum || "—"}
            </div>
          </div>
          <div className="rounded-lg border border-border/60 bg-secondary/20 p-3">
            <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
              {t("class")}
            </div>
            <div className="text-sm font-medium text-foreground">
              {details.taxonomyClass || "—"}
            </div>
          </div>
          <div className="rounded-lg border border-border/60 bg-secondary/20 p-3">
            <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
              {t("order")}
            </div>
            <div className="text-sm font-medium text-foreground">
              {details.order || "—"}
            </div>
          </div>
          <div className="rounded-lg border border-border/60 bg-secondary/20 p-3">
            <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
              {t("family")}
            </div>
            <div className="text-sm font-medium text-foreground">
              {details.family || "—"}
            </div>
          </div>
          <div className="rounded-lg border border-border/60 bg-secondary/20 p-3">
            <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
              {t("genus")}
            </div>
            <div className="text-sm font-medium text-foreground">
              {details.genus || "—"}
            </div>
          </div>
          <div className="rounded-lg border border-border/60 bg-secondary/20 p-3">
            <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
              {t("species")}
            </div>
            <div className="text-sm font-medium text-foreground">
              {details.species || "—"}
            </div>
          </div>
          <div className="rounded-lg border border-border/60 bg-secondary/20 p-3">
            <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
              {t("subspecies")}
            </div>
            <div className="text-sm font-medium text-foreground">
              {details.subspecies || "—"}
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-4 flex items-center gap-2 text-xs font-medium text-foreground">
          <MapPin className="size-4 text-blue-500" />
          {t("geolocationData")}
        </h3>

        <div className="rounded-lg border border-border/60 bg-secondary/20 p-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                {t("latitude")}
              </div>
              <div className="text-sm font-medium text-foreground">
                {details.latitude || "—"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                {t("longitude")}
              </div>
              <div className="text-sm font-medium text-foreground">
                {details.longitude || "—"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                {t("altitude")}
              </div>
              <div className="text-sm font-medium text-foreground">
                {details.altitude ? `${details.altitude}${t("meters")}` : "—"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                {t("habitat")}
              </div>
              <div className="text-sm font-medium text-foreground">
                {details.habitat || "—"}
              </div>
            </div>
          </div>
          {details.locality && (
            <div className="mt-4 pt-4 border-t border-border/40">
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-2">
                {t("localityDescription")}
              </div>
              <p className="text-sm text-muted-foreground">
                {details.locality}
              </p>
            </div>
          )}
        </div>
      </div>

      <div>
        <h3 className="mb-4 flex items-center gap-2 text-xs font-medium text-foreground">
          <Calendar className="size-4 text-purple-500" />
          {t("collectionInformation")}
        </h3>

        <div className="rounded-lg border border-border/60 bg-secondary/20 p-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                {t("collectionDate")}
              </div>
              <div className="text-sm font-medium text-foreground">
                {details.collectionDate ? (
                  <ClientDateFns
                    timestamp={details.collectionDate}
                    format="MMM d, yyyy"
                    locale={locale}
                  />
                ) : (
                  "—"
                )}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                {t("collectionMethod")}
              </div>
              <div className="text-sm font-medium text-foreground">
                {details.collectionMethod || "—"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                {t("collector")}
              </div>
              <div className="text-sm font-medium text-foreground">
                {details.collectorName || "—"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                {t("specimenType")}
              </div>
              <div className="text-sm font-medium text-foreground">
                {details.specimenType || "—"}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-4 flex items-center gap-2 text-xs font-medium text-foreground">
          <TreePine className="size-4 text-amber-500" />
          {t("preservationStorage")}
        </h3>

        <div className="rounded-lg border border-border/60 bg-secondary/20 p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                {t("preservationMethod")}
              </div>
              <div className="text-sm font-medium text-foreground">
                {details.preservationMethod || "—"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                {t("storageMedium")}
              </div>
              <div className="text-sm font-medium text-foreground">
                {details.storageMedium || "—"}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 mt-4">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                {t("containerType")}
              </div>
              <div className="text-sm font-medium text-foreground">
                {details.containerType || "—"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                {t("sex")}
              </div>
              <div className="text-sm font-medium text-foreground">
                {details.sex || "—"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                {t("lifeStage")}
              </div>
              <div className="text-sm font-medium text-foreground">
                {details.lifeStage || "—"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {(details.dnaAvailable || details.tissueAvailable) && (
        <div>
          <h3 className="mb-4 flex items-center gap-2 text-xs font-medium text-foreground">
            <TreePine className="size-4 text-cyan-500" />
            {t("scientificDataAvailability")}
          </h3>

          <div className="rounded-lg border border-border/60 bg-secondary/20 p-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {details.dnaAvailable !== undefined && (
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                    {t("dnaAvailable")}
                  </div>
                  <div className="text-sm font-medium text-foreground">
                    {details.dnaAvailable ? common("yes") : common("no")}
                  </div>
                </div>
              )}
              {details.tissueAvailable !== undefined && (
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                    {t("tissueAvailable")}
                  </div>
                  <div className="text-sm font-medium text-foreground">
                    {details.tissueAvailable ? common("yes") : common("no")}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {(details.geologicalPeriod || details.formation) && (
        <div>
          <h3 className="mb-4 flex items-center gap-2 text-xs font-medium text-foreground">
            <TreePine className="size-4 text-orange-500" />
            {t("geologicalInformation")}
          </h3>

          <div className="rounded-lg border border-border/60 bg-secondary/20 p-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {details.geologicalPeriod && (
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                    {t("geologicalPeriod")}
                  </div>
                  <div className="text-sm font-medium text-foreground">
                    {details.geologicalPeriod}
                  </div>
                </div>
              )}
              {details.formation && (
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                    {t("formation")}
                  </div>
                  <div className="text-sm font-medium text-foreground">
                    {details.formation}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
