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
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { useScopedI18n } from "@/locales/client";
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
  /** Shown above the form, for example similar existing parties. */
  notice?: ReactNode;
}

export function AccountComboboxCreateDialog({
  open,
  onOpenChange,
  formData,
  setFormData,
  isSubmitting,
  onCreate,
  notice,
}: AccountComboboxCreateDialogProps) {
  const t = useScopedI18n("parties.create");
  const tLinks = useScopedI18n("parties.links");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {notice}
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
            {tLinks("cancel")}
          </Button>
          <Button
            type="button"
            onClick={onCreate}
            disabled={isSubmitting || !formData.businessName.trim()}
          >
            {isSubmitting ? t("creating") : t("submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
