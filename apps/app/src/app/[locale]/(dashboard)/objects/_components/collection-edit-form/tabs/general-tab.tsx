"use client";

import { CollectionGroupCombobox } from "@/components/collection-group-combobox";
import { ConditionCombobox } from "@/components/condition-combobox";
import { DonationDetailsField } from "@/components/donation-details-field";
import { LocationSelector } from "@/components/location-selector";
import { MaterialsCombobox } from "@/components/materials-combobox";
import { MediaEditorDialog } from "@/components/media-editor-dialog";
import { ObjectCombobox } from "@/components/object-combobox";
import { RepeatableTextField } from "@/components/repeatable-text-field";
import { TypeCombobox } from "@/components/type-combobox";
import type { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Checkbox } from "@v1/ui/checkbox";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { Switch } from "@v1/ui/switch";
import { Textarea } from "@v1/ui/textarea";
import { cn } from "@v1/ui/utils";
import type { FunctionReturnType } from "convex/server";
import {
  AlertOctagon,
  Camera,
  CheckCircle,
  Edit,
  Image as ImageIcon,
  Plus,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type React from "react";
import { formatOwnershipDateRange } from "../../../[id]/_components/format-ownership-date-range";
import { ACQUISITION_METHODS } from "../../collection-form-shared/constants";
import { EditSection } from "../../collection-form-shared/edit-section";
import type {
  CollectionFormTabProps,
  LinkEntry,
  OwnershipEntry,
} from "../../collection-form-shared/types";
import {
  createLinkEntryLocalId,
  createOwnershipEntryLocalId,
  normalizeOptionalString,
} from "../../collection-form-shared/utils";

type CollectionDoc = NonNullable<
  FunctionReturnType<typeof api.collections.get>
>;
type MediaItem = NonNullable<FunctionReturnType<typeof api.media.list>>[number];

export interface CollectionEditGeneralTabProps extends CollectionFormTabProps {
  collection: CollectionDoc;
  typedCollectionId: Id<"collections">;
  alternateAccessionDraft: string;
  onAlternateAccessionDraftChange: (value: string) => void;
  onAddAlternateAccessionNumber: () => void;
  onRemoveAlternateAccessionNumber: (index: number) => void;
}

export function CollectionEditGeneralTab({
  formData,
  updateField,
  placeholders,
  currentOrganizationId,
  isLocationTrackingEnabled,
  collection,
  typedCollectionId,
  alternateAccessionDraft,
  onAlternateAccessionDraftChange,
  onAddAlternateAccessionNumber,
  onRemoveAlternateAccessionNumber,
}: CollectionEditGeneralTabProps) {
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
              value={collection.accessionNumber}
              disabled
              className="bg-muted/60"
            />
            <p className="text-xs text-muted-foreground">
              Accession number cannot be changed.
            </p>
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
                          onClick={() =>
                            onRemoveAlternateAccessionNumber(index)
                          }
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
                  onAlternateAccessionDraftChange(event.target.value)
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onAddAlternateAccessionNumber();
                  }
                }}
                placeholder={placeholders("alternateId")}
              />
              <Button
                type="button"
                variant="outline"
                onClick={onAddAlternateAccessionNumber}
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

      <EditSection
        title="Description"
        description="The primary description shown across the object record."
      >
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            autoResize
            id="description"
            value={formData.description || ""}
            onChange={(event) => updateField("description", event.target.value)}
            rows={5}
            placeholder={placeholders("description")}
          />
        </div>
      </EditSection>
    </div>
  );
}
