"use client";

import { Ruler, Search } from "lucide-react";
import { useId, useState } from "react";
import { useObjectDescriptionFormat } from "@/components/object-description/use-object-description-format";
import {
  formatDimensions,
  measurementSetLines,
} from "@/lib/object-description-format";
import { formatStringListField } from "@/lib/string-list-field";
import { useI18n } from "@/locales/client";
import { ConditionAssessmentPanel } from "./condition-assessment-panel";
import { ConditionSummaryCard } from "./condition-summary-card";
import { DetailField, DetailGrid, DetailSection } from "./detail-section";
import { ObjectIncidents } from "./object-incidents";
import type { CollectionData } from "./types";

interface PhysicalTabProps {
  collection: CollectionData;
}

function formatObjectType(
  value: string | undefined,
  notSpecifiedLabel: string,
) {
  if (!value) {
    return notSpecifiedLabel;
  }

  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) &&
      parsed.every((item) => typeof item === "string")
      ? parsed.join(" / ")
      : value;
  } catch {
    return value;
  }
}

export function PhysicalTab({ collection }: PhysicalTabProps) {
  const tRoot = useI18n();
  const { measurements, completeness } = useObjectDescriptionFormat();
  const historyId = useId();
  const [showHistory, setShowHistory] = useState(false);
  const notSpecified = tRoot("untranslatedRecords.objects.status.notSpecified");
  const unit = collection.dimensionUnit ? ` ${collection.dimensionUnit}` : "";
  // Free-text dimensions are no longer entered in the form; imported and
  // older records still show theirs until height, width or depth is measured.
  const dimensions =
    formatDimensions(
      {
        height: collection.dimensionHeight,
        width: collection.dimensionWidth,
        depth: collection.dimensionDepth,
      },
      collection.dimensionUnit,
      measurements,
    ) ?? collection.dimensions;
  const diameter =
    collection.dimensionDiameter ||
    (!collection.dimensionHeight &&
    !collection.dimensionDepth &&
    collection.dimensionWidth !== undefined
      ? `${measurements.number(collection.dimensionWidth)}${unit}`
      : undefined);
  const weight =
    collection.dimensionWeight !== undefined
      ? `${measurements.number(collection.dimensionWeight)} ${collection.weightUnit || "kg"}`
      : undefined;
  const measurementSets = collection.measurementSets ?? [];

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-3">
        <DetailSection
          title={tRoot(
            "untranslatedRecords.objects.form.physicalCharacteristics",
          )}
          icon={Ruler}
          className="lg:col-span-2"
        >
          <DetailGrid>
            <DetailField
              label={tRoot("objects.filters.objectType")}
              value={
                collection.objectType
                  ? formatObjectType(collection.objectType, notSpecified)
                  : undefined
              }
            />
            <DetailField
              label={tRoot("objects.form.materials")}
              value={formatStringListField(collection.materials, "")}
            />
            <DetailField
              label={tRoot("objects.printView.technique")}
              value={collection.technique}
            />
            <DetailField
              label={tRoot("objects.form.dimensions")}
              value={dimensions}
            />
            <DetailField
              label={tRoot("recordForm.objectFields.measuredPart")}
              value={
                collection.dimensionMeasuredPart
                  ? measurements.part(collection.dimensionMeasuredPart)
                  : undefined
              }
            />
            <DetailField
              label={tRoot("objects.printView.diameter")}
              value={diameter}
            />
            <DetailField
              label={tRoot("objects.printView.weight")}
              value={weight}
            />
            {measurementSets.length > 0 ? (
              <DetailField
                className="sm:col-span-2"
                label={tRoot("recordForm.objectFields.measurementSets")}
              >
                <ul className="grid gap-1 text-sm text-foreground">
                  {measurementSetLines(measurementSets, measurements).map(
                    ({ key, line }) => (
                      <li key={key} className="break-words">
                        {line}
                      </li>
                    ),
                  )}
                </ul>
              </DetailField>
            ) : null}
            <DetailField
              className="sm:col-span-2"
              label={tRoot("recordForm.objectFields.completeness")}
            >
              {collection.completeness || collection.completenessNote ? (
                <div className="grid gap-1">
                  {collection.completeness ? (
                    <div className="text-sm text-foreground">
                      {completeness(collection.completeness)}
                    </div>
                  ) : null}
                  {collection.completenessNote ? (
                    <p className="whitespace-pre-wrap break-words text-xs text-muted-foreground">
                      {collection.completenessNote}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </DetailField>
          </DetailGrid>
        </DetailSection>

        <ConditionSummaryCard
          collectionId={collection._id}
          historyId={historyId}
          historyExpanded={showHistory}
          onToggleHistory={() => setShowHistory((shown) => !shown)}
        />
      </div>

      {showHistory ? (
        <div id={historyId}>
          <ConditionAssessmentPanel
            collectionId={collection._id}
            showCurrent={false}
          />
        </div>
      ) : null}

      <DetailSection
        title={tRoot("untranslatedRecords.objects.detail.inscriptionsMarks")}
        icon={Search}
        bodyClassName="space-y-3"
      >
        <p className="text-sm text-muted-foreground">
          {collection.inscriptions ||
            tRoot("untranslatedRecords.objects.detail.noInscriptions")}
        </p>

        {collection.inscriptionMarks?.map(
          (mark: NonNullable<CollectionData["inscriptionMarks"]>[number]) => (
            <div key={mark.label} className="mt-2 flex items-start gap-2">
              <span className="shrink-0 rounded border border-border/60 bg-secondary px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                {mark.label}
              </span>
              <p className="text-xs text-muted-foreground">
                {mark.description}
              </p>
            </div>
          ),
        )}
      </DetailSection>

      <ObjectIncidents
        collectionId={collection._id}
        organizationId={collection.organizationId}
      />
    </div>
  );
}
