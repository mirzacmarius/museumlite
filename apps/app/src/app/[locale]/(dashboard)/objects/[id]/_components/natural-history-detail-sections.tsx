"use client";

import type { api } from "@v1/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { Calendar, MapPin, TreePine } from "lucide-react";
import { ClientDateFns } from "@/components/client-date";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";

type NaturalHistoryDetails = NonNullable<
  FunctionReturnType<typeof api.naturalHistoryDetails.get>
>;

interface NaturalHistoryDetailSectionsProps {
  details: NaturalHistoryDetails;
}

export function NaturalHistoryDetailSections({
  details,
}: NaturalHistoryDetailSectionsProps) {
  const locale = useCurrentLocale();
  const t = useScopedI18n("modules.naturalHistory");
  const common = useScopedI18n("modules.common");

  return (
    <>
      <div>
        <h3 className="mb-4 flex items-center gap-2 text-xs font-medium text-foreground">
          <TreePine className="size-4 text-green-500" />
          {t("taxonomicClassification")}
        </h3>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {(
            [
              ["kingdom", details.kingdom],
              ["phylum", details.phylum],
              ["class", details.taxonomyClass],
              ["order", details.order],
              ["family", details.family],
              ["genus", details.genus],
              ["species", details.species],
              ["subspecies", details.subspecies],
            ] as const
          ).map(([labelKey, value]) => (
            <div
              key={labelKey}
              className="rounded-lg border border-border/60 bg-secondary/20 p-3"
            >
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                {t(labelKey)}
              </div>
              <div className="text-sm font-medium text-foreground">
                {value || "—"}
              </div>
            </div>
          ))}
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
          {details.locality ? (
            <div className="mt-4 pt-4 border-t border-border/40">
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-2">
                {t("localityDescription")}
              </div>
              <p className="text-sm text-muted-foreground">
                {details.locality}
              </p>
            </div>
          ) : null}
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

      {details.dnaAvailable || details.tissueAvailable ? (
        <div>
          <h3 className="mb-4 flex items-center gap-2 text-xs font-medium text-foreground">
            <TreePine className="size-4 text-cyan-500" />
            {t("scientificDataAvailability")}
          </h3>

          <div className="rounded-lg border border-border/60 bg-secondary/20 p-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {details.dnaAvailable !== undefined ? (
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                    {t("dnaAvailable")}
                  </div>
                  <div className="text-sm font-medium text-foreground">
                    {details.dnaAvailable ? common("yes") : common("no")}
                  </div>
                </div>
              ) : null}
              {details.tissueAvailable !== undefined ? (
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                    {t("tissueAvailable")}
                  </div>
                  <div className="text-sm font-medium text-foreground">
                    {details.tissueAvailable ? common("yes") : common("no")}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {details.geologicalPeriod || details.formation ? (
        <div>
          <h3 className="mb-4 flex items-center gap-2 text-xs font-medium text-foreground">
            <TreePine className="size-4 text-orange-500" />
            {t("geologicalInformation")}
          </h3>

          <div className="rounded-lg border border-border/60 bg-secondary/20 p-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {details.geologicalPeriod ? (
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                    {t("geologicalPeriod")}
                  </div>
                  <div className="text-sm font-medium text-foreground">
                    {details.geologicalPeriod}
                  </div>
                </div>
              ) : null}
              {details.formation ? (
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                    {t("formation")}
                  </div>
                  <div className="text-sm font-medium text-foreground">
                    {details.formation}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
