"use client";

import { Checkbox } from "@v1/ui/checkbox";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import { CheckCircle } from "lucide-react";
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
            Owner <span className="text-red-500">*</span>
          </Label>
          <Input
            id={`owner-${index}`}
            value={entry.owner}
            onChange={(event) => updateEntry({ owner: event.target.value })}
            placeholder={ownerPlaceholder ?? placeholders("ownerName")}
          />
        </div>
        <div>
          <Label htmlFor={`startYear-${index}`}>From</Label>
          <Input
            id={`startYear-${index}`}
            value={entry.startYear || ""}
            onChange={(event) => updateEntry({ startYear: event.target.value })}
            placeholder="e.g., 1920"
          />
        </div>
        <div>
          <Label htmlFor={`endYear-${index}`}>To</Label>
          <Input
            id={`endYear-${index}`}
            value={entry.endYear || ""}
            onChange={(event) => updateEntry({ endYear: event.target.value })}
            placeholder="e.g., 1985 or Present"
          />
        </div>
      </div>

      <div>
        <Label htmlFor={`description-${index}`}>Notes</Label>
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
            Verified
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
