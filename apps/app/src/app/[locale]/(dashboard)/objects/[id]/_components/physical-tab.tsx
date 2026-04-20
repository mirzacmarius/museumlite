"use client";

import { formatStringListField } from "@/lib/string-list-field";
import { Hammer, Ruler, Search } from "lucide-react";
import type { CollectionData } from "./types";

interface PhysicalTabProps {
  collection: CollectionData;
}

export function PhysicalTab({ collection }: PhysicalTabProps) {
  const materials = formatStringListField(
    collection.materials,
    "Not specified",
  );
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
      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Materials */}
        <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
          <span className="mb-2 block text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            Materials
          </span>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-secondary">
              <span className="font-serif text-xs text-foreground">M</span>
            </div>
            <span className="text-sm font-medium text-foreground">
              {materials}
            </span>
          </div>
        </div>

        {/* Technique */}
        <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
          <span className="mb-2 block text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            Technique
          </span>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-secondary">
              <Hammer className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <span className="text-sm font-medium text-foreground">
              {collection.technique || "Not specified"}
            </span>
          </div>
        </div>

        {/* Condition */}
        <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
          <span className="mb-2 block text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            Overall Condition
          </span>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-100 dark:border-emerald-500/20 dark:bg-emerald-500/10">
              <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            </div>
            <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
              {collection.condition || "Not assessed"}
            </span>
          </div>
        </div>
      </div>

      {/* Detailed Dimensions */}
      <div>
        <h3 className="mb-4 flex items-center gap-2 text-xs font-medium text-foreground">
          <Ruler className="h-4 w-4 text-rose-500" />
          Detailed Dimensions
        </h3>
        <div className="rounded-xl border border-border/60 bg-secondary/20 p-6">
          <div className="grid grid-cols-1 gap-6 divide-y md:grid-cols-3 md:divide-x md:divide-y-0">
            <div className="space-y-1">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Dimensions
              </span>
              <p className="text-sm font-medium text-foreground">
                {dimensions || "—"}
              </p>
            </div>

            <div className="space-y-1 pt-4 md:pl-6 md:pt-0">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Diameter
              </span>
              <p className="text-sm font-medium text-foreground">
                {diameter || "—"}
              </p>
            </div>

            <div className="space-y-1 pt-4 md:pl-6 md:pt-0">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Weight
              </span>
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

      {/* Inscriptions & Marks */}
      <div>
        <h3 className="mb-4 flex items-center gap-2 text-xs font-medium text-foreground">
          <Search className="h-4 w-4 text-sky-500" />
          Inscriptions & Marks
        </h3>
        <div className="space-y-3 rounded-xl border border-border/60 bg-secondary/20 p-4">
          {collection.inscriptions ? (
            <p className="text-sm text-muted-foreground">
              {collection.inscriptions}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              No inscriptions documented.
            </p>
          )}

          {collection.inscriptionMarks &&
            collection.inscriptionMarks.length > 0 &&
            collection.inscriptionMarks.map((mark) => (
              <div key={mark.label} className="mt-2 flex items-start gap-2">
                <span className="shrink-0 rounded border border-border/60 bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  {mark.label}
                </span>
                <p className="text-xs text-muted-foreground">
                  {mark.description}
                </p>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
