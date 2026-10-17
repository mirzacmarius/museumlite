"use client";

import { CheckCircle, Tag } from "lucide-react";
import { useI18n } from "@/locales/client";
import { DetailField, DetailGrid, DetailSection } from "./detail-section";
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
    <DetailSection
      title={tRoot("untranslatedRecords.objects.detail.classificationMetadata")}
      icon={Tag}
    >
      <DetailGrid>
        <DetailField
          label={tRoot("objects.form.collectionType")}
          value={collectionTypeLabel}
        />
        <DetailField
          label={tRoot("objects.form.objectName")}
          value={collection.objectName}
        />
        <DetailField
          label={tRoot("objects.form.collectionGroup")}
          value={collectionGroupName}
        />
        <DetailField
          label={tRoot("objects.form.culture")}
          value={collection.culture}
        />
        <DetailField
          label={tRoot("untranslatedRecords.objects.detail.artistMaker")}
          value={collection.creator}
        />
        <DetailField
          label={tRoot("objects.form.period")}
          value={collection.period}
        />
        <DetailField
          label={tRoot("objects.form.dateCreated")}
          value={collection.dateCreated}
        />
      </DetailGrid>
      {collection.isHighResDownloadable ? (
        <div className="mt-5 flex items-center gap-2 border-t border-border/60 pt-4">
          <CheckCircle className="size-4 text-status-success-foreground" />
          <span className="text-sm text-muted-foreground">
            {tRoot("untranslatedRecords.objects.detail.highResDownloadable")}
          </span>
        </div>
      ) : null}
    </DetailSection>
  );
}
