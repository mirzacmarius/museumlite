"use client";

import { Button } from "@v1/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@v1/ui/dropdown-menu";
import { CheckCircle, Edit, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { formatOwnershipDateRange } from "../../../[id]/_components/format-ownership-date-range";
import { EditSection } from "../edit-section";
import type { CollectionFormTabProps, OwnershipEntry } from "../types";
import { OwnershipEntryFormFields } from "./ownership-entry-form-fields";

interface OwnershipHistoryEditSectionProps
  extends Pick<
    CollectionFormTabProps,
    "formData" | "updateField" | "placeholders"
  > {
  editingOwnershipEntryId: string | null;
  setEditingOwnershipEntryId: (id: string | null) => void;
  createOwnershipEntry: (
    entry: Omit<OwnershipEntry, "localId">,
  ) => OwnershipEntry;
}

export function OwnershipHistoryEditSection({
  formData,
  updateField,
  placeholders,
  editingOwnershipEntryId,
  setEditingOwnershipEntryId,
  createOwnershipEntry,
}: OwnershipHistoryEditSectionProps) {
  return (
    <EditSection
      title="Ownership history"
      description="Document the chain of ownership entry by entry."
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Add dated entries with notes and verification details.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const newEntry = createOwnershipEntry({
                owner: "",
                startYear: "",
                endYear: "",
                description: "",
                verified: false,
                verificationSource: "",
              });
              updateField("ownershipHistory", [
                ...(formData.ownershipHistory || []),
                newEntry,
              ]);
              setEditingOwnershipEntryId(newEntry.localId ?? null);
            }}
          >
            <Plus className="mr-2 size-4" />
            Add Entry
          </Button>
        </div>

        {(formData.ownershipHistory || []).length === 0 ? (
          <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-border/60">
            <p className="text-sm text-muted-foreground">
              No ownership history recorded.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {(formData.ownershipHistory || []).map((entry, index) => {
              const entryId = entry.localId ?? `${index}`;
              const isEditingEntry = editingOwnershipEntryId === entryId;

              if (!isEditingEntry) {
                return (
                  <div
                    key={entryId}
                    className="rounded-xl border border-border/60 bg-secondary/20 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-sm font-medium">
                            {entry.owner || `Ownership entry ${index + 1}`}
                          </h3>
                          {entry.verified ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-500">
                              <CheckCircle className="size-3" />
                              Verified
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatOwnershipDateRange(entry)}
                        </p>
                        {entry.description ? (
                          <p className="text-sm text-muted-foreground">
                            {entry.description}
                          </p>
                        ) : null}
                        {entry.verificationSource ? (
                          <p className="text-xs text-muted-foreground">
                            Source: {entry.verificationSource}
                          </p>
                        ) : null}
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 shrink-0 text-muted-foreground"
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => setEditingOwnershipEntryId(entryId)}
                          >
                            <Edit className="mr-2 size-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => {
                              const updated = [
                                ...(formData.ownershipHistory || []),
                              ];
                              updated.splice(index, 1);
                              updateField("ownershipHistory", updated);
                            }}
                          >
                            <Trash2 className="mr-2 size-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={entryId}
                  className="rounded-xl border border-border/60 bg-secondary/20 p-4"
                >
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <h3 className="text-sm font-medium">
                        Edit ownership entry {index + 1}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Capture ownership dates, notes, and verification.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingOwnershipEntryId(null)}
                    >
                      Finish editing
                    </Button>
                  </div>

                  <OwnershipEntryFormFields
                    entry={entry}
                    index={index}
                    formData={formData}
                    updateField={updateField}
                    placeholders={placeholders}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </EditSection>
  );
}
