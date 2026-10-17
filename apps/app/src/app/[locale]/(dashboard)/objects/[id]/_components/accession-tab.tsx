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
  const alternateNumbers = collection.alternateAccessionNumbers ?? [];
  return (
    <DetailSection
      title={tRoot("untranslatedRecords.objects.detail.acquisitionInformation")}
      icon={Building2}
    >
      <DetailGrid>
        <DetailField label={tRoot("objects.form.accessionNumber")}>
          <span className="break-all font-mono text-sm text-foreground">
            {collection.accessionNumber}
          </span>
        </DetailField>
        <DetailField label={tRoot("objects.form.alternateAccessionNumbers")}>
          {alternateNumbers.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {alternateNumbers.map((number) => (
                <span
                  key={number}
                  className="rounded-md border border-border/60 px-2 py-0.5 font-mono text-xs text-muted-foreground"
                >
                  {number}
                </span>
              ))}
            </div>
          ) : null}
        </DetailField>
        <DetailField
          label={tRoot("untranslatedRecords.objects.detail.acquisitionType")}
          value={collection.acquisitionMethod}
        />
        <DetailField
          label={tRoot("objects.printView.creditLine")}
          value={collection.creditLine}
        />
        <DetailField
          label={tRoot("objects.form.donatedBy")}
          value={collection.donated_by?.join(", ")}
        />
        <DetailField
          label={tRoot("objects.form.donatedDate")}
          value={collection.donated_date}
        />
      </DetailGrid>

      <DetailField
        className="mt-5 border-t border-border/60 pt-5"
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
