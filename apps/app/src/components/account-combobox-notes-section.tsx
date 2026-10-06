"use client";

import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import type { Dispatch, SetStateAction } from "react";
import { useI18n } from "@/locales/client";
import type { NewAccountForm } from "./account-combobox-types";

interface AccountComboboxNotesSectionProps {
  formData: NewAccountForm;
  setFormData: Dispatch<SetStateAction<NewAccountForm>>;
}

export function AccountComboboxNotesSection({
  formData,
  setFormData,
}: AccountComboboxNotesSectionProps) {
  const translate = useI18n();
  return (
    <div className="space-y-2">
      <Label htmlFor="notes">
        {translate("untranslatedComponents.labels.additionalInformationNotes")}
      </Label>
      <Textarea
        id="notes"
        value={formData.notes}
        onChange={(e) =>
          setFormData((prev) => ({ ...prev, notes: e.target.value }))
        }
        placeholder={translate(
          "untranslatedComponents.labels.anythingElseThatShouldBeStoredWithThisAccount",
        )}
        rows={4}
      />
    </div>
  );
}
