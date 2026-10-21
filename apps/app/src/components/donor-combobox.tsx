"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Command } from "@v1/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import { useQuery } from "convex/react";
import * as React from "react";
import { useI18n } from "@/locales/client";
import { DonorComboboxCreateDialog } from "./donor-combobox-create-dialog";
import { DonorComboboxListContent } from "./donor-combobox-list-content";
import { DonorComboboxTrigger } from "./donor-combobox-trigger";
import {
  type DonorComboboxProps,
  UNKNOWN_DONORS_VALUE,
} from "./donor-combobox-types";
import { useDonorCreate } from "./use-donor-create";

export type { DonorComboboxProps } from "./donor-combobox-types";
export { UNKNOWN_DONORS_VALUE } from "./donor-combobox-types";

const EMPTY_DONOR_VALUES: string[] = [];

export function DonorCombobox({
  organizationId,
  value = EMPTY_DONOR_VALUES,
  onValueChange,
  placeholder,
  disabled = false,
  includeUnknownOption = false,
}: DonorComboboxProps) {
  const listId = React.useId();
  const translate = useI18n();
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");

  const selectedValues = React.useMemo(() => {
    return Array.isArray(value) ? value : [];
  }, [value]);

  const donors = useQuery(
    api.donors.list,
    organizationId
      ? { organizationId: organizationId as Id<"organizations"> }
      : "skip",
  );

  const donorOptions = React.useMemo(() => {
    const organizationDonors = (donors || []).map((donor) => ({
      value: donor.name,
      label: donor.name,
      email: donor.email,
      contactSummary: [donor.email, donor.phone, donor.address]
        .filter((value): value is string => Boolean(value))
        .join(" • "),
    }));

    if (
      includeUnknownOption &&
      !organizationDonors.some(
        (donor) =>
          donor.value.toLowerCase() === UNKNOWN_DONORS_VALUE.toLowerCase(),
      )
    ) {
      organizationDonors.unshift({
        value: UNKNOWN_DONORS_VALUE,
        label: translate("untranslatedComponents.donorCreate.unknownDonors"),
        email: undefined,
        contactSummary: translate(
          "untranslatedComponents.donorCreate.unknownDonorsHint",
        ),
      });
    }

    return organizationDonors;
  }, [donors, includeUnknownOption, translate]);

  const {
    newDonorDialogOpen,
    setNewDonorDialogOpen,
    newDonorForm,
    setNewDonorForm,
    emailError,
    setEmailError,
    isSubmitting,
    resetNewDonorForm,
    openCreateDialog,
    handleConfirmCreateDonor,
  } = useDonorCreate({
    organizationId,
    donorOptions,
    selectedValues,
    onValueChange,
    onCreated: () => setInputValue(""),
  });

  const handleSelect = (selectedValue: string) => {
    const isSelected = selectedValues.some(
      (v) => v.toLowerCase() === selectedValue.toLowerCase(),
    );

    if (isSelected) {
      onValueChange?.(
        selectedValues.filter(
          (v) => v.toLowerCase() !== selectedValue.toLowerCase(),
        ),
      );
    } else {
      onValueChange?.([...selectedValues, selectedValue]);
    }
    setInputValue("");
  };

  const handleRemove = (donorToRemove: string) => {
    onValueChange?.(selectedValues.filter((v) => v !== donorToRemove));
  };

  const filteredDonors = donorOptions.filter((donor) =>
    donor.label.toLowerCase().includes(inputValue.toLowerCase()),
  );
  const specialDonorOptions = filteredDonors.filter(
    (donor) => donor.value === UNKNOWN_DONORS_VALUE,
  );
  const organizationDonorOptions = filteredDonors.filter(
    (donor) => donor.value !== UNKNOWN_DONORS_VALUE,
  );

  const handleCreateDonorClick = () => {
    if (!inputValue.trim()) return;
    setOpen(false);
    openCreateDialog(inputValue);
  };

  return (
    <div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild nativeButton={false}>
          <DonorComboboxTrigger
            listId={listId}
            disabled={disabled}
            placeholder={
              placeholder ??
              translate("untranslatedComponents.donorCreate.placeholder")
            }
            selectedValues={selectedValues}
            inputValue={inputValue}
            open={open}
            onOpenChange={setOpen}
            onInputChange={setInputValue}
            onRemove={handleRemove}
            onEnterKey={() => {
              if (filteredDonors.length > 0 && filteredDonors[0]) {
                handleSelect(filteredDonors[0].value);
              } else {
                handleCreateDonorClick();
              }
            }}
          />
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command shouldFilter={false}>
            <DonorComboboxListContent
              listId={listId}
              inputValue={inputValue}
              organizationId={organizationId}
              selectedValues={selectedValues}
              specialDonorOptions={specialDonorOptions}
              organizationDonorOptions={organizationDonorOptions}
              onSelect={handleSelect}
              onCreateDonorClick={handleCreateDonorClick}
            />
          </Command>
        </PopoverContent>
      </Popover>

      <DonorComboboxCreateDialog
        open={newDonorDialogOpen}
        onOpenChange={setNewDonorDialogOpen}
        newDonorForm={newDonorForm}
        setNewDonorForm={setNewDonorForm}
        emailError={emailError}
        setEmailError={setEmailError}
        isSubmitting={isSubmitting}
        onConfirm={handleConfirmCreateDonor}
        onReset={() => resetNewDonorForm()}
      />
    </div>
  );
}
