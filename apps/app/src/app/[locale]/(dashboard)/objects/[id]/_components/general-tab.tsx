"use client";

import { CheckCircle, Tag } from "lucide-react";
import { useI18n } from "@/locales/client";
import type { CollectionData } from "./types";

interface GeneralTabProps {
  collection: CollectionData;
  collectionGroupName?: string;
}

export function GeneralTab({
  collection,
  collectionGroupName,
}: GeneralTabProps) {
  const tRoot = useI18n();
  const collectionType: string | undefined = collection.collectionType;
  const collectionTypeLabel = collectionType
    ? collectionType === "fine_art"
      ? tRoot("untranslatedRecords.objects.enums.fineArt")
      : collectionType === "wine"
        ? tRoot("untranslatedRecords.objects.enums.wine")
        : collectionType === "automotive"
          ? tRoot("untranslatedRecords.objects.enums.automotive")
          : collectionType === "natural_history"
            ? tRoot("untranslatedRecords.objects.enums.naturalHistory")
            : collectionType === "archive"
              ? tRoot("untranslatedRecords.objects.enums.archive")
              : collectionType === "coins_stamps"
                ? tRoot("untranslatedRecords.objects.enums.coinsStamps")
                : collectionType === "general"
                  ? tRoot("untranslatedRecords.objects.enums.generalCollection")
                  : collectionType
    : tRoot("untranslatedRecords.objects.enums.generalCollection");

  return (
    <div>
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-xs font-medium text-foreground">
            <Tag className="size-4 text-accent" />
            {tRoot("untranslatedRecords.objects.detail.classificationMetadata")}
          </h3>
        </div>

        <div className="space-y-6 rounded-xl border border-border/60 bg-secondary/20 p-6">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div className="grid gap-1">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {tRoot("objects.form.collectionType")}
              </div>
              <div className="text-sm capitalize text-foreground">
                {collectionTypeLabel}
              </div>
            </div>

            <div className="grid gap-1">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {tRoot("objects.form.objectName")}
              </div>
              <div className="text-sm text-foreground">
                {collection.objectName || "-"}
              </div>
            </div>

            <div className="grid gap-1">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {tRoot("objects.form.collectionGroup")}
              </div>
              <div className="text-sm text-foreground">
                {collectionGroupName || "-"}
              </div>
            </div>

            <div className="grid gap-1">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {tRoot("objects.form.culture")}
              </div>
              <div className="text-sm text-foreground">
                {collection.culture || "-"}
              </div>
            </div>

            <div className="grid gap-1">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {tRoot("untranslatedRecords.objects.detail.artistMaker")}
              </div>
              <div className="text-sm text-foreground">
                {collection.creator || "-"}
              </div>
            </div>

            <div className="grid gap-1">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {tRoot("objects.form.period")}
              </div>
              <div className="text-sm text-foreground">
                {collection.period || "-"}
              </div>
            </div>

            <div className="grid gap-1">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {tRoot("objects.form.dateCreated")}
              </div>
              <div className="text-sm text-foreground">
                {collection.dateCreated || "-"}
              </div>
            </div>

            {collection.isHighResDownloadable && (
              <div className="flex items-center gap-2.5">
                <div className="flex size-2.5 items-center justify-center rounded-full bg-accent">
                  <CheckCircle className="size-1.5 text-white" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">
                  {tRoot(
                    "untranslatedRecords.objects.detail.highResDownloadable",
                  )}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
