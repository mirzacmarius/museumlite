"use client";

import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { DonationDetailsField } from "@/components/donation-details-field";
import { RepeatableTextField } from "@/components/repeatable-text-field";
import { useI18n } from "@/locales/client";
import { ACQUISITION_METHODS } from "../../collection-form-shared/constants";
import { EditSection } from "../../collection-form-shared/edit-section";
import type { CollectionFormTabProps } from "../../collection-form-shared/types";
export function ObjectRequestAccessionTab({
  formData,
  updateField,
  placeholders,
  currentOrganizationId,
}: CollectionFormTabProps) {
  const tRoot = useI18n();
  return (
    <div className="space-y-8">
      <EditSection
        title={tRoot(
          "untranslatedRecords.objects.detail.acquisitionInformation",
        )}
        description={tRoot("untranslatedRecords.objects.form.recordHowEnters")}
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
            donatedBy={formData.donated_by || []}
            donatedDate={formData.donated_date}
            donationInfo={formData.donation_info}
            donorPlaceholder={placeholders("selectDonors")}
            donationInfoPlaceholder={placeholders("donationContext")}
            onDonatedByChange={(value) => updateField("donated_by", value)}
            onDonatedDateChange={(value) => updateField("donated_date", value)}
            onDonationInfoChange={(value) =>
              updateField("donation_info", value)
            }
          />
        </div>
      </EditSection>

      <EditSection
        title={tRoot("untranslatedRecords.objects.form.previousOwners")}
        description={tRoot(
          "untranslatedRecords.objects.form.capturePreviousOwners",
        )}
      >
        <RepeatableTextField
          id="previous_owners"
          label={tRoot("untranslatedRecords.objects.form.previousOwner")}
          value={formData.previous_owners || []}
          onChange={(value) => updateField("previous_owners", value)}
          placeholder={tRoot("objects.form.placeholders.ownerName")}
        />
      </EditSection>
    </div>
  );
}
