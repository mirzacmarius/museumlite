"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@v1/ui/alert-dialog";
import { Button } from "@v1/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@v1/ui/command";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import { cn } from "@v1/ui/utils";
import { useMutation, useQuery } from "convex/react";
import { Check, ChevronsUpDown, Mail, X } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

interface DonorComboboxProps {
  organizationId?: string;
  collectionId?: string;
  value?: string[];
  onValueChange?: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function DonorCombobox({
  organizationId,
  collectionId,
  value = [],
  onValueChange,
  placeholder = "Select or add donors...",
  disabled = false,
}: DonorComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");
  const [newDonorDialogOpen, setNewDonorDialogOpen] = React.useState(false);
  const [newDonorName, setNewDonorName] = React.useState("");
  const [newDonorEmail, setNewDonorEmail] = React.useState("");
  const [emailError, setEmailError] = React.useState<string | null>(null);
  const isSubmittingRef = React.useRef(false);

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
    return (donors || []).map((donor) => ({
      value: donor.name,
      label: donor.name,
      email: donor.email,
      id: donor._id,
    }));
  }, [donors]);

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

  // Handle creating new donor - show dialog first
  const handleCreateDonorClick = () => {
    if (!inputValue.trim()) return;
    setNewDonorName(formatDonorName(inputValue));
    setNewDonorEmail("");
    setNewDonorDialogOpen(true);
  };

  // Handle confirming new donor creation
  const handleConfirmCreateDonor = async (): Promise<boolean> => {
    if (!organizationId || !newDonorName.trim()) {
      return false;
    }

    // Validate email is provided and has valid format
    if (!newDonorEmail.trim()) {
      setEmailError("Email address is required");
      return false;
    }
    
    if (!validateEmail(newDonorEmail.trim())) {
      setEmailError("Please enter a valid email address");
      return false;
    }
    
    setEmailError(null);

    // Check if donor already exists (case-insensitive) before creating
    const formattedName = formatDonorName(newDonorName);
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
      setNewDonorName("");
      setNewDonorEmail("");
      setEmailError(null);
      return true;
    }

    // Check for email match
    const existingByEmail = donorOptions.find(
      (d) =>
        d.email &&
        d.email.toLowerCase() === newDonorEmail.trim().toLowerCase(),
    );

    if (existingByEmail) {
      // Donor with this email exists, show error toast
      toast.error(
        `A donor with this email already exists: ${existingByEmail.label}`,
      );
      // Keep dialog open so user can fix the email
      return false;
    }

    try {
      await createDonor({
        organizationId: organizationId as Id<"organizations">,
        name: formattedName,
        email: newDonorEmail.trim(),
      });

      // Add the newly created donor to selection
      if (!selectedValues.includes(formattedName)) {
        onValueChange?.([...selectedValues, formattedName]);
      }

      // Clear input and close dialog
      setInputValue("");
      setNewDonorDialogOpen(false);
      setNewDonorName("");
      setNewDonorEmail("");
      return true;
    } catch (err) {
      // If donor already exists (backend check), show error toast
      if (err instanceof Error) {
        if (err.message.includes("Invalid email")) {
          setEmailError("Please enter a valid email address");
          toast.error("Invalid email address format");
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
                newDonorEmail.trim() &&
                d.email &&
                d.email.toLowerCase() === newDonorEmail.trim().toLowerCase(),
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
      toast.error("Failed to create donor. Please try again.");
      return false;
    } finally {
      isSubmittingRef.current = false;
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

              {filteredDonors.length > 0 && (
                <CommandGroup heading="Organization Donors">
                  {filteredDonors.map((donor) => (
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
                          {donor.email && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {donor.email}
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
      <AlertDialog
        open={newDonorDialogOpen}
        onOpenChange={(open) => {
          // Prevent closing if we're submitting and there's a validation error
          if (!open && isSubmittingRef.current && emailError) {
            return;
          }
          // Allow closing (user clicked Cancel or outside)
          if (!open) {
            // Clear errors when closing normally
            setEmailError(null);
          }
          setNewDonorDialogOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Add New Donor</AlertDialogTitle>
            <AlertDialogDescription>
              Create a new donor profile for your organization.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="donor-name">Donor Name *</Label>
              <Input
                id="donor-name"
                value={newDonorName}
                onChange={(e) => setNewDonorName(e.target.value)}
                placeholder="Enter donor name"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newDonorName.trim()) {
                    e.preventDefault();
                    handleConfirmCreateDonor();
                  }
                }}
              />
            </div>
            <div>
              <Label htmlFor="donor-email">Email Address *</Label>
              <Input
                id="donor-email"
                type="email"
                value={newDonorEmail}
                required
                onChange={(e) => {
                  setNewDonorEmail(e.target.value);
                  // Clear error when user starts typing
                  if (emailError) {
                    setEmailError(null);
                  }
                }}
                onBlur={() => {
                  // Validate on blur
                  if (!newDonorEmail.trim()) {
                    setEmailError("Email address is required");
                  } else if (!validateEmail(newDonorEmail.trim())) {
                    setEmailError("Please enter a valid email address");
                  } else {
                    setEmailError(null);
                  }
                }}
                placeholder="donor@example.com"
                className={emailError ? "border-destructive" : ""}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newDonorName.trim() && newDonorEmail.trim()) {
                    e.preventDefault();
                    handleConfirmCreateDonor();
                  }
                }}
              />
              {emailError && (
                <p className="text-sm text-destructive mt-1">{emailError}</p>
              )}
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setNewDonorDialogOpen(false);
                setNewDonorName("");
                setNewDonorEmail("");
                setEmailError(null);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async (e) => {
                e.preventDefault();
                const success = await handleConfirmCreateDonor();
                // Only close if successful
                if (success) {
                  setNewDonorDialogOpen(false);
                }
              }}
              disabled={!newDonorName.trim() || !newDonorEmail.trim()}
            >
              Add Donor
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
