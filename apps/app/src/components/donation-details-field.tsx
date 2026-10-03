"use client";

import { Button } from "@v1/ui/button";
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import { Plus, Trash2 } from "lucide-react";
import * as React from "react";
import { DonorCombobox } from "@/components/donor-combobox";
import { PartialDateField } from "@/components/partial-date-field";
import { useI18n } from "@/locales/client";

interface DonationDetailsFieldProps {
  organizationId?: string;
  collectionId?: string;
  donatedBy: string[];
  donatedDate?: string;
  donationInfo?: string;
  donorPlaceholder?: string;
  donationInfoPlaceholder?: string;
  onDonatedByChange: (value: string[]) => void;
  onDonatedDateChange: (value: string) => void;
  onDonationInfoChange: (value: string) => void;
}

export function DonationDetailsField({
  organizationId,
  collectionId,
  donatedBy,
  donatedDate,
  donationInfo,
  donorPlaceholder,
  donationInfoPlaceholder,
  onDonatedByChange,
  onDonatedDateChange,
  onDonationInfoChange,
}: DonationDetailsFieldProps) {
  const translate = useI18n();
  const hasDonationDetails =
    donatedBy.length > 0 ||
    Boolean(donatedDate?.trim()) ||
    Boolean(donationInfo?.trim());
  const [isExpanded, setIsExpanded] = React.useState(hasDonationDetails);

  React.useEffect(() => {
    if (hasDonationDetails) {
      setIsExpanded(true);
    }
  }, [hasDonationDetails]);

  const handleClear = () => {
    onDonatedByChange([]);
    onDonatedDateChange("");
    onDonationInfoChange("");
    setIsExpanded(false);
  };

  return (
    <div className="space-y-2">
      <Label>{translate("untranslatedComponents.labels.donatedBy")}</Label>

      {isExpanded ? (
        <div className="space-y-4 rounded-lg border border-border bg-card/60 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {translate("untranslatedComponents.labels.donationDetails")}
              </p>
              <p className="text-xs text-muted-foreground">
                {translate(
                  "untranslatedComponents.labels.searchExistingDonorsAddANewDonorOrSelectUnknownDonors",
                )}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="shrink-0 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="mr-2 size-4" />
              {translate("untranslatedComponents.labels.remove")}
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="donated_by">
              {translate("untranslatedComponents.labels.name")}
            </Label>
            <DonorCombobox
              organizationId={organizationId}
              collectionId={collectionId}
              value={donatedBy}
              onValueChange={onDonatedByChange}
              placeholder={donorPlaceholder}
              includeUnknownOption
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <PartialDateField
              id="donated_date"
              label={translate("untranslatedComponents.labels.date")}
              value={donatedDate}
              onChange={onDonatedDateChange}
            />

            <div className="space-y-2">
              <Label htmlFor="donation_info">
                {translate(
                  "untranslatedComponents.labels.infoAboutTheDonation",
                )}
              </Label>
              <Textarea
                autoResize
                id="donation_info"
                value={donationInfo || ""}
                onChange={(event) => onDonationInfoChange(event.target.value)}
                rows={4}
                placeholder={donationInfoPlaceholder}
              />
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="text-sm text-muted-foreground">
            {translate(
              "untranslatedComponents.labels.noDonationDetailsYetClickAddDonatedByToAddTheDonorDonationDateAndNotes",
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsExpanded(true)}
            className="w-full"
          >
            <Plus className="mr-2 size-4" />
            {translate("untranslatedComponents.labels.addDonatedBy")}
          </Button>
        </>
      )}
    </div>
  );
}
