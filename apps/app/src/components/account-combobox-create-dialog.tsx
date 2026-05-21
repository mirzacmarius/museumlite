"use client";

import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import type { Dispatch, SetStateAction } from "react";
import { AccountComboboxAddressSection } from "./account-combobox-address-section";
import { AccountComboboxContactSection } from "./account-combobox-contact-section";
import { AccountComboboxHolderSection } from "./account-combobox-holder-section";
import { AccountComboboxNotesSection } from "./account-combobox-notes-section";
import {
  initialAccountFormState,
  type NewAccountForm,
} from "./account-combobox-types";

interface AccountComboboxCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: NewAccountForm;
  setFormData: Dispatch<SetStateAction<NewAccountForm>>;
  isSubmitting: boolean;
  onCreate: () => void;
}

export function AccountComboboxCreateDialog({
  open,
  onOpenChange,
  formData,
  setFormData,
  isSubmitting,
  onCreate,
}: AccountComboboxCreateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Account</DialogTitle>
          <DialogDescription>
            Add a new lender/borrower account to your organization.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <AccountComboboxHolderSection
            formData={formData}
            setFormData={setFormData}
          />
          <AccountComboboxAddressSection
            formData={formData}
            setFormData={setFormData}
          />
          <AccountComboboxContactSection
            formData={formData}
            setFormData={setFormData}
          />
          <AccountComboboxNotesSection
            formData={formData}
            setFormData={setFormData}
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setFormData(initialAccountFormState);
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onCreate}
            disabled={isSubmitting || !formData.businessName.trim()}
          >
            {isSubmitting ? "Creating..." : "Create Account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
