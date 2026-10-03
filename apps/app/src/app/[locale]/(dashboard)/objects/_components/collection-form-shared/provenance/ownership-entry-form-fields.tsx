"use client";

import { Checkbox } from "@v1/ui/checkbox";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import { CheckCircle } from "lucide-react";
import { useI18n } from "@/locales/client";
import type {
  CollectionFormData,
  OwnershipEntry,
  UpdateCollectionFormField,
} from "../types";

interface OwnershipEntryFormFieldsProps {
  entry: OwnershipEntry;
  index: number;
  formData: CollectionFormData;
  updateField: UpdateCollectionFormField;
  placeholders: (key: string) => string;
  ownerPlaceholder?: string;
  notesPlaceholder?: string;
  verificationPlaceholder?: string;
}

export function OwnershipEntryFormFields({
  entry,
  index,
  formData,
  updateField,
  placeholders,
  ownerPlaceholder,
  notesPlaceholder,
  verificationPlaceholder,
}: OwnershipEntryFormFieldsProps) {
  const tRoot = useI18n();
  function updateEntry(partial: Partial<OwnershipEntry>) {
    const updated = [...(formData.ownershipHistory || [])];
    updated[index] = { ...entry, ...partial };
    updateField("ownershipHistory", updated);
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-1">
          <Label htmlFor={`owner-${index}`}>
            {tRoot("objects.form.owner")}{" "}
            <span className="text-red-500">*</span>
          </Label>
          <Input
            id={`owner-${index}`}
            value={entry.owner}
            onChange={(event) => updateEntry({ owner: event.target.value })}
            placeholder={ownerPlaceholder ?? placeholders("ownerName")}
          />
        </div>
        <div>
          <Label htmlFor={`startYear-${index}`}>
            {tRoot("untranslatedRecords.objects.actions.from")}
          </Label>
          <Input
            id={`startYear-${index}`}
            value={entry.startYear || ""}
            onChange={(event) => updateEntry({ startYear: event.target.value })}
            placeholder={tRoot("objects.form.placeholders.yearStart")}
          />
        </div>
        <div>
          <Label htmlFor={`endYear-${index}`}>{tRoot("objects.form.to")}</Label>
          <Input
            id={`endYear-${index}`}
            value={entry.endYear || ""}
            onChange={(event) => updateEntry({ endYear: event.target.value })}
            placeholder={tRoot("objects.form.placeholders.yearEnd")}
          />
        </div>
      </div>

      <div>
        <Label htmlFor={`description-${index}`}>
          {tRoot("accessions.form.notes")}
        </Label>
        <Textarea
          id={`description-${index}`}
          value={entry.description || ""}
          onChange={(event) => updateEntry({ description: event.target.value })}
          rows={2}
          placeholder={notesPlaceholder ?? placeholders("ownershipNotes")}
        />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Checkbox
            id={`verified-${index}`}
            checked={entry.verified ?? false}
            onCheckedChange={(checked) =>
              updateEntry({ verified: checked === true })
            }
          />
          <Label
            htmlFor={`verified-${index}`}
            className="flex items-center gap-1 text-sm font-normal"
          >
            <CheckCircle className="size-3 text-green-500" />
            {tRoot("untranslatedRecords.objects.detail.verified")}
          </Label>
        </div>

        {entry.verified ? (
          <div className="flex-1">
            <Input
              value={entry.verificationSource || ""}
              onChange={(event) =>
                updateEntry({ verificationSource: event.target.value })
              }
              placeholder={
                verificationPlaceholder ?? placeholders("verificationSource")
              }
              className="h-9 text-sm"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
