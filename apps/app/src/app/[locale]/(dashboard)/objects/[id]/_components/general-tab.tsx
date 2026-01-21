"use client";

import { api } from "@v1/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import { CheckCircle, Link as LinkIcon, Tag } from "lucide-react";
import type { CollectionData } from "./types";

interface GeneralTabProps {
  collection: CollectionData;
}

export function GeneralTab({ collection }: GeneralTabProps) {
  const collectionGroup = useQuery(
    api.collectionGroups.get,
    collection.collectionGroupId
      ? { groupId: collection.collectionGroupId }
      : "skip",
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

          {/* Description */}
          {collection.description && (
            <div className="grid gap-2">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Description
              </label>
              <p className="max-w-3xl whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {collection.description}
              </p>
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
    </div>
  );
}
