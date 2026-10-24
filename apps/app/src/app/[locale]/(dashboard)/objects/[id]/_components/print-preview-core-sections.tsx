"use client";

import { cn } from "@v1/ui/utils";
import Image from "next/image";
import type { ReactNode } from "react";
import { useObjectDescriptionFormat } from "@/components/object-description/use-object-description-format";
import { useProductionDateFormat } from "@/components/production-date/use-production-date-format";
import {
  formatDimensions,
  measurementSetLines,
} from "@/lib/object-description-format";
import { getCollectionStatusLabel } from "@/lib/record-enum-labels";
import { formatStringListField } from "@/lib/string-list-field";
import { useI18n, useScopedI18n } from "@/locales/client";
import { formatConditionLabel } from "./condition-display";
import type { CollectionData, HeroImageData } from "./types";

interface PrintPreviewCoreSectionsProps {
  collection: CollectionData;
  heroImage: HeroImageData | null;
}

export function PrintPreviewCoreSections({
  collection,
  heroImage,
}: PrintPreviewCoreSectionsProps) {
  const tRoot = useI18n();
  const t = useScopedI18n("objects.printPreview");
  const { measurements } = useObjectDescriptionFormat();
  const dateMade = useProductionDateFormat().dateMade(collection);

  return (
    <div className="space-y-5 print:space-y-4">
      {/* Header */}
      <div className="flex items-start gap-4 border-b border-zinc-200 pb-4 print:gap-3 print:pb-3">
        {heroImage?.url && (
          <Image
            src={heroImage.thumbnailUrl || heroImage.url}
            alt={collection.title}
            width={112}
            height={112}
            className="size-28 flex-shrink-0 rounded border border-zinc-300 object-cover print:size-20"
          />
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-black print:text-lg">
            {collection.title}
          </h1>
          {collection.alternativeTitle && (
            <p className="text-sm text-zinc-600 italic print:text-xs">
              {collection.alternativeTitle}
            </p>
          )}
          <p className="mt-1 font-mono text-xs text-zinc-600">
            {collection.accessionNumber}
          </p>
          {collection.alternateAccessionNumbers &&
            collection.alternateAccessionNumbers.length > 0 && (
              <p className="text-[10px] text-zinc-500">
                {tRoot("untranslatedRecords.objects.detail.altText")}{" "}
                {collection.alternateAccessionNumbers.join(", ")}
              </p>
            )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {collection.displayStatus && (
              <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-700">
                {collection.displayStatus}
              </span>
            )}
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-medium",
                collection.status === "active"
                  ? "bg-green-100 text-green-700"
                  : collection.status === "loaned"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-red-100 text-red-700",
              )}
            >
              {getCollectionStatusLabel(collection.status, tRoot)}
            </span>
          </div>
        </div>
      </div>

      {/* Basic Information */}
      <div className="print:break-inside-avoid">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 print:text-[10px]">
          {t("basicInformation")}
        </h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm print:text-xs print:gap-x-4 print:gap-y-1">
          {collection.objectType && (
            <div>
              <p className="text-xs font-medium text-zinc-500">
                {t("objectType")}
              </p>
              <p className="text-black">{collection.objectType}</p>
            </div>
          )}
          {collection.objectName && (
            <div>
              <p className="text-xs font-medium text-zinc-500">
                {t("objectName")}
              </p>
              <p className="text-black">{collection.objectName}</p>
            </div>
          )}
          {collection.numberOfObjects !== undefined && (
            <PrintField
              label={tRoot("recordForm.objectFields.numberOfObjects")}
            >
              {measurements.number(collection.numberOfObjects)}
            </PrintField>
          )}
          {collection.creator && (
            <div>
              <p className="text-xs font-medium text-zinc-500">
                {t("creatorArtist")}
              </p>
              <p className="text-black">{collection.creator}</p>
            </div>
          )}
          {dateMade && (
            <div>
              <p className="text-xs font-medium text-zinc-500">
                {t("dateCreated")}
              </p>
              <p className="text-black">{dateMade}</p>
            </div>
          )}
          {collection.culture && (
            <div>
              <p className="text-xs font-medium text-zinc-500">
                {t("culture")}
              </p>
              <p className="text-black">{collection.culture}</p>
            </div>
          )}
          {collection.period && (
            <div>
              <p className="text-xs font-medium text-zinc-500">{t("period")}</p>
              <p className="text-black">{collection.period}</p>
            </div>
          )}
          {collection.subjects && collection.subjects.length > 0 && (
            <PrintField label={tRoot("recordForm.objectFields.subjects")} wide>
              {collection.subjects.join(", ")}
            </PrintField>
          )}
        </div>
      </div>

      <PrintPhysicalDescription collection={collection} />

      {/* Description */}
      {collection.description && (
        <div>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 print:text-[10px]">
            {t("description")}
          </h2>
          <p className="text-sm text-black whitespace-pre-wrap print:text-xs">
            {collection.description}
          </p>
        </div>
      )}
    </div>
  );
}

function PrintField({
  label,
  wide = false,
  children,
}: {
  label: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={wide ? "col-span-2" : undefined}>
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <div className="text-black">{children}</div>
    </div>
  );
}

/** Materials, measurements by part, completeness, condition and inscriptions. */
function PrintPhysicalDescription({
  collection,
}: {
  collection: CollectionData;
}) {
  const tRoot = useI18n();
  const t = useScopedI18n("objects.printPreview");
  const { measurements, completeness } = useObjectDescriptionFormat();
  const materials = formatStringListField(collection.materials);
  const measured = formatDimensions(
    {
      height: collection.dimensionHeight,
      width: collection.dimensionWidth,
      depth: collection.dimensionDepth,
    },
    collection.dimensionUnit,
    measurements,
  );
  const measurementSets = collection.measurementSets ?? [];
  return (
    <div className="print:break-inside-avoid">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 print:text-[10px]">
        {t("physicalDescription")}
      </h2>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm print:text-xs print:gap-x-4 print:gap-y-1">
        {materials && (
          <PrintField label={t("materials")}>{materials}</PrintField>
        )}
        {collection.technique && (
          <PrintField label={t("technique")}>{collection.technique}</PrintField>
        )}
        {collection.dimensions && (
          <PrintField label={t("dimensions")}>
            {collection.dimensions}
          </PrintField>
        )}
        {collection.dimensionDiameter && (
          <PrintField label={t("diameter")}>
            {collection.dimensionDiameter}
          </PrintField>
        )}
        {measured && (
          <PrintField label={t("detailedDimensions")}>{measured}</PrintField>
        )}
        {collection.dimensionWeight !== undefined && (
          <PrintField label={t("weight")}>
            {measurements.number(collection.dimensionWeight)}{" "}
            {collection.weightUnit || "kg"}
          </PrintField>
        )}
        {collection.dimensionMeasuredPart && (
          <PrintField label={tRoot("recordForm.objectFields.measuredPart")}>
            {measurements.part(collection.dimensionMeasuredPart)}
          </PrintField>
        )}
        {measurementSets.length > 0 && (
          <PrintField
            label={tRoot("recordForm.objectFields.measurementSets")}
            wide
          >
            {measurementSetLines(measurementSets, measurements).map(
              ({ key, line }) => (
                <p key={key}>{line}</p>
              ),
            )}
          </PrintField>
        )}
        {(collection.completeness || collection.completenessNote) && (
          <PrintField
            label={tRoot("recordForm.objectFields.completeness")}
            wide
          >
            {collection.completeness ? (
              <p>{completeness(collection.completeness)}</p>
            ) : null}
            {collection.completenessNote ? (
              <p className="whitespace-pre-wrap">
                {collection.completenessNote}
              </p>
            ) : null}
          </PrintField>
        )}
        {collection.condition && (
          <PrintField label={t("condition")} wide>
            {formatConditionLabel(collection.condition, tRoot)}
          </PrintField>
        )}
        {collection.inscriptions && (
          <PrintField label={t("inscriptions")} wide>
            <p className="whitespace-pre-wrap">{collection.inscriptions}</p>
          </PrintField>
        )}
      </div>
    </div>
  );
}
