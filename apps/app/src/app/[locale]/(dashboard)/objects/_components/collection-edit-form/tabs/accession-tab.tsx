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
import { ACQUISITION_METHODS } from "../../collection-form-shared/constants";
import { EditSection } from "../../collection-form-shared/edit-section";
import type { CollectionFormTabProps } from "../../collection-form-shared/types";

export interface CollectionEditAccessionTabProps
  extends CollectionFormTabProps {
  typedCollectionId: Id<"collections">;
}

export function CollectionEditAccessionTab({
  formData,
  updateField,
  placeholders,
  currentOrganizationId,
  typedCollectionId,
}: CollectionEditAccessionTabProps) {
  return (
    <div className="space-y-8">
      <EditSection
        title="Acquisition information"
        description="Record how the object entered the collection and who it came from."
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
        </div>
      </EditSection>
    </div>
  );
}
