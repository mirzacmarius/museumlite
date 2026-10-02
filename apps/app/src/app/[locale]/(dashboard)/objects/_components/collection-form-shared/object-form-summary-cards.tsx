"use client";

import { Calendar, Info, MapPin } from "lucide-react";
import type { CollectionEditTabId } from "./types";

interface ObjectFormSummaryCardsProps {
  creator?: string;
  dateCreated?: string;
  locationSummary: string;
  collectionSummary: string;
  isLocationTrackingEnabled: boolean;
  unknownLabel?: string;
  onTabSelect: (tabId: CollectionEditTabId) => void;
}

export function ObjectFormSummaryCards({
  creator,
  dateCreated,
  locationSummary,
  collectionSummary,
  isLocationTrackingEnabled,
  unknownLabel = "Unknown",
  onTabSelect,
}: ObjectFormSummaryCardsProps) {
  return (
    <div className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-2 xl:grid-cols-4">
      <button
        type="button"
        className="rounded-xl border border-border/50 bg-background/70 p-3 text-left transition-colors hover:border-primary/30 hover:text-foreground"
        onClick={() => onTabSelect("general")}
      >
        <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          <Info className="size-3.5" />
          Creator
        </div>
        <div className="truncate text-sm text-foreground">
          {creator || "Not set"}
        </div>
      </button>
      <button
        type="button"
        className="rounded-xl border border-border/50 bg-background/70 p-3 text-left transition-colors hover:border-primary/30 hover:text-foreground"
        onClick={() => onTabSelect("general")}
      >
        <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          <Calendar className="size-3.5" />
          Date created
        </div>
        <div className="truncate text-sm text-foreground">
          {dateCreated || unknownLabel}
        </div>
      </button>
      {isLocationTrackingEnabled ? (
        <>
          <button
            type="button"
            className="rounded-xl border border-border/50 bg-background/70 p-3 text-left transition-colors hover:border-primary/30 hover:text-foreground"
            onClick={() => onTabSelect("placement")}
          >
            <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              <MapPin className="size-3.5" />
              Location
            </div>
            <div className="truncate text-sm text-foreground">
              {locationSummary}
            </div>
          </button>
          <button
            type="button"
            className="rounded-xl border border-border/50 bg-background/70 p-3 text-left transition-colors hover:border-primary/30 hover:text-foreground"
            onClick={() => onTabSelect("placement")}
          >
            <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              <Info className="size-3.5" />
              Collection
            </div>
            <div className="truncate text-sm text-foreground">
              {collectionSummary}
            </div>
          </button>
        </>
      ) : null}
    </div>
  );
}
