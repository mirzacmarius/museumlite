"use client";

import { Hammer, Ruler, Search, Shapes } from "lucide-react";
import { formatStringListField } from "@/lib/string-list-field";
import { useI18n } from "@/locales/client";
import { ConditionAssessmentPanel } from "./condition-assessment-panel";
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
  const notSpecified = tRoot("untranslatedRecords.objects.status.notSpecified");
  const materials = formatStringListField(collection.materials, notSpecified);
  const dimensions =
    collection.dimensions ||
    [
      collection.dimensionHeight && `H: ${collection.dimensionHeight}`,
      collection.dimensionWidth && `W: ${collection.dimensionWidth}`,
      collection.dimensionDepth && `D: ${collection.dimensionDepth}`,
    ]
      .filter(Boolean)
      .join(" × ");
  const diameter =
    collection.dimensionDiameter ||
    (!collection.dimensionHeight &&
    !collection.dimensionDepth &&
    collection.dimensionWidth !== undefined
      ? `${collection.dimensionWidth}${
          collection.dimensionUnit ? ` ${collection.dimensionUnit}` : ""
        }`
      : undefined);

  return (
    <div className="space-y-8">
      <ObjectIncidents
        collectionId={collection._id}
        organizationId={collection.organizationId}
      />
      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
          <div className="space-y-5">
            <div>
              <span className="mb-2 block text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                {tRoot("objects.filters.objectType")}
              </span>
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-full border border-border/60 bg-secondary">
                  <Shapes className="size-3.5 text-muted-foreground" />
                </div>
                <span className="text-sm font-medium text-foreground">
                  {formatObjectType(collection.objectType, notSpecified)}
                </span>
              </div>
            </div>

            <div>
              <span className="mb-2 block text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                {tRoot("objects.form.materials")}
              </span>
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-full border border-border/60 bg-secondary">
                  <span className="font-serif text-xs text-foreground">M</span>
                </div>
                <span className="text-sm font-medium text-foreground">
                  {materials}
                </span>
              </div>
            </div>

            <div>
              <span className="mb-2 block text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                {tRoot("objects.printView.technique")}
              </span>
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-full border border-border/60 bg-secondary">
                  <Hammer className="size-3.5 text-muted-foreground" />
                </div>
                <span className="text-sm font-medium text-foreground">
                  {collection.technique ||
                    tRoot("untranslatedRecords.objects.status.notSpecified")}
                </span>
              </div>
            </div>

            <div>
              <span className="mb-2 block text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                {tRoot("objects.form.dimensions")}
              </span>
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-full border border-border/60 bg-secondary">
                  <Ruler className="size-3.5 text-muted-foreground" />
                </div>
                <span className="text-sm font-medium text-foreground">
                  {dimensions || "—"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="mb-2 block text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                  {tRoot("objects.printView.diameter")}
                </span>
                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-full border border-border/60 bg-secondary">
                    <span className="text-xs font-medium text-foreground">
                      D
                    </span>
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {diameter || "—"}
                  </span>
                </div>
              </div>
              <div>
                <span className="mb-2 block text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                  {tRoot("objects.printView.weight")}
                </span>
                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-full border border-border/60 bg-secondary">
                    <span className="text-xs font-medium text-foreground">
                      W
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm font-medium text-foreground">
                      {collection.dimensionWeight ?? "—"}
                    </span>
                    {collection.dimensionWeight !== undefined && (
                      <span className="text-xs text-muted-foreground">
                        {collection.weightUnit || "kg"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <ConditionAssessmentPanel collectionId={collection._id} />
      </div>

      {/* Inscriptions & Marks */}
      <div>
        <h3 className="mb-4 flex items-center gap-2 text-xs font-medium text-foreground">
          <Search className="size-4 text-sky-500" />
          {tRoot("untranslatedRecords.objects.detail.inscriptionsMarks")}
        </h3>
        <div className="space-y-3 rounded-xl border border-border/60 bg-secondary/20 p-4">
          {collection.inscriptions ? (
            <p className="text-sm text-muted-foreground">
              {collection.inscriptions}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {tRoot("untranslatedRecords.objects.detail.noInscriptions")}
            </p>
          )}

          {collection.inscriptionMarks &&
            collection.inscriptionMarks.length > 0 &&
            collection.inscriptionMarks.map(
              (
                mark: NonNullable<CollectionData["inscriptionMarks"]>[number],
              ) => (
                <div key={mark.label} className="mt-2 flex items-start gap-2">
                  <span className="shrink-0 rounded border border-border/60 bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    {mark.label}
                  </span>
                  <p className="text-xs text-muted-foreground">
                    {mark.description}
                  </p>
                </div>
              ),
            )}
        </div>
      </div>
    </div>
  );
}
