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
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import type { Dispatch, SetStateAction } from "react";
import { useI18n } from "@/locales/client";
import {
  initialDonorForm,
  type NewDonorForm,
  validateDonorEmail,
} from "./donor-combobox-types";

interface DonorComboboxCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newDonorForm: NewDonorForm;
  setNewDonorForm: Dispatch<SetStateAction<NewDonorForm>>;
  emailError: string | null;
  setEmailError: (error: string | null) => void;
  isSubmitting: boolean;
  onConfirm: () => Promise<void>;
  onReset: () => void;
}

export function DonorComboboxCreateDialog({
  open,
  onOpenChange,
  newDonorForm,
  setNewDonorForm,
  emailError,
  setEmailError,
  isSubmitting,
  onConfirm,
  onReset,
}: DonorComboboxCreateDialogProps) {
  const translate = useI18n();
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onReset();
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {translate("untranslatedComponents.labels.addNewDonor")}
          </DialogTitle>
          <DialogDescription>
            {translate(
              "untranslatedComponents.labels.createADonorProfileWithNotesAndOptionalContactDetails",
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="donor-name">
              {translate("untranslatedComponents.labels.donorName")}
            </Label>
            <Input
              id="donor-name"
              value={newDonorForm.name}
              onChange={(e) =>
                setNewDonorForm((current) => ({
                  ...current,
                  name: e.target.value,
                }))
              }
              placeholder={translate(
                "untranslatedComponents.labels.enterDonorName",
              )}
            />
          </div>
          <div>
            <Label htmlFor="donor-notes">
              {translate("untranslatedComponents.labels.informationNotice")}
            </Label>
            <Textarea
              id="donor-notes"
              value={newDonorForm.notes}
              onChange={(e) => {
                setNewDonorForm((current) => ({
                  ...current,
                  notes: e.target.value,
                }));
              }}
              placeholder={translate(
                "untranslatedComponents.labels.addProvenanceContextDonorNotesOrHandlingInstructions",
              )}
              rows={4}
              autoResize
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="donor-phone">
                {translate("untranslatedComponents.labels.phone")}
              </Label>
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
              <Label htmlFor="donor-email">
                {translate("untranslatedComponents.labels.contactEmail")}
              </Label>
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
                  if (!validateDonorEmail(newDonorForm.email.trim())) {
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
            <Label htmlFor="donor-address">
              {translate("untranslatedComponents.labels.address")}
            </Label>
            <Textarea
              id="donor-address"
              value={newDonorForm.address}
              onChange={(e) =>
                setNewDonorForm((current) => ({
                  ...current,
                  address: e.target.value,
                }))
              }
              placeholder={translate(
                "untranslatedComponents.labels.postalOrInstitutionalAddress",
              )}
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
              onOpenChange(false);
              onReset();
            }}
          >
            {translate("untranslatedComponents.labels.cancel")}
          </Button>
          <Button
            type="button"
            onClick={async (e) => {
              e.preventDefault();
              await onConfirm();
            }}
            disabled={!newDonorForm.name.trim() || isSubmitting}
          >
            {isSubmitting
              ? translate("untranslatedComponents.labels.adding")
              : translate("untranslatedComponents.labels.addDonor")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { initialDonorForm };
