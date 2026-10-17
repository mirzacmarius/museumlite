"use client";

import { Building2 } from "lucide-react";
import { useI18n } from "@/locales/client";
import { DetailField, DetailGrid, DetailSection } from "./detail-section";
import type { CollectionData } from "./types";

interface AccessionTabProps {
  collection: CollectionData;
}

export function AccessionTab({ collection }: AccessionTabProps) {
  const tRoot = useI18n();
  return (
    <DetailSection
      title={tRoot("untranslatedRecords.objects.detail.acquisitionInformation")}
      icon={Building2}
    >
      <DetailGrid>
        <DetailField
          label={tRoot("untranslatedRecords.objects.detail.acquisitionType")}
        >
          {collection.acquisitionMethod ? (
            <span className="inline-flex w-fit items-center rounded border border-emerald-500/30 bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
              {collection.acquisitionMethod}
            </span>
          ) : null}
        </DetailField>

        <DetailField label={tRoot("objects.form.donatedBy")}>
          {collection.donated_by && collection.donated_by.length > 0 ? (
            <div className="flex items-center gap-2">
              <div className="flex size-5 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
                {collection.donated_by[0]?.charAt(0) ?? "?"}
              </div>
              <span className="text-sm text-foreground">
                {collection.donated_by.join(", ")}
              </span>
            </div>
          ) : null}
        </DetailField>
      </DetailGrid>

      <DetailField
        className="mt-5 border-t border-border/50 pt-5"
        label={tRoot("untranslatedRecords.objects.detail.donationDetails")}
      >
        {collection.donation_info ? (
          <p className="whitespace-pre-wrap text-sm text-foreground">
            {collection.donation_info}
          </p>
        ) : null}
      </DetailField>
    </DetailSection>
  );
}
