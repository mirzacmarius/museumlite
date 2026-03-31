"use client";

import { useI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@v1/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import { Textarea } from "@v1/ui/textarea";
import { cn } from "@v1/ui/utils";
import { useMutation, useQuery } from "convex/react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

interface DonorComboboxProps {
  organizationId?: string;
  collectionId?: string;
  value?: string[];
  onValueChange?: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  includeUnknownOption?: boolean;
}

interface NewDonorForm {
  name: string;
  notes: string;
  phone: string;
  email: string;
  address: string;
}

const initialDonorForm: NewDonorForm = {
  name: "",
  notes: "",
  phone: "",
  email: "",
  address: "",
};

export const UNKNOWN_DONORS_VALUE = "Unknown donors";

export function DonorCombobox({
  organizationId,
  value = [],
  onValueChange,
  placeholder = "Select or add donors...",
  disabled = false,
  includeUnknownOption = false,
}: DonorComboboxProps) {
  const t = useI18n();
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");
  const [newDonorDialogOpen, setNewDonorDialogOpen] = React.useState(false);
  const [newDonorForm, setNewDonorForm] =
    React.useState<NewDonorForm>(initialDonorForm);
  const [emailError, setEmailError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Ensure value is always an array
  const selectedValues = React.useMemo(() => {
    return Array.isArray(value) ? value : [];
  }, [value]);

  // Fetch donors for the organization
  const donors = useQuery(
    api.donors.list,
    organizationId
      ? { organizationId: organizationId as Id<"organizations"> }
      : "skip",
  );

  // Mutations
  const createDonor = useMutation(api.donors.create);

  // Convert donors to options format
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
        label: UNKNOWN_DONORS_VALUE,
        email: undefined,
        contactSummary: "Use when the object was donated by an unnamed donor",
      });
    }

    return organizationDonors;
  }, [donors, includeUnknownOption]);

  const handleSelect = (selectedValue: string) => {
    const isSelected = selectedValues.some(
      (v) => v.toLowerCase() === selectedValue.toLowerCase(),
    );

    if (isSelected) {
      // Remove from selection
      onValueChange?.(
        selectedValues.filter(
          (v) => v.toLowerCase() !== selectedValue.toLowerCase(),
        ),
      );
    } else {
      // Add to selection
      onValueChange?.([...selectedValues, selectedValue]);
    }
    setInputValue("");
  };

  const handleRemove = (donorToRemove: string) => {
    onValueChange?.(selectedValues.filter((v) => v !== donorToRemove));
  };

  // Filter options based on search
  const filteredDonors = donorOptions.filter((donor) =>
    donor.label.toLowerCase().includes(inputValue.toLowerCase()),
  );
  const specialDonorOptions = filteredDonors.filter(
    (donor) => donor.value === UNKNOWN_DONORS_VALUE,
  );
  const organizationDonorOptions = filteredDonors.filter(
    (donor) => donor.value !== UNKNOWN_DONORS_VALUE,
  );

  // Format donor name with first letter uppercase
  const formatDonorName = (name: string): string => {
    const trimmed = name.trim();
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  };

  // Validate email format
  const validateEmail = (email: string): boolean => {
    if (!email.trim()) return true; // Empty is valid (optional field)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const resetNewDonorForm = React.useCallback((name = "") => {
    setNewDonorForm({ ...initialDonorForm, name });
    setEmailError(null);
    setIsSubmitting(false);
  }, []);

  // Handle creating new donor - show dialog first
  const handleCreateDonorClick = () => {
    if (!inputValue.trim()) return;
    resetNewDonorForm(formatDonorName(inputValue));
    setOpen(false);
    setNewDonorDialogOpen(true);
  };

  // Handle confirming new donor creation
  const handleConfirmCreateDonor = async (): Promise<boolean> => {
    if (!organizationId || !newDonorForm.name.trim() || isSubmitting) {
      return false;
    }

    const formattedName = formatDonorName(newDonorForm.name);
    const trimmedEmail = newDonorForm.email.trim();

    if (!validateEmail(trimmedEmail)) {
      setEmailError("Please enter a valid email address");
      return false;
    }

    setEmailError(null);

    // Check if donor already exists (case-insensitive) before creating
    const existingDonor = donorOptions.find(
      (d) => d.label.toLowerCase() === formattedName.toLowerCase(),
    );

    if (existingDonor) {
      // Donor already exists, just add to selection
      if (!selectedValues.includes(existingDonor.value)) {
        onValueChange?.([...selectedValues, existingDonor.value]);
      }
      setInputValue("");
      setNewDonorDialogOpen(false);
      resetNewDonorForm();
      return true;
    }

    if (trimmedEmail) {
      const existingByEmail = donorOptions.find(
        (d) => d.email && d.email.toLowerCase() === trimmedEmail.toLowerCase(),
      );

      if (existingByEmail) {
        toast.error(
          `A donor with this email already exists: ${existingByEmail.label}`,
        );
        return false;
      }
    }

    setIsSubmitting(true);

    try {
      await createDonor({
        organizationId: organizationId as Id<"organizations">,
        name: formattedName,
        notes: newDonorForm.notes.trim() || undefined,
        phone: newDonorForm.phone.trim() || undefined,
        email: trimmedEmail || undefined,
        address: newDonorForm.address.trim() || undefined,
      });

      // Add the newly created donor to selection
      if (!selectedValues.includes(formattedName)) {
        onValueChange?.([...selectedValues, formattedName]);
      }

      // Clear input and close dialog
      setInputValue("");
      setNewDonorDialogOpen(false);
      resetNewDonorForm();
      return true;
    } catch (err) {
      // If donor already exists (backend check), show error toast
      if (err instanceof Error) {
        if (err.message.includes("Invalid email")) {
          setEmailError("Please enter a valid email address");
          toast.error(t("common.toast.invalidEmail"));
          // Keep dialog open so user can fix the email
          return false;
        }

        if (err.message.includes("already exists")) {
          // Extract the existing donor name from error message if available
          const errorMessage = err.message;
          let toastMessage = errorMessage;

          // If error mentions email, try to find the existing donor
          if (errorMessage.includes("email")) {
            const existingDonor = donorOptions.find(
              (d) =>
                trimmedEmail &&
                d.email &&
                d.email.toLowerCase() === trimmedEmail.toLowerCase(),
            );
            if (existingDonor) {
              toastMessage = `A donor with this email already exists: ${existingDonor.label}`;
            }
          } else {
            // Name conflict - try to find existing donor
            const existingDonor = donorOptions.find(
              (d) => d.label.toLowerCase() === formattedName.toLowerCase(),
            );
            if (existingDonor) {
              toastMessage = `A donor with this name already exists: ${existingDonor.label}`;
            }
          }

          toast.error(toastMessage);
          // Keep dialog open so user can fix the issue
          return false;
        }
      }
      // For other errors, show generic error toast
      toast.error(t("common.toast.createFailed"));
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div
            className="flex flex-wrap items-center gap-1 w-full min-h-[2.25rem] rounded-md border border-input bg-background px-2 py-1.5 text-sm ring-offset-background focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 cursor-text"
            onClick={() => !disabled && setOpen(true)}
            onKeyDown={(e) => {
              // Don't interfere if user is typing in the input field
              if (e.target instanceof HTMLInputElement) {
                return;
              }
              if ((e.key === "Enter" || e.key === " ") && !disabled) {
                e.preventDefault();
                setOpen(true);
              }
            }}
          >
            {/* Selected donors as badges */}
            {selectedValues.map((donor) => (
              <div
                key={donor}
                className="inline-flex items-center gap-1 rounded-md border bg-secondary px-1.5 py-0.5 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                  }
                }}
              >
                <span>{donor}</span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove(donor);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation();
                      e.preventDefault();
                      handleRemove(donor);
                    }
                  }}
                  className="hover:text-destructive cursor-pointer"
                  aria-label={`Remove ${donor}`}
                >
                  <X className="h-3 w-3" />
                </span>
              </div>
            ))}

            {/* Inline input for searching/adding */}
            <input
              type="text"
              className="flex-1 min-w-[120px] outline-none bg-transparent text-sm placeholder:text-muted-foreground"
              placeholder={
                selectedValues.length === 0 ? placeholder : "Search or add..."
              }
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                // Open popover when typing to show filtered results
                if (!open && e.target.value.trim()) {
                  setOpen(true);
                }
              }}
              onKeyDown={(e) => {
                // Stop propagation to prevent parent handlers from interfering
                e.stopPropagation();

                if (e.key === "Enter" && inputValue.trim()) {
                  e.preventDefault();
                  // If there are filtered donors, select the first one
                  if (filteredDonors.length > 0 && filteredDonors[0]) {
                    handleSelect(filteredDonors[0].value);
                  } else {
                    // Otherwise, create new donor
                    handleCreateDonorClick();
                  }
                }
              }}
              onClick={(e) => {
                e.stopPropagation();
                setOpen(true);
              }}
              onFocus={() => {
                if (inputValue.trim()) {
                  setOpen(true);
                }
              }}
              disabled={disabled}
            />

            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandList className="max-h-[300px]">
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
                          onClick={handleCreateDonorClick}
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
                    <CommandItem
                      key={donor.value}
                      value={donor.value}
                      onSelect={() => handleSelect(donor.value)}
                      className="px-2 py-1.5"
                    >
                      <div className="flex w-full items-center gap-2">
                        <Check
                          className={cn(
                            "h-4 w-4 shrink-0",
                            selectedValues.some(
                              (v) =>
                                v.toLowerCase() === donor.value.toLowerCase(),
                            )
                              ? "opacity-100"
                              : "opacity-0",
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
                  ))}
                </CommandGroup>
              )}

              {organizationDonorOptions.length > 0 && (
                <CommandGroup heading="Organization Donors">
                  {organizationDonorOptions.map((donor) => (
                    <CommandItem
                      key={donor.value}
                      value={donor.value}
                      onSelect={() => handleSelect(donor.value)}
                      className="px-2 py-1.5"
                    >
                      <div className="flex w-full items-center gap-2">
                        <Check
                          className={cn(
                            "h-4 w-4 shrink-0",
                            selectedValues.some(
                              (v) =>
                                v.toLowerCase() === donor.value.toLowerCase(),
                            )
                              ? "opacity-100"
                              : "opacity-0",
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
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* New Donor Dialog */}
      <Dialog
        open={newDonorDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            resetNewDonorForm();
          }
          setNewDonorDialogOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Donor</DialogTitle>
            <DialogDescription>
              Create a donor profile with notes and optional contact details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="donor-name">Donor Name *</Label>
              <Input
                id="donor-name"
                value={newDonorForm.name}
                onChange={(e) =>
                  setNewDonorForm((current) => ({
                    ...current,
                    name: e.target.value,
                  }))
                }
                placeholder="Enter donor name"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="donor-notes">Information / Notice</Label>
              <Textarea
                id="donor-notes"
                value={newDonorForm.notes}
                onChange={(e) => {
                  setNewDonorForm((current) => ({
                    ...current,
                    notes: e.target.value,
                  }));
                }}
                placeholder="Add provenance context, donor notes, or handling instructions"
                rows={4}
                autoResize
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="donor-phone">Phone</Label>
                <Input
                  id="donor-phone"
                  value={newDonorForm.phone}
                  onChange={(e) =>
                    setNewDonorForm((current) => ({
                      ...current,
                      phone: e.target.value,
                    }))
                  }
                  placeholder="+1 555 123 4567"
                />
              </div>
              <div>
                <Label htmlFor="donor-email">Contact Email</Label>
                <Input
                  id="donor-email"
                  type="email"
                  value={newDonorForm.email}
                  onChange={(e) => {
                    setNewDonorForm((current) => ({
                      ...current,
                      email: e.target.value,
                    }));
                    if (emailError) {
                      setEmailError(null);
                    }
                  }}
                  onBlur={() => {
                    if (!validateEmail(newDonorForm.email.trim())) {
                      setEmailError("Please enter a valid email address");
                    } else {
                      setEmailError(null);
                    }
                  }}
                  placeholder="donor@example.com"
                  className={emailError ? "border-destructive" : ""}
                />
                {emailError && (
                  <p className="mt-1 text-sm text-destructive">{emailError}</p>
                )}
              </div>
            </div>
            <div>
              <Label htmlFor="donor-address">Address</Label>
              <Textarea
                id="donor-address"
                value={newDonorForm.address}
                onChange={(e) =>
                  setNewDonorForm((current) => ({
                    ...current,
                    address: e.target.value,
                  }))
                }
                placeholder="Postal or institutional address"
                rows={3}
                autoResize
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setNewDonorDialogOpen(false);
                resetNewDonorForm();
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={async (e) => {
                e.preventDefault();
                const success = await handleConfirmCreateDonor();
                if (success) {
                  setNewDonorDialogOpen(false);
                }
              }}
              disabled={!newDonorForm.name.trim() || isSubmitting}
            >
              {isSubmitting ? "Adding..." : "Add Donor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
