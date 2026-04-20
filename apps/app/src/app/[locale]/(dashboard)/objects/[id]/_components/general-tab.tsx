"use client";

import { useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import { cn } from "@v1/ui/utils";
import { useQuery } from "convex/react";
import {
  Building2,
  CheckCircle,
  FileCheck,
  History,
  Link as LinkIcon,
  Tag,
} from "lucide-react";
import { formatOwnershipDateRange } from "./format-ownership-date-range";
import type { CollectionData } from "./types";

interface GeneralTabProps {
  collection: CollectionData;
}

export function GeneralTab({ collection }: GeneralTabProps) {
  const tObjects = useScopedI18n("objects.printView");
  const collectionGroup = useQuery(
    api.collectionGroups.get,
    collection.collectionGroupId
      ? { groupId: collection.collectionGroupId }
      : "skip",
  );
  const hasHistoricalContext =
    Boolean(collection.provenance) ||
    Boolean(collection.exhibitionHistory) ||
    Boolean(
      collection.ownershipHistory && collection.ownershipHistory.length > 0,
    );

  return (
    <div className="space-y-8">
      {/* Classification & Metadata */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-xs font-medium text-foreground">
            <Tag className="h-4 w-4 text-accent" />
            Classification & Metadata
          </h3>
        </div>

        <div className="space-y-6 rounded-xl border border-border/60 bg-secondary/20 p-6">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            {/* Collection Group */}
            <div className="grid gap-1">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Collection
              </label>
              <div className="text-sm text-foreground">
                {collectionGroup?.name || "—"}
              </div>
            </div>

            {/* Object Type */}
            <div className="grid gap-1">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Object Type
              </label>
              <div className="text-sm text-foreground">
                {collection.objectType
                  ? (() => {
                      try {
                        const types = JSON.parse(collection.objectType);
                        return Array.isArray(types)
                          ? types.join(" / ")
                          : collection.objectType;
                      } catch {
                        return collection.objectType;
                      }
                    })()
                  : "—"}
              </div>
            </div>

            {/* Culture */}
            <div className="grid gap-1">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Culture
              </label>
              <div className="text-sm text-foreground">
                {collection.culture || "—"}
              </div>
            </div>

            {/* Artist / Maker */}
            <div className="grid gap-1">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Artist / Maker
              </label>
              <div className="text-sm text-foreground">
                {collection.creator || "—"}
              </div>
            </div>
          </div>

          {/* Provenance & Exhibition History */}
          {(collection.provenance || collection.exhibitionHistory) && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {collection.provenance && (
                <div className="grid gap-2">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Provenance
                  </label>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                    {collection.provenance}
                  </p>
                </div>
              )}

              {collection.exhibitionHistory && (
                <div className="grid gap-2">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Exhibition History
                  </label>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                    {collection.exhibitionHistory}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* External Links */}
          {collection.links && collection.links.length > 0 && (
            <div className="space-y-3 pt-2">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                External Links
              </label>
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
          )}

          {/* Status Display */}
          {collection.isHighResDownloadable && (
            <div className="flex items-center gap-8 border-t border-border/60 pt-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-2.5 w-2.5 items-center justify-center rounded-full bg-accent">
                  <CheckCircle className="h-1.5 w-1.5 text-white" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">
                  High-Res Downloadable
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div>
        <h3 className="mb-4 flex items-center gap-2 text-xs font-medium text-foreground">
          <Building2 className="h-4 w-4 text-emerald-500" />
          Acquisition Information
        </h3>
        <div className="rounded-xl border border-border/60 bg-secondary/20 p-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
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

            <div>
              <span className="mb-1 block text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Date
              </span>
              <span className="text-sm text-muted-foreground">
                {collection.donated_date || "—"}
              </span>
            </div>
          </div>

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

      <div>
        <h3 className="mb-6 flex items-center gap-2 text-xs font-medium text-foreground">
          <History className="h-4 w-4 text-purple-500" />
          Provenance & Exhibition History
        </h3>

        {hasHistoricalContext ? (
          <div className="space-y-6">
            {(collection.provenance || collection.exhibitionHistory) && (
              <div className="grid grid-cols-1 gap-6 rounded-xl border border-border/60 bg-secondary/20 p-6 md:grid-cols-2">
                {collection.provenance && (
                  <div className="grid gap-2">
                    <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Provenance
                    </label>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                      {collection.provenance}
                    </p>
                  </div>
                )}

                {collection.exhibitionHistory && (
                  <div className="grid gap-2">
                    <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Exhibition History
                    </label>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                      {collection.exhibitionHistory}
                    </p>
                  </div>
                )}
              </div>
            )}

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
            ) : null}
          </div>
        ) : (
          <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-border">
            <p className="text-sm text-muted-foreground">
              No provenance or exhibition history recorded
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
