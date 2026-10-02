"use client";

import type { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import type { FunctionReturnType } from "convex/server";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { TypeCombobox } from "@/components/type-combobox";
import { EditSection } from "../../collection-form-shared/edit-section";
import type { CollectionFormTabProps } from "../../collection-form-shared/types";

type CollectionDoc = NonNullable<
  FunctionReturnType<typeof api.collections.get>
>;

export interface CollectionEditGeneralTabProps extends CollectionFormTabProps {
  collection?: CollectionDoc;
  typedCollectionId?: Id<"collections">;
  alternateAccessionDraft?: string;
  onAlternateAccessionDraftChange?: (value: string) => void;
  onAddAlternateAccessionNumber?: () => void;
  onRemoveAlternateAccessionNumber?: (index: number) => void;
}

export function CollectionEditGeneralTab({
  formData,
  updateField,
  placeholders,
  currentOrganizationId,
  collection,
  typedCollectionId,
  alternateAccessionDraft: providedAlternateAccessionDraft,
  onAlternateAccessionDraftChange,
  onAddAlternateAccessionNumber,
  onRemoveAlternateAccessionNumber,
}: CollectionEditGeneralTabProps) {
  const [localAlternateAccessionDraft, setLocalAlternateAccessionDraft] =
    useState("");
  const alternateAccessionDraft =
    providedAlternateAccessionDraft ?? localAlternateAccessionDraft;

  function addAlternateAccessionNumber() {
    if (onAddAlternateAccessionNumber) {
      onAddAlternateAccessionNumber();
      return;
    }

    const value = alternateAccessionDraft.trim();
    if (!value) return;
    if ((formData.alternateAccessionNumbers || []).includes(value)) return;
    updateField("alternateAccessionNumbers", [
      ...(formData.alternateAccessionNumbers || []),
      value,
    ]);
    setLocalAlternateAccessionDraft("");
  }

  function removeAlternateAccessionNumber(index: number) {
    if (onRemoveAlternateAccessionNumber) {
      onRemoveAlternateAccessionNumber(index);
      return;
    }
    updateField(
      "alternateAccessionNumbers",
      (formData.alternateAccessionNumbers || []).filter(
        (_, itemIndex) => itemIndex !== index,
      ),
    );
  }

  return (
    <div className="space-y-8">
      <EditSection
        title="Record identity"
        description="Core catalog information that identifies and classifies this object."
      >
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="accessionNumber">Accession Number</Label>
            <Input
              id="accessionNumber"
              value={
                collection?.accessionNumber ?? formData.accessionNumber ?? ""
              }
              disabled={Boolean(collection)}
              className={collection ? "bg-muted/60" : undefined}
              onChange={(event) =>
                updateField("accessionNumber", event.target.value)
              }
            />
            {collection ? (
              <p className="text-xs text-muted-foreground">
                Accession number cannot be changed.
              </p>
            ) : null}
          </div>

          <div className="space-y-3 xl:col-span-2">
            <Label htmlFor="alternateAccessionNumbers">
              Alternate Accession Numbers
            </Label>
            <div className="space-y-2">
              {(formData.alternateAccessionNumbers || []).length > 0 ? (
                (formData.alternateAccessionNumbers || []).map(
                  (alternateAccessionNumber, index, values) => {
                    const occurrence = values
                      .slice(0, index + 1)
                      .filter(
                        (value) => value === alternateAccessionNumber,
                      ).length;

                    return (
                      <div
                        key={`${alternateAccessionNumber}-${occurrence}`}
                        className="flex items-center gap-2"
                      >
                        <Input
                          value={alternateAccessionNumber}
                          disabled
                          className="bg-muted/60 font-mono"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => removeAlternateAccessionNumber(index)}
                          title="Remove alternate accession number"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    );
                  },
                )
              ) : (
                <p className="text-sm text-muted-foreground">
                  No alternate accession numbers added.
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Input
                id="alternateAccessionNumbers"
                value={alternateAccessionDraft}
                onChange={(event) =>
                  (
                    onAlternateAccessionDraftChange ??
                    setLocalAlternateAccessionDraft
                  )(event.target.value)
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addAlternateAccessionNumber();
                  }
                }}
                placeholder={placeholders("alternateId")}
              />
              <Button
                type="button"
                variant="outline"
                onClick={addAlternateAccessionNumber}
              >
                <Plus className="mr-2 size-4" />
                Add
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Existing alternate accession numbers can be removed, but not
              edited in place.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="objectName">Object Name</Label>
            <Input
              id="objectName"
              value={formData.objectName || ""}
              onChange={(event) =>
                updateField("objectName", event.target.value)
              }
              placeholder={placeholders("objectName")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="objectType">Object Type</Label>
            <TypeCombobox
              organizationId={currentOrganizationId}
              collectionId={typedCollectionId}
              canDeleteTypes={false}
              value={
                Array.isArray(formData.objectType) ? formData.objectType : []
              }
              onValueChange={(value) => updateField("objectType", value)}
              placeholder={placeholders("selectTypes")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="creator">Creator</Label>
            <Input
              id="creator"
              value={formData.creator || ""}
              onChange={(event) => updateField("creator", event.target.value)}
              placeholder={placeholders("creator")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="culture">Culture</Label>
            <Input
              id="culture"
              value={formData.culture || ""}
              onChange={(event) => updateField("culture", event.target.value)}
              placeholder={placeholders("culture")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="period">Period</Label>
            <Input
              id="period"
              value={formData.period || ""}
              onChange={(event) => updateField("period", event.target.value)}
              placeholder={placeholders("period")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dateCreated">Date Created</Label>
            <Input
              id="dateCreated"
              value={formData.dateCreated || ""}
              onChange={(event) =>
                updateField("dateCreated", event.target.value)
              }
              placeholder={placeholders("dateCreated")}
            />
          </div>
        </div>
      </EditSection>
    </div>
  );
}
