"use client";

import { cn } from "@v1/ui/utils";
import { Building2, FileCheck, History } from "lucide-react";
import type { CollectionData } from "./types";

interface ProvenanceTabProps {
  collection: CollectionData;
}

export function ProvenanceTab({ collection }: ProvenanceTabProps) {
  return (
    <div className="space-y-8">
      {/* Acquisition Information */}
      <div>
        <h3 className="mb-4 flex items-center gap-2 text-xs font-medium text-foreground">
          <Building2 className="h-4 w-4 text-emerald-500" />
          Acquisition Information
        </h3>
        <div className="rounded-xl border border-border/60 bg-secondary/20 p-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* Method */}
            <div>
              <span className="mb-1 block text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Method
              </span>
              {collection.acquisitionMethod ? (
                <span className="inline-flex items-center rounded border border-emerald-500/30 bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
                  {collection.acquisitionMethod}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              )}
            </div>

            {/* Source / Donor */}
            <div>
              <span className="mb-1 block text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Source / Donor
              </span>
              {collection.donated_by && collection.donated_by.length > 0 ? (
                <div className="flex items-center gap-2">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-white">
                    {collection.donated_by[0]?.charAt(0) ?? "?"}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {collection.donated_by.join(", ")}
                  </span>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              )}
            </div>

            {/* Date */}
            <div>
              <span className="mb-1 block text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Date
              </span>
              <span className="text-sm text-muted-foreground">
                {collection.donated_date || "—"}
              </span>
            </div>
          </div>

          {/* Credit Line */}
          {collection.creditLine && (
            <div className="mt-4 border-t border-border/50 pt-4">
              <span className="mb-1 block text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Credit Line
              </span>
              <p className="font-serif text-sm italic text-muted-foreground">
                "{collection.creditLine}"
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Ownership History */}
      <div>
        <h3 className="mb-6 flex items-center gap-2 text-xs font-medium text-foreground">
          <History className="h-4 w-4 text-purple-500" />
          Ownership History
        </h3>

        {collection.ownershipHistory &&
        collection.ownershipHistory.length > 0 ? (
          <div className="relative space-y-8 border-l border-border pl-8">
            {collection.ownershipHistory.map((entry, index) => (
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
                <div className="max-w-2xl rounded-lg border border-border/60 bg-secondary/20 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-foreground">
                      {entry.owner}
                    </h4>
                    <span className="font-mono text-xs text-muted-foreground">
                      {entry.startYear}
                      {entry.endYear ? ` - ${entry.endYear}` : " - Present"}
                    </span>
                  </div>
                  {entry.description && (
                    <p className="text-sm text-muted-foreground">
                      {entry.description}
                    </p>
                  )}
                  {entry.verified && entry.verificationSource && (
                    <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                      <FileCheck className="h-3 w-3" />
                      Verified by {entry.verificationSource}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : collection.provenance ? (
          <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {collection.provenance}
            </p>
          </div>
        ) : (
          <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-border">
            <p className="text-sm text-muted-foreground">
              No provenance information recorded
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
