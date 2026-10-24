"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { DonationDetailsField } from "@/components/donation-details-field";
import { useI18n } from "@/locales/client";
import {
  CreditLineField,
  LegalRestrictionsField,
} from "../../collection-form-shared/catalog-parity-fields";
import { ACQUISITION_METHODS } from "../../collection-form-shared/constants";
import { EditSection } from "../../collection-form-shared/edit-section";
import { RightsStatementField } from "../../collection-form-shared/object-description-fields";
import type { CollectionFormTabProps } from "../../collection-form-shared/types";
export interface CollectionEditAccessionTabProps
  extends CollectionFormTabProps {
  typedCollectionId?: Id<"collections">;
}

export function CollectionEditAccessionTab({
  formData,
  updateField,
  placeholders,
  currentOrganizationId,
  typedCollectionId,
}: CollectionEditAccessionTabProps) {
  const tRoot = useI18n();
  return (
    <div className="space-y-8">
      <EditSection
        title={tRoot(
          "untranslatedRecords.objects.detail.acquisitionInformation",
        )}
        description={tRoot("untranslatedRecords.objects.form.recordHowEntered")}
      >
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="acquisitionMethod">
              {tRoot("untranslatedRecords.objects.detail.acquisitionType")}
            </Label>
            <Select
              value={formData.acquisitionMethod || undefined}
              onValueChange={(value) => updateField("acquisitionMethod", value)}
            >
              <SelectTrigger id="acquisitionMethod">
                <SelectValue
                  placeholder={tRoot(
                    "untranslatedRecords.objects.form.selectAcquisitionType",
                  )}
                />
              </SelectTrigger>
              <SelectContent>
                {ACQUISITION_METHODS.map((method) => (
                  <SelectItem key={method} value={method}>
                    {method}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DonationDetailsField
            organizationId={currentOrganizationId}
            collectionId={typedCollectionId}
            donatedBy={formData.donated_by || []}
            donatedDate={formData.donated_date}
            donationInfo={formData.donation_info}
            donorPlaceholder={placeholders("selectDonors")}
            donationInfoPlaceholder={placeholders("donationInfoLong")}
            onDonatedByChange={(value) => updateField("donated_by", value)}
            onDonatedDateChange={(value) => updateField("donated_date", value)}
            onDonationInfoChange={(value) =>
              updateField("donation_info", value)
            }
          />

          <CreditLineField formData={formData} updateField={updateField} />
          <RightsStatementField
            formData={formData}
            updateField={updateField}
            currentOrganizationId={currentOrganizationId}
          />
          <LegalRestrictionsField
            formData={formData}
            updateField={updateField}
          />
        </div>
      </EditSection>
    </div>
  );
}
