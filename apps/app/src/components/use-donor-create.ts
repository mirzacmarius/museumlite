"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import * as React from "react";
import { toast } from "sonner";
import { useI18n } from "@/locales/client";
import {
  type DonorOption,
  formatDonorName,
  initialDonorForm,
  type NewDonorForm,
  validateDonorEmail,
} from "./donor-combobox-types";

interface UseDonorCreateParams {
  organizationId?: string;
  donorOptions: DonorOption[];
  selectedValues: string[];
  onValueChange?: (value: string[]) => void;
  onCreated: () => void;
}

export function useDonorCreate({
  organizationId,
  donorOptions,
  selectedValues,
  onValueChange,
  onCreated,
}: UseDonorCreateParams) {
  const t = useI18n();
  const createDonor = useMutation(api.donors.create);
  const [newDonorDialogOpen, setNewDonorDialogOpen] = React.useState(false);
  const [newDonorForm, setNewDonorForm] =
    React.useState<NewDonorForm>(initialDonorForm);
  const [emailError, setEmailError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const resetNewDonorForm = React.useCallback((name = "") => {
    setNewDonorForm({ ...initialDonorForm, name });
    setEmailError(null);
    setIsSubmitting(false);
  }, []);

  const openCreateDialog = (name: string) => {
    resetNewDonorForm(formatDonorName(name));
    setNewDonorDialogOpen(true);
  };

  const handleConfirmCreateDonor = async () => {
    if (!organizationId || !newDonorForm.name.trim() || isSubmitting) {
      return;
    }

    const formattedName = formatDonorName(newDonorForm.name);
    const trimmedEmail = newDonorForm.email.trim();

    if (!validateDonorEmail(trimmedEmail)) {
      setEmailError("Please enter a valid email address");
      return;
    }

    setEmailError(null);

    const existingDonor = donorOptions.find(
      (donor) => donor.label.toLowerCase() === formattedName.toLowerCase(),
    );

    if (existingDonor) {
      if (!selectedValues.includes(existingDonor.value)) {
        onValueChange?.([...selectedValues, existingDonor.value]);
      }
      setNewDonorDialogOpen(false);
      resetNewDonorForm();
      onCreated();
      return;
    }

    if (trimmedEmail) {
      const existingByEmail = donorOptions.find(
        (donor) =>
          donor.email &&
          donor.email.toLowerCase() === trimmedEmail.toLowerCase(),
      );

      if (existingByEmail) {
        toast.error(
          t("untranslatedComponents.donorCreate.duplicateEmail", {
            donor: existingByEmail.label,
          }),
        );
        return;
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

      if (!selectedValues.includes(formattedName)) {
        onValueChange?.([...selectedValues, formattedName]);
      }

      setNewDonorDialogOpen(false);
      resetNewDonorForm();
      onCreated();
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes("Invalid email")) {
          setEmailError("Please enter a valid email address");
          toast.error(t("common.toast.invalidEmail"));
          return;
        }

        if (err.message.includes("already exists")) {
          const errorMessage = err.message;
          let toastMessage = errorMessage;

          if (errorMessage.includes("email")) {
            const existingByEmail = donorOptions.find(
              (donor) =>
                trimmedEmail &&
                donor.email &&
                donor.email.toLowerCase() === trimmedEmail.toLowerCase(),
            );
            if (existingByEmail) {
              toastMessage = `A donor with this email already exists: ${existingByEmail.label}`;
            }
          } else {
            const existingByName = donorOptions.find(
              (donor) =>
                donor.label.toLowerCase() === formattedName.toLowerCase(),
            );
            if (existingByName) {
              toastMessage = `A donor with this name already exists: ${existingByName.label}`;
            }
          }

          toast.error(toastMessage);
          return;
        }
      }
      toast.error(t("common.toast.createFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
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
  };
}
