"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/utils";
import { useQuery } from "convex/react";
import {
  DollarSign,
  FileCheck,
  History,
  Plus,
  Shield,
  Truck,
} from "lucide-react";
import { format } from "date-fns";

interface FineArtDetailsTabProps {
  collectionId: string;
  organizationId: Id<"organizations">;
}

export function FineArtDetailsTab({
  collectionId,
  organizationId,
}: FineArtDetailsTabProps) {
  const details = useQuery(api.fineArtDetails.get, {
    collectionId: collectionId as Id<"collections">,
  });

  if (details === undefined) {
    return (
      <div className="flex h-32 items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Loading fine art details...
        </p>
      </div>
    );
  }

  if (details === null) {
    return (
      <div className="space-y-6">
        <div className="flex h-32 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border">
          <p className="text-sm text-muted-foreground">
            No fine art details recorded yet
          </p>
          <Button variant="outline" size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Fine Art Details
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
          <div className="mb-2 flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-emerald-500" />
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Appraised Value
            </span>
          </div>
          <span className="text-2xl font-light text-foreground">
            {details.appraisedValue
              ? `$${details.appraisedValue.toLocaleString()}`
              : "—"}
          </span>
        </div>

        <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
          <div className="mb-2 flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-blue-500" />
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Replacement Value
            </span>
          </div>
          <span className="text-2xl font-light text-foreground">
            {details.replacementValue
              ? `$${details.replacementValue.toLocaleString()}`
              : "—"}
          </span>
        </div>

        <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Shield className="h-4 w-4 text-purple-500" />
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Insurance Policy
            </span>
          </div>
          <span className="text-sm font-medium text-foreground">
            {details.insurancePolicyNumber || "Not insured"}
          </span>
          {details.insuranceCarrier && (
            <p className="mt-1 text-xs text-muted-foreground">
              {details.insuranceCarrier}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
          <div className="mb-2 flex items-center gap-2">
            <FileCheck className="h-4 w-4 text-amber-500" />
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Display Status
            </span>
          </div>
          <span
            className={cn(
              "inline-flex rounded px-2 py-0.5 text-xs font-medium",
              details.displayStatus === "on_display"
                ? "bg-emerald-500/10 text-emerald-500"
                : details.displayStatus === "loaned_out"
                  ? "bg-blue-500/10 text-blue-500"
                  : details.displayStatus === "in_transit"
                    ? "bg-amber-500/10 text-amber-500"
                    : "bg-secondary text-muted-foreground",
            )}
          >
            {details.displayStatus?.replace(/_/g, " ") || "Unknown"}
          </span>
        </div>
      </div>

      {details.reappraisalDate && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2">
            <FileCheck className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium text-amber-500">
              Reappraisal Due:{" "}
              {format(new Date(details.reappraisalDate), "MMMM d, yyyy")}
            </span>
          </div>
        </div>
      )}

      <div>
        <h3 className="mb-4 flex items-center gap-2 text-xs font-medium text-foreground">
          <History className="h-4 w-4 text-purple-500" />
          Provenance Chain
        </h3>

        {details.provenanceChain && details.provenanceChain.length > 0 ? (
          <div className="relative space-y-4 border-l border-border pl-8">
            {details.provenanceChain.map((entry, index) => (
              <div key={`${entry.owner}-${index}`} className="relative">
                <div
                  className={cn(
                    "absolute -left-[39px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-background",
                    index === 0
                      ? "border-2 border-accent"
                      : "border-2 border-muted-foreground/50",
                  )}
                >
                  {index === 0 && (
                    <div className="h-1.5 w-1.5 rounded-full bg-accent" />
                  )}
                </div>
                <div className="rounded-lg border border-border/60 bg-secondary/20 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase",
                          entry.eventType === "sale"
                            ? "bg-emerald-500/10 text-emerald-500"
                            : entry.eventType === "auction"
                              ? "bg-amber-500/10 text-amber-500"
                              : entry.eventType === "inheritance"
                                ? "bg-purple-500/10 text-purple-500"
                                : "bg-secondary text-muted-foreground",
                        )}
                      >
                        {entry.eventType}
                      </span>
                      <h4 className="text-sm font-semibold text-foreground">
                        {entry.owner}
                      </h4>
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">
                      {entry.startYear}
                      {entry.endYear ? ` – ${entry.endYear}` : " – Present"}
                    </span>
                  </div>
                  {entry.location && (
                    <p className="text-xs text-muted-foreground">
                      {entry.location}
                    </p>
                  )}
                  {entry.salePrice && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Sale Price: ${entry.salePrice.toLocaleString()}{" "}
                      {entry.currency || "USD"}
                      {entry.auctionHouse && ` at ${entry.auctionHouse}`}
                    </p>
                  )}
                  {entry.notes && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {entry.notes}
                    </p>
                  )}
                  {entry.verified && (
                    <div className="mt-2 flex items-center gap-1 text-[10px] text-emerald-500">
                      <FileCheck className="h-3 w-3" />
                      Verified
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-border">
            <p className="text-sm text-muted-foreground">
              No provenance chain recorded
            </p>
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-4 flex items-center gap-2 text-xs font-medium text-foreground">
          <Truck className="h-4 w-4 text-cyan-500" />
          Shipping & Movement Log
        </h3>

        {details.shippingLogs && details.shippingLogs.length > 0 ? (
          <div className="space-y-3">
            {details.shippingLogs.map((log, index) => (
              <div
                key={`${log.fromLocation}-${log.toLocation}-${index}`}
                className="rounded-lg border border-border/60 bg-secondary/20 p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {log.fromLocation}
                    </span>
                    <span className="text-muted-foreground">→</span>
                    <span className="text-sm font-medium text-foreground">
                      {log.toLocation}
                    </span>
                  </div>
                  {log.arrivedAt && (
                    <span className="font-mono text-xs text-muted-foreground">
                      {format(new Date(log.arrivedAt), "MMM d, yyyy")}
                    </span>
                  )}
                </div>
                {log.carrier && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Carrier: {log.carrier}
                    {log.trackingNumber && ` (${log.trackingNumber})`}
                  </p>
                )}
                {log.notes && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {log.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-border">
            <p className="text-sm text-muted-foreground">No shipping records</p>
          </div>
        )}
      </div>
    </div>
  );
}
