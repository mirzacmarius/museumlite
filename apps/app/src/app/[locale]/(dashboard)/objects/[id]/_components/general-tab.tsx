"use client";

import {
  type ProductionDateSource,
  parseEdtf,
  productionDateSummary,
} from "@v1/backend/convex/utils/productionDates";
import { CheckCircle, Tag } from "lucide-react";
import { EdtfChip } from "@/components/production-date/edtf-chip";
import { useProductionDateFormat } from "@/components/production-date/use-production-date-format";
import { formatNumber } from "@/lib/format-number";
import { useCurrentLocale, useI18n, useScopedI18n } from "@/locales/client";
import { DetailField, DetailGrid, DetailSection } from "./detail-section";
import type { CollectionData } from "./types";

interface GeneralTabProps {
  collection: CollectionData;
  collectionGroupName?: string;
}

export function GeneralTab({
  collection,
  collectionGroupName,
}: GeneralTabProps) {
  const tRoot = useI18n();
  const locale = useCurrentLocale();
  const collectionType: string | undefined = collection.collectionType;
  const collectionTypeLabel = collectionType
    ? collectionType === "fine_art"
      ? tRoot("untranslatedRecords.objects.enums.fineArt")
      : collectionType === "wine"
        ? tRoot("untranslatedRecords.objects.enums.wine")
        : collectionType === "automotive"
          ? tRoot("untranslatedRecords.objects.enums.automotive")
          : collectionType === "natural_history"
            ? tRoot("untranslatedRecords.objects.enums.naturalHistory")
            : collectionType === "archive"
              ? tRoot("untranslatedRecords.objects.enums.archive")
              : collectionType === "coins_stamps"
                ? tRoot("untranslatedRecords.objects.enums.coinsStamps")
                : collectionType === "general"
                  ? tRoot("untranslatedRecords.objects.enums.generalCollection")
                  : collectionType
    : tRoot("untranslatedRecords.objects.enums.generalCollection");

  return (
    <DetailSection
      title={tRoot("untranslatedRecords.objects.detail.classificationMetadata")}
      icon={Tag}
    >
      <DetailGrid>
        <DetailField
          label={tRoot("objects.form.collectionType")}
          value={collectionTypeLabel}
        />
        <DetailField
          label={tRoot("objects.form.objectName")}
          value={collection.objectName}
        />
        <DetailField
          label={tRoot("recordForm.objectFields.numberOfObjects")}
          value={
            collection.numberOfObjects === undefined
              ? undefined
              : formatNumber(collection.numberOfObjects, locale)
          }
        />
        <DetailField
          label={tRoot("objects.form.collectionGroup")}
          value={collectionGroupName}
        />
        <DetailField
          label={tRoot("objects.form.culture")}
          value={collection.culture}
        />
        <DetailField
          label={tRoot("untranslatedRecords.objects.detail.artistMaker")}
          value={collection.creator}
        />
        <DetailField
          label={tRoot("objects.form.period")}
          value={collection.period}
        />
        <DetailField label={tRoot("objects.form.dateCreated")}>
          <DateMadeValue source={collection} />
        </DetailField>
        <DetailField label={tRoot("recordForm.objectFields.subjects")}>
          {collection.subjects?.length ? (
            <ul className="flex flex-wrap gap-1.5">
              {collection.subjects.map((term) => (
                <li
                  key={term}
                  className="rounded-md border border-border/60 px-2 py-0.5 text-xs text-foreground"
                >
                  {term}
                </li>
              ))}
            </ul>
          ) : null}
        </DetailField>
      </DetailGrid>
      {collection.isHighResDownloadable ? (
        <div className="mt-5 flex items-center gap-2 border-t border-border/60 pt-4">
          <CheckCircle className="size-4 text-status-success-foreground" />
          <span className="text-sm text-muted-foreground">
            {tRoot("untranslatedRecords.objects.detail.highResDownloadable")}
          </span>
        </div>
      ) : null}
    </DetailSection>
  );
}

/**
 * The date made as written (else its structured date), and the years the
 * catalog sorts and filters it by, so an unread date stands out.
 */
function DateMadeValue({ source }: { source: ProductionDateSource }) {
  const t = useScopedI18n("objects.form.productionDate");
  const dates = useProductionDateFormat();
  const shown = dates.dateMade(source);
  if (!shown) return <div className="text-sm text-muted-foreground/70">-</div>;
  const summary = productionDateSummary(source);
  const entered =
    source.dateCreatedEdtf && parseEdtf(source.dateCreatedEdtf)
      ? source.dateCreatedEdtf
      : undefined;
  return (
    <div className="grid gap-1">
      <div className="break-words text-sm text-foreground">{shown}</div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span>{summary ? dates.years(summary) : t("undated")}</span>
        {entered ? <EdtfChip edtf={entered} /> : null}
      </div>
    </div>
  );
}
