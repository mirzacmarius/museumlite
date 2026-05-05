"use client";

import { CheckCircle, Hash, Tag } from "lucide-react";
import type { CollectionData } from "./types";

interface GeneralTabProps {
  collection: CollectionData;
  collectionGroupName?: string;
}

export function GeneralTab({
  collection,
  collectionGroupName,
}: GeneralTabProps) {
  const collectionTypeLabel =
    collection.collectionType?.replace(/_/g, " ") || "General";

  return (
    <div className="space-y-8">
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-xs font-medium text-foreground">
            <Hash className="h-4 w-4 text-accent" />
            Object identity
          </h3>
        </div>

        <div className="space-y-6 rounded-xl border border-border/60 bg-secondary/20 p-6">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="grid gap-1">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Object Name or Title
              </label>
              <div className="text-sm text-foreground">{collection.title}</div>
            </div>

            <div className="grid gap-1">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Accession Number
              </label>
              <div className="font-mono text-sm text-foreground">
                {collection.accessionNumber}
              </div>
            </div>

            <div className="grid gap-1">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Alternate Accession Numbers
              </label>
              {collection.alternateAccessionNumbers &&
              collection.alternateAccessionNumbers.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {collection.alternateAccessionNumbers.map((number) => (
                    <span
                      key={number}
                      className="rounded border border-border/60 bg-background/70 px-2 py-1 font-mono text-xs text-muted-foreground"
                    >
                      {number}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">-</div>
              )}
            </div>

            <div className="grid gap-1 md:col-span-3">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Description
              </label>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {collection.description || "-"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-xs font-medium text-foreground">
            <Tag className="h-4 w-4 text-accent" />
            Classification & Metadata
          </h3>
        </div>

        <div className="space-y-6 rounded-xl border border-border/60 bg-secondary/20 p-6">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div className="grid gap-1">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Collection Type
              </label>
              <div className="text-sm capitalize text-foreground">
                {collectionTypeLabel}
              </div>
            </div>

            <div className="grid gap-1">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Object Name
              </label>
              <div className="text-sm text-foreground">
                {collection.objectName || "-"}
              </div>
            </div>

            <div className="grid gap-1">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Collection
              </label>
              <div className="text-sm text-foreground">
                {collectionGroupName || "-"}
              </div>
            </div>

            <div className="grid gap-1">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Culture
              </label>
              <div className="text-sm text-foreground">
                {collection.culture || "-"}
              </div>
            </div>

            <div className="grid gap-1">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Artist / Maker
              </label>
              <div className="text-sm text-foreground">
                {collection.creator || "-"}
              </div>
            </div>

            <div className="grid gap-1">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Period
              </label>
              <div className="text-sm text-foreground">
                {collection.period || "-"}
              </div>
            </div>

            <div className="grid gap-1">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Date Created
              </label>
              <div className="text-sm text-foreground">
                {collection.dateCreated || "-"}
              </div>
            </div>

            {collection.isHighResDownloadable && (
              <div className="flex items-center gap-2.5">
                <div className="flex h-2.5 w-2.5 items-center justify-center rounded-full bg-accent">
                  <CheckCircle className="h-1.5 w-1.5 text-white" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">
                  High-Res Downloadable
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
