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
import { useI18n } from "@/locales/client";
import {
  AlternativeTitleField,
  TagsField,
} from "../../collection-form-shared/catalog-parity-fields";
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
  const tRoot = useI18n();
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
        title={tRoot("untranslatedRecords.objects.form.recordIdentity")}
        description={tRoot(
          "untranslatedRecords.objects.form.recordIdentityDescription",
        )}
      >
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="accessionNumber">
              {tRoot("objects.form.accessionNumber")}
            </Label>
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
                {tRoot(
                  "untranslatedRecords.objects.form.acquisitionNumberImmutable",
                )}
              </p>
            ) : null}
          </div>

          <div className="space-y-3 xl:col-span-2">
            <Label htmlFor="alternateAccessionNumbers">
              {tRoot("objects.form.alternateAccessionNumbers")}
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
                          title={tRoot(
                            "untranslatedRecords.objects.form.removeAlternateAccession",
                          )}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    );
                  },
                )
              ) : (
                <p className="text-sm text-muted-foreground">
                  {tRoot("untranslatedRecords.objects.form.noAlternateNumbers")}
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
                {tRoot("untranslatedRecords.objects.actions.add")}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {tRoot(
                "untranslatedRecords.objects.form.alternateNumberRemoveHint",
              )}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="objectName">
              {tRoot("objects.form.objectName")}
            </Label>
            <Input
              id="objectName"
              value={formData.objectName || ""}
              onChange={(event) =>
                updateField("objectName", event.target.value)
              }
              placeholder={placeholders("objectName")}
            />
          </div>

          <AlternativeTitleField
            formData={formData}
            updateField={updateField}
          />

          <div className="space-y-2">
            <Label id="objectType-label" htmlFor="objectType">
              {tRoot("objects.filters.objectType")}
            </Label>
            <TypeCombobox
              id="objectType"
              aria-labelledby="objectType-label"
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
            <Label htmlFor="creator">{tRoot("objects.form.creator")}</Label>
            <Input
              id="creator"
              value={formData.creator || ""}
              onChange={(event) => updateField("creator", event.target.value)}
              placeholder={placeholders("creator")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="culture">{tRoot("objects.form.culture")}</Label>
            <Input
              id="culture"
              value={formData.culture || ""}
              onChange={(event) => updateField("culture", event.target.value)}
              placeholder={placeholders("culture")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="period">{tRoot("objects.form.period")}</Label>
            <Input
              id="period"
              value={formData.period || ""}
              onChange={(event) => updateField("period", event.target.value)}
              placeholder={placeholders("period")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dateCreated">
              {tRoot("objects.form.dateCreated")}
            </Label>
            <Input
              id="dateCreated"
              value={formData.dateCreated || ""}
              onChange={(event) =>
                updateField("dateCreated", event.target.value)
              }
              placeholder={placeholders("dateCreated")}
            />
          </div>

          <TagsField formData={formData} updateField={updateField} />
        </div>
      </EditSection>
    </div>
  );
}
