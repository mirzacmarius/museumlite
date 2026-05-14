"use client";

import { getConditionIcon } from "@/components/condition-combobox";
import { formatStringListField } from "@/lib/string-list-field";
import { cn } from "@v1/ui/utils";
import { Hammer, Ruler, Search, Shapes } from "lucide-react";
import type { CollectionData } from "./types";

interface PhysicalTabProps {
  collection: CollectionData;
}

function formatObjectType(value?: string) {
  if (!value) {
    return "Not specified";
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
  const conditionHistory = (collection.conditionHistory ?? []).toSorted(
    (a, b) => b.changedAt - a.changedAt,
  );
  const latestConditionEntry = conditionHistory[0];
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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
          <div className="space-y-5">
            <div>
              <span className="mb-2 block text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Object Type
              </span>
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-full border border-border/60 bg-secondary">
                  <Shapes className="size-3.5 text-muted-foreground" />
                </div>
                <span className="text-sm font-medium text-foreground">
                  {formatObjectType(collection.objectType)}
                </span>
              </div>
            </div>

            <div>
              <span className="mb-2 block text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Materials
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
                Technique
              </span>
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-full border border-border/60 bg-secondary">
                  <Hammer className="size-3.5 text-muted-foreground" />
                </div>
                <span className="text-sm font-medium text-foreground">
                  {collection.technique || "Not specified"}
                </span>
              </div>
            </div>

            <div>
              <span className="mb-2 block text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Dimensions
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
                  Diameter
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
                  Weight
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

        {/* Condition */}
        <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
          <span className="mb-2 block text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            Overall Condition
          </span>
          <div className="space-y-3">
            {conditionHistory.length > 0 ? (
              <div className="relative mb-1">
                <div className="absolute bottom-2 left-3 top-2 w-px bg-zinc-800" />
                <div>
                  {conditionHistory.map((entry, index) => (
                    <div
                      key={`${entry.changedAt}-${entry.condition}-${index}`}
                      className={cn(
                        "relative pl-8",
                        index < conditionHistory.length - 1 && "pb-6",
                      )}
                    >
                      <div
                        className={cn(
                          "absolute left-0 top-1 z-10 flex size-6 items-center justify-center rounded-full",
                          index === 0
                            ? "border border-indigo-500 bg-indigo-500/20 text-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.3)]"
                            : "border border-zinc-700 bg-zinc-900",
                        )}
                      >
                        <div
                          className={cn(
                            "flex items-center justify-center",
                            index === 0 && "animate-pulse",
                          )}
                        >
                          {getConditionIcon(entry.condition)}
                        </div>
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-start justify-between gap-2">
                          <h4
                            className={cn(
                              "text-sm font-medium",
                              index === 0
                                ? "text-indigo-400"
                                : "text-foreground",
                            )}
                          >
                            {entry.condition}
                          </h4>
                          {index === 0 ? (
                            <span className="text-[9px] font-medium uppercase tracking-wider text-indigo-400">
                              Current
                            </span>
                          ) : null}
                        </div>
                        <p className="text-[10px] text-zinc-500">
                          {new Date(entry.changedAt).toLocaleString()} • By{" "}
                          {entry.changedByName || "Unknown"}
                        </p>
                        {entry.note ? (
                          <p className="pt-1 text-xs leading-relaxed text-muted-foreground">
                            {entry.note}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-100 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                  <div className="size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                </div>
                <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  {collection.condition || "Not assessed"}
                </span>
              </div>
            )}
            {!latestConditionEntry ? (
              <p className="text-xs text-muted-foreground">
                No condition history recorded yet.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {/* Inscriptions & Marks */}
      <div>
        <h3 className="mb-4 flex items-center gap-2 text-xs font-medium text-foreground">
          <Search className="size-4 text-sky-500" />
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
