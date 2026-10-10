"use client";

import { Button } from "@v1/ui/button";
import { Plus, X } from "lucide-react";
import { useI18n } from "@/locales/client";
import { EditSection } from "../edit-section";
import type { CollectionFormTabProps, OwnershipEntry } from "../types";
import { OwnershipEntryFormFields } from "./ownership-entry-form-fields";
export function OwnershipHistoryRequestSection({
  formData,
  updateField,
  placeholders,
}: Pick<CollectionFormTabProps, "formData" | "updateField" | "placeholders">) {
  const tRoot = useI18n();
  return (
    <EditSection
      title={tRoot("untranslatedRecords.objects.form.ownershipHistory")}
      description={tRoot(
        "untranslatedRecords.objects.form.ownershipHistoryDescription",
      )}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {tRoot("untranslatedRecords.objects.form.ownershipHistoryHint")}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const newEntry: OwnershipEntry = {
                owner: "",
                startYear: "",
                endYear: "",
                description: "",
                verified: false,
                verificationSource: "",
              };
              updateField("ownershipHistory", [
                ...(formData.ownershipHistory || []),
                newEntry,
              ]);
            }}
          >
            <Plus className="mr-2 size-4" />
            {tRoot("untranslatedRecords.objects.form.addEntry")}
          </Button>
        </div>

        {(formData.ownershipHistory || []).length === 0 ? (
          <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-border/60">
            <p className="text-sm text-muted-foreground">
              {tRoot("untranslatedRecords.objects.form.noOwnershipHistory")}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {(formData.ownershipHistory || []).map((entry, index) => (
              <div
                key={`ownership-${entry.owner || "unknown"}-${entry.startYear ?? "start"}-${entry.endYear ?? "end"}`}
                className="rounded-xl border border-border/60 bg-secondary/20 p-4"
              >
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-sm font-medium">
                      {tRoot("untranslatedRecords.objects.ownership.entry")}{" "}
                      {index + 1}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {tRoot(
                        "untranslatedRecords.objects.form.captureOwnershipDates",
                      )}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      const updated = [...(formData.ownershipHistory || [])];
                      updated.splice(index, 1);
                      updateField("ownershipHistory", updated);
                    }}
                  >
                    <X className="size-4" />
                  </Button>
                </div>

                <OwnershipEntryFormFields
                  entry={entry}
                  index={index}
                  formData={formData}
                  updateField={updateField}
                  placeholders={placeholders}
                  ownerPlaceholder={tRoot(
                    "objects.form.placeholders.ownerName",
                  )}
                  notesPlaceholder={tRoot(
                    "objects.form.placeholders.ownershipNotes",
                  )}
                  verificationPlaceholder={tRoot(
                    "objects.form.placeholders.verificationSource",
                  )}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </EditSection>
  );
}
