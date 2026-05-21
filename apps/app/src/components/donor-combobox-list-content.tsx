"use client";

import { Button } from "@v1/ui/button";
import {
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@v1/ui/command";
import { cn } from "@v1/ui/utils";
import { Check } from "lucide-react";
import {
  type DonorOption,
  formatDonorName,
  UNKNOWN_DONORS_VALUE,
} from "./donor-combobox-types";

interface DonorComboboxListContentProps {
  listId: string;
  inputValue: string;
  organizationId?: string;
  selectedValues: string[];
  specialDonorOptions: DonorOption[];
  organizationDonorOptions: DonorOption[];
  onSelect: (value: string) => void;
  onCreateDonorClick: () => void;
}

export function DonorComboboxListContent({
  listId,
  inputValue,
  organizationId,
  selectedValues,
  specialDonorOptions,
  organizationDonorOptions,
  onSelect,
  onCreateDonorClick,
}: DonorComboboxListContentProps) {
  return (
    <CommandList id={listId} className="max-h-[300px]">
      <CommandEmpty>
        {inputValue ? (
          <div className="p-4 text-sm text-center">
            <p className="text-muted-foreground mb-2">
              No matching donors found.
            </p>
            {organizationId && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Press{" "}
                  <kbd className="px-1.5 py-0.5 text-xs font-semibold border rounded bg-muted">
                    Enter
                  </kbd>{" "}
                  to add{" "}
                  <span className="font-medium text-foreground">
                    "{formatDonorName(inputValue)}"
                  </span>
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onCreateDonorClick}
                  className="w-full"
                >
                  Add Donor
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 text-sm text-muted-foreground text-center">
            Type to search donors
          </div>
        )}
      </CommandEmpty>

      {specialDonorOptions.length > 0 && (
        <CommandGroup heading="Special options">
          {specialDonorOptions.map((donor) => (
            <DonorListItem
              key={donor.value}
              donor={donor}
              selectedValues={selectedValues}
              onSelect={onSelect}
            />
          ))}
        </CommandGroup>
      )}

      {organizationDonorOptions.length > 0 && (
        <CommandGroup heading="Organization Donors">
          {organizationDonorOptions.map((donor) => (
            <DonorListItem
              key={donor.value}
              donor={donor}
              selectedValues={selectedValues}
              onSelect={onSelect}
            />
          ))}
        </CommandGroup>
      )}
    </CommandList>
  );
}

function DonorListItem({
  donor,
  selectedValues,
  onSelect,
}: {
  donor: DonorOption;
  selectedValues: string[];
  onSelect: (value: string) => void;
}) {
  const isSelected = selectedValues.some(
    (value) => value.toLowerCase() === donor.value.toLowerCase(),
  );

  return (
    <CommandItem
      value={donor.value}
      onSelect={() => onSelect(donor.value)}
      className="px-2 py-1.5"
    >
      <div className="flex w-full items-center gap-2">
        <Check
          className={cn(
            "size-4 shrink-0",
            isSelected ? "opacity-100" : "opacity-0",
          )}
        />
        <div className="flex-1 flex flex-col gap-0.5">
          <span className="text-sm">{donor.label}</span>
          {donor.contactSummary && (
            <span
              className="truncate text-xs text-muted-foreground"
              title={donor.contactSummary}
            >
              {donor.contactSummary}
            </span>
          )}
        </div>
      </div>
    </CommandItem>
  );
}

export { UNKNOWN_DONORS_VALUE };
