"use client";

import { Button } from "@v1/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@v1/ui/dropdown-menu";
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import { Edit, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import * as React from "react";
import {
  DonorCombobox,
  UNKNOWN_DONORS_VALUE,
} from "@/components/donor-combobox";
import { PartialDateField } from "@/components/partial-date-field";
import { formatPartialDate } from "@/lib/format-date";
import { useCurrentLocale, useI18n } from "@/locales/client";

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

function SummaryValue({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 break-words text-sm text-foreground">
        {children || <span className="text-muted-foreground/70">-</span>}
      </div>
    </div>
  );
}

/**
 * Donor, date and notes of a gift. Once entered they read as a compact
 * summary with an Edit and Delete menu (MUS-869); the fields open only while
 * staff add or edit them.
 */
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
  const locale = useCurrentLocale();
  const hasDonationDetails =
    donatedBy.length > 0 ||
    Boolean(donatedDate?.trim()) ||
    Boolean(donationInfo?.trim());
  const [isEditing, setIsEditing] = React.useState(false);

  const handleDelete = () => {
    onDonatedByChange([]);
    onDonatedDateChange("");
    onDonationInfoChange("");
    setIsEditing(false);
  };

  return (
    <div className="space-y-2">
      <Label>{translate("untranslatedComponents.labels.donatedBy")}</Label>

      {isEditing ? (
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
              onClick={() => setIsEditing(false)}
              className="shrink-0"
            >
              {translate("untranslatedRecords.objects.form.finishEditing")}
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

          <PartialDateField
            id="donated_date"
            label={translate("untranslatedComponents.labels.date")}
            value={donatedDate}
            onChange={onDonatedDateChange}
          />

          <div className="space-y-2">
            <Label htmlFor="donation_info">
              {translate("untranslatedComponents.labels.infoAboutTheDonation")}
            </Label>
            <Textarea
              autoResize
              id="donation_info"
              value={donationInfo || ""}
              onChange={(event) => onDonationInfoChange(event.target.value)}
              rows={3}
              placeholder={donationInfoPlaceholder}
            />
          </div>
        </div>
      ) : hasDonationDetails ? (
        <div className="flex items-start gap-3 rounded-lg border border-border bg-card/60 p-4">
          <div className="grid min-w-0 flex-1 gap-4 sm:grid-cols-2">
            <SummaryValue
              label={translate("untranslatedComponents.labels.name")}
            >
              {donatedBy
                .map((donor) =>
                  donor === UNKNOWN_DONORS_VALUE
                    ? translate(
                        "untranslatedComponents.donorCreate.unknownDonors",
                      )
                    : donor,
                )
                .join(", ")}
            </SummaryValue>
            <SummaryValue
              label={translate("untranslatedComponents.labels.date")}
            >
              {donatedDate?.trim()
                ? formatPartialDate(donatedDate, locale)
                : null}
            </SummaryValue>
            {donationInfo?.trim() ? (
              <SummaryValue
                label={translate(
                  "untranslatedComponents.labels.infoAboutTheDonation",
                )}
                className="sm:col-span-2"
              >
                <p className="whitespace-pre-wrap">{donationInfo.trim()}</p>
              </SummaryValue>
            ) : null}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0 text-muted-foreground"
                aria-label={translate("untranslatedComponents.labels.actions")}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsEditing(true)}>
                <Edit className="mr-2 size-4" />
                {translate("untranslatedRecords.objects.actions.edit")}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={handleDelete}
              >
                <Trash2 className="mr-2 size-4" />
                {translate("untranslatedRecords.deaccessions.actions.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
            onClick={() => setIsEditing(true)}
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
