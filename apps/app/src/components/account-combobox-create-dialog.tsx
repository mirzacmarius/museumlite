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
import { useI18n } from "@/locales/client";
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
  const translate = useI18n();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {translate("untranslatedComponents.labels.createNewAccount")}
          </DialogTitle>
          <DialogDescription>
            {translate(
              "untranslatedComponents.labels.addANewLenderBorrowerAccountToYourOrganization",
            )}
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
            {translate("untranslatedComponents.labels.cancel")}
          </Button>
          <Button
            type="button"
            onClick={onCreate}
            disabled={isSubmitting || !formData.businessName.trim()}
          >
            {isSubmitting
              ? translate("untranslatedComponents.labels.creating")
              : translate("untranslatedComponents.labels.createAccount")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
