"use client";

import { useScopedI18n } from "@/locales/client";
import { cn } from "@v1/ui/utils";
import { FileCheck, History, Link as LinkIcon } from "lucide-react";
import { formatOwnershipDateRange } from "./format-ownership-date-range";
import type { CollectionData } from "./types";

interface ProvenanceHistoryTabProps {
  collection: CollectionData;
}

export function ProvenanceHistoryTab({
  collection,
}: ProvenanceHistoryTabProps) {
  const tObjects = useScopedI18n("objects.printView");
  const hasHistoricalContext =
    Boolean(collection.provenance) ||
    Boolean(collection.exhibitionHistory) ||
    Boolean(collection.links && collection.links.length > 0) ||
    Boolean(
      collection.ownershipHistory && collection.ownershipHistory.length > 0,
    );

  return (
    <div className="space-y-8">
      <div>
        <h3 className="mb-6 flex items-center gap-2 text-xs font-medium text-foreground">
          <History className="h-4 w-4 text-purple-500" />
          Provenance and History
        </h3>

        {hasHistoricalContext ? (
          <div className="space-y-6">
            {(collection.provenance || collection.exhibitionHistory) && (
              <div className="grid grid-cols-1 gap-6 rounded-xl border border-border/60 bg-secondary/20 p-6 md:grid-cols-2">
                {collection.provenance && (
                  <div className="grid gap-2">
                    <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Provenance
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                      {collection.provenance}
                    </p>
                  </div>
                )}

                {collection.exhibitionHistory && (
                  <div className="grid gap-2">
                    <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Exhibition History
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                      {collection.exhibitionHistory}
                    </p>
                  </div>
                )}
              </div>
            )}

            {collection.links && collection.links.length > 0 ? (
              <div className="space-y-3 rounded-xl border border-border/60 bg-secondary/20 p-6">
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Links
                </div>
                <div className="space-y-1">
                  {collection.links.map((link) => (
                    <a
                      key={link.url}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex w-max items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-accent hover:underline"
                    >
                      <LinkIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{link.label || link.url}</span>
                    </a>
                  ))}
                </div>
              </div>
            ) : null}

            {collection.ownershipHistory &&
            collection.ownershipHistory.length > 0 ? (
              <div>
                <h3 className="mb-4 flex items-center gap-2 text-xs font-medium text-foreground">
                  <History className="h-4 w-4 text-accent" />
                  Ownership History
                </h3>
                <div className="relative space-y-8 border-l border-border pl-8">
                  {collection.ownershipHistory.map((entry, index) => (
                    <div key={`${entry.owner}-${index}`} className="relative">
                      <div
                        className={cn(
                          "absolute -left-[39px] top-1.5 flex size-4 items-center justify-center rounded-full bg-background",
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
                          {formatOwnershipDateRange(entry, {
                            presentLabel: tObjects("present"),
                          }) ? (
                            <span className="font-mono text-xs text-muted-foreground">
                              {formatOwnershipDateRange(entry, {
                                presentLabel: tObjects("present"),
                              })}
                            </span>
                          ) : null}
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
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-border">
            <p className="text-sm text-muted-foreground">
              No provenance or exhibition history recorded.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
