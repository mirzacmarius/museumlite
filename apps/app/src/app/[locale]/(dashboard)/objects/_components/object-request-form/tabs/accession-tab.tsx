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
import { ACQUISITION_METHODS } from "../../collection-form-shared/constants";
import { EditSection } from "../../collection-form-shared/edit-section";
import type { CollectionFormTabProps } from "../../collection-form-shared/types";

export function ObjectRequestAccessionTab({
  formData,
  updateField,
  placeholders,
  currentOrganizationId,
  _isLocationTrackingEnabled,
}: CollectionFormTabProps) {
  return (
    <div className="space-y-8">
      <EditSection
        title="Acquisition information"
        description="Record how the object enters the collection and who it comes from."
      >
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="acquisitionMethod">Acquisition Type</Label>
            <Select
              value={formData.acquisitionMethod || undefined}
              onValueChange={(value) => updateField("acquisitionMethod", value)}
            >
              <SelectTrigger id="acquisitionMethod">
                <SelectValue placeholder="Select acquisition type" />
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
        title="Previous owners"
        description="Capture known previous owners as simple accession context."
      >
        <RepeatableTextField
          id="previous_owners"
          label="Previous Owner"
          value={formData.previous_owners || []}
          onChange={(value) => updateField("previous_owners", value)}
          placeholder="Owner name"
        />
      </EditSection>
    </div>
  );
}
