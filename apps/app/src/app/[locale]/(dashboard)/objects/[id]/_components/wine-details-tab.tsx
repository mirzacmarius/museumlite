"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/utils";
import { useQuery } from "convex/react";
import {
  Calendar,
  DollarSign,
  Droplets,
  GlassWater,
  Grape,
  MapPin,
  Plus,
  Wine,
} from "lucide-react";

interface WineDetailsTabProps {
  collectionId: string;
  organizationId: Id<"organizations">;
}

export function WineDetailsTab({
  collectionId,
  organizationId,
}: WineDetailsTabProps) {
  const details = useQuery(api.wineDetails.get, {
    collectionId: collectionId as Id<"collections">,
  });

  if (details === undefined) {
    return (
      <div className="flex h-32 items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading wine details...</p>
      </div>
    );
  }

  if (details === null) {
    return (
      <div className="space-y-6">
        <div className="flex h-32 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border">
          <p className="text-sm text-muted-foreground">
            No wine details recorded yet
          </p>
          <Button variant="outline" size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Wine Details
          </Button>
        </div>
      </div>
    );
  }

  const currentYear = new Date().getFullYear();
  const isInPeakWindow =
    details.peakWindowStart &&
    details.peakWindowEnd &&
    currentYear >= details.peakWindowStart &&
    currentYear <= details.peakWindowEnd;

  const isPastPeak =
    details.peakWindowEnd && currentYear > details.peakWindowEnd;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Grape className="h-4 w-4 text-purple-500" />
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Vintage
            </span>
          </div>
          <span className="text-3xl font-light text-foreground">
            {details.vintage || "NV"}
          </span>
        </div>

        <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Wine className="h-4 w-4 text-rose-500" />
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Producer
            </span>
          </div>
          <span className="text-sm font-medium text-foreground">
            {details.producer || "Unknown"}
          </span>
          {details.region && (
            <p className="mt-1 text-xs text-muted-foreground">
              {details.region}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
          <div className="mb-2 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-amber-500" />
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Cellar Location
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            {details.binNumber && (
              <span className="rounded bg-secondary px-2 py-0.5 font-mono text-sm text-foreground">
                Bin {details.binNumber}
              </span>
            )}
            {details.rackNumber && (
              <span className="text-xs text-muted-foreground">
                Rack {details.rackNumber}
              </span>
            )}
            {details.rowNumber && (
              <span className="text-xs text-muted-foreground">
                Row {details.rowNumber}
              </span>
            )}
            {!details.binNumber && !details.rackNumber && (
              <span className="text-sm text-muted-foreground">
                Not specified
              </span>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
          <div className="mb-2 flex items-center gap-2">
            <GlassWater className="h-4 w-4 text-cyan-500" />
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Quantity
            </span>
          </div>
          <span className="text-2xl font-light text-foreground">
            {details.quantity || 1}
          </span>
          <span className="ml-1 text-sm text-muted-foreground">
            {details.bottleSize || "750ml"}
          </span>
        </div>
      </div>

      {(details.peakWindowStart || details.peakWindowEnd) && (
        <div
          className={cn(
            "rounded-lg border p-4",
            isInPeakWindow
              ? "border-emerald-500/30 bg-emerald-500/5"
              : isPastPeak
                ? "border-amber-500/30 bg-amber-500/5"
                : "border-border/60 bg-secondary/20",
          )}
        >
          <div className="flex items-center gap-2">
            <Calendar
              className={cn(
                "h-4 w-4",
                isInPeakWindow
                  ? "text-emerald-500"
                  : isPastPeak
                    ? "text-amber-500"
                    : "text-muted-foreground",
              )}
            />
            <span
              className={cn(
                "text-sm font-medium",
                isInPeakWindow
                  ? "text-emerald-500"
                  : isPastPeak
                    ? "text-amber-500"
                    : "text-foreground",
              )}
            >
              Peak Drinking Window: {details.peakWindowStart} –{" "}
              {details.peakWindowEnd}
            </span>
            {isInPeakWindow && (
              <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-500">
                Drink Now
              </span>
            )}
            {isPastPeak && (
              <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-500">
                Past Peak
              </span>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <h3 className="mb-4 flex items-center gap-2 text-xs font-medium text-foreground">
            <Droplets className="h-4 w-4 text-blue-500" />
            Bottle Condition
          </h3>
          <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                  Fill Level
                </span>
                <p
                  className={cn(
                    "mt-1 text-sm font-medium",
                    details.fillLevel === "into_neck" ||
                      details.fillLevel === "top_shoulder"
                      ? "text-emerald-500"
                      : details.fillLevel === "below_shoulder"
                        ? "text-rose-500"
                        : "text-foreground",
                  )}
                >
                  {details.fillLevel?.replace(/_/g, " ") || "Not checked"}
                </p>
              </div>
              <div>
                <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                  Closure
                </span>
                <p className="mt-1 text-sm text-foreground">
                  {details.closureType || "Unknown"}
                </p>
              </div>
              <div>
                <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                  Label
                </span>
                <p className="mt-1 text-sm text-foreground">
                  {details.labelCondition || "Not assessed"}
                </p>
              </div>
              <div>
                <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                  Capsule
                </span>
                <p className="mt-1 text-sm text-foreground">
                  {details.capsuleCondition || "Not assessed"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="mb-4 flex items-center gap-2 text-xs font-medium text-foreground">
            <DollarSign className="h-4 w-4 text-emerald-500" />
            Valuation
          </h3>
          <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                  Purchase Price
                </span>
                <p className="mt-1 text-lg font-light text-foreground">
                  {details.purchasePrice
                    ? `$${details.purchasePrice.toLocaleString()}`
                    : "—"}
                </p>
              </div>
              <div>
                <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                  Current Value
                </span>
                <p className="mt-1 text-lg font-light text-emerald-500">
                  {details.currentValue
                    ? `$${details.currentValue.toLocaleString()}`
                    : "—"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-4 flex items-center gap-2 text-xs font-medium text-foreground">
          <Wine className="h-4 w-4 text-rose-500" />
          Wine Details
        </h3>
        <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Appellation
              </span>
              <p className="mt-1 text-sm text-foreground">
                {details.appellation || "—"}
              </p>
            </div>
            <div>
              <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Varietal
              </span>
              <p className="mt-1 text-sm text-foreground">
                {details.varietal || "—"}
              </p>
            </div>
            <div>
              <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Alcohol
              </span>
              <p className="mt-1 text-sm text-foreground">
                {details.alcoholContent ? `${details.alcoholContent}%` : "—"}
              </p>
            </div>
            <div>
              <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Region
              </span>
              <p className="mt-1 text-sm text-foreground">
                {details.region || "—"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {details.drinkingNotes && (
        <div>
          <h3 className="mb-4 text-xs font-medium text-foreground">
            Tasting Notes
          </h3>
          <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {details.drinkingNotes}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
