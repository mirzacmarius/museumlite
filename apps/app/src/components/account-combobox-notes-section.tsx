"use client";

import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import type { Dispatch, SetStateAction } from "react";
import type { NewAccountForm } from "./account-combobox-types";

interface AccountComboboxNotesSectionProps {
  formData: NewAccountForm;
  setFormData: Dispatch<SetStateAction<NewAccountForm>>;
}

export function AccountComboboxNotesSection({
  formData,
  setFormData,
}: AccountComboboxNotesSectionProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="notes">Additional Information / Notes</Label>
      <Textarea
        id="notes"
        value={formData.notes}
        onChange={(e) =>
          setFormData((prev) => ({ ...prev, notes: e.target.value }))
        }
        placeholder="Anything else that should be stored with this account"
        rows={4}
      />
    </div>
  );
}
