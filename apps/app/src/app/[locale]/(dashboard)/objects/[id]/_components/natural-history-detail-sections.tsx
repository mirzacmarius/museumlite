"use client";

import { Calendar, MapPin, TreePine } from "lucide-react";
import { ClientDateFns } from "@/components/client-date";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import {
  DetailField,
  DetailGrid,
  DetailLabel,
  DetailSection,
} from "./detail-section";
import type { TypeDetailsRecord } from "./types";

type NaturalHistoryDetails = TypeDetailsRecord<"natural_history">;

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
      <DetailSection
        title={t("taxonomicClassification")}
        icon={TreePine}
        bodyClassName="border-0 bg-transparent p-0 sm:p-0"
      >
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
              className="rounded-lg border border-border/60 bg-card p-3"
            >
              <DetailLabel className="mb-1">{t(labelKey)}</DetailLabel>
              <div className="text-sm font-medium text-foreground">
                {value || "—"}
              </div>
            </div>
          ))}
        </div>
      </DetailSection>

      <DetailSection title={t("geolocationData")} icon={MapPin}>
        <DetailGrid className="md:grid-cols-4">
          <DetailField label={t("latitude")} value={details.latitude} />
          <DetailField label={t("longitude")} value={details.longitude} />
          <DetailField label={t("altitude")}>
            <div className="text-sm text-foreground">
              {details.altitude ? `${details.altitude}${t("meters")}` : "—"}
            </div>
          </DetailField>
          <DetailField label={t("habitat")} value={details.habitat} />
        </DetailGrid>
        {details.locality ? (
          <div className="mt-4 pt-4 border-t border-border/40">
            <DetailLabel className="mb-2">
              {t("localityDescription")}
            </DetailLabel>
            <p className="text-sm text-muted-foreground">{details.locality}</p>
          </div>
        ) : null}
      </DetailSection>

      <DetailSection title={t("collectionInformation")} icon={Calendar}>
        <DetailGrid className="md:grid-cols-4">
          <DetailField label={t("collectionDate")}>
            <div className="text-sm text-foreground">
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
          </DetailField>
          <DetailField
            label={t("collectionMethod")}
            value={details.collectionMethod}
          />
          <DetailField label={t("collector")} value={details.collectorName} />
          <DetailField label={t("specimenType")} value={details.specimenType} />
        </DetailGrid>
      </DetailSection>

      <DetailSection title={t("preservationStorage")} icon={TreePine}>
        <DetailGrid>
          <DetailField
            label={t("preservationMethod")}
            value={details.preservationMethod}
          />
          <DetailField
            label={t("storageMedium")}
            value={details.storageMedium}
          />
        </DetailGrid>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 mt-4">
          <DetailField
            label={t("containerType")}
            value={details.containerType}
          />
          <DetailField label={t("sex")} value={details.sex} />
          <DetailField label={t("lifeStage")} value={details.lifeStage} />
        </div>
      </DetailSection>

      {details.dnaAvailable || details.tissueAvailable ? (
        <DetailSection title={t("scientificDataAvailability")} icon={TreePine}>
          <DetailGrid>
            {details.dnaAvailable !== undefined ? (
              <DetailField label={t("dnaAvailable")}>
                <div className="text-sm text-foreground">
                  {details.dnaAvailable ? common("yes") : common("no")}
                </div>
              </DetailField>
            ) : null}
            {details.tissueAvailable !== undefined ? (
              <DetailField label={t("tissueAvailable")}>
                <div className="text-sm text-foreground">
                  {details.tissueAvailable ? common("yes") : common("no")}
                </div>
              </DetailField>
            ) : null}
          </DetailGrid>
        </DetailSection>
      ) : null}

      {details.geologicalPeriod || details.formation ? (
        <DetailSection title={t("geologicalInformation")} icon={TreePine}>
          <DetailGrid>
            {details.geologicalPeriod ? (
              <DetailField
                label={t("geologicalPeriod")}
                value={details.geologicalPeriod}
              />
            ) : null}
            {details.formation ? (
              <DetailField label={t("formation")} value={details.formation} />
            ) : null}
          </DetailGrid>
        </DetailSection>
      ) : null}
    </>
  );
}
