"use client";

import type { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Label } from "@v1/ui/label";
import { Switch } from "@v1/ui/switch";
import type { FunctionReturnType } from "convex/server";
import { CollectionGroupCombobox } from "@/components/collection-group-combobox";
import { LocationSelector } from "@/components/location-selector";
import { ObjectCombobox } from "@/components/object-combobox";
import { FieldError } from "@/components/record-form/record-form-notices";
import { useI18n } from "@/locales/client";
import { EditSection } from "../../collection-form-shared/edit-section";
import {
  type CollectionFormTabProps,
  NO_FIELD_ERRORS,
} from "../../collection-form-shared/types";

type CollectionDoc = NonNullable<
  FunctionReturnType<typeof api.collections.get>
>;

export interface CollectionEditPlacementTabProps
  extends CollectionFormTabProps {
  collection: CollectionDoc;
  typedCollectionId: Id<"collections">;
  resolvedCurrentLocationId: string;
}

export function CollectionEditPlacementTab({
  formData,
  updateField,
  placeholders,
  currentOrganizationId,
  collection,
  typedCollectionId,
  resolvedCurrentLocationId,
  fieldErrors = NO_FIELD_ERRORS,
}: CollectionEditPlacementTabProps) {
  const tRoot = useI18n();
  return (
    <div className="space-y-8">
      <EditSection
        title={tRoot("untranslatedRecords.objects.form.placementRelationships")}
        description={tRoot(
          "untranslatedRecords.objects.form.placementDescription",
        )}
      >
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-2 xl:col-span-2">
            <Label htmlFor="placementCurrentLocationId">
              {tRoot("objects.form.currentLocation")}
            </Label>
            <LocationSelector
              organizationId={currentOrganizationId}
              // A recorded location changes through a move; it is not cleared here.
              allowNone={!collection.currentLocationId}
              value={resolvedCurrentLocationId}
              onValueChange={(value) => {
                updateField("currentLocationId", value);
                if (!value) {
                  updateField("displayStatus", "");
                }
              }}
              placeholder={placeholders("location")}
            />
            <FieldError
              field="currentLocationId"
              message={fieldErrors.currentLocationId}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="placementCollectionGroupId">
              {tRoot("objects.form.collectionGroup")}
            </Label>
            <CollectionGroupCombobox
              organizationId={currentOrganizationId}
              value={formData.collectionGroupIds}
              onValueChange={(value) =>
                updateField("collectionGroupIds", value)
              }
              primaryValue={formData.collectionGroupId}
              onPrimaryChange={(value) =>
                updateField("collectionGroupId", value)
              }
              placeholder={placeholders("collection")}
            />
            <FieldError
              field="collectionGroupIds"
              message={
                fieldErrors.collectionGroupIds ?? fieldErrors.collectionGroupId
              }
            />
          </div>

          <div className="space-y-2 md:col-span-2 xl:col-span-3">
            <Label htmlFor="placementParentObjectId">
              {tRoot("objects.form.parentObject")}
            </Label>
            <p className="text-xs text-muted-foreground">
              {tRoot("untranslatedRecords.objects.form.linkParentHint")}
            </p>
            <ObjectCombobox
              organizationId={currentOrganizationId}
              collectionId={typedCollectionId}
              value={formData.parentObjectId}
              onValueChange={(value) => updateField("parentObjectId", value)}
              placeholder={placeholders("parentObject")}
            />
            <FieldError
              field="parentObjectId"
              message={fieldErrors.parentObjectId}
            />
          </div>

          <div className="md:col-span-2 xl:col-span-3">
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border/50 p-4">
              <div className="space-y-0.5">
                <Label htmlFor="placementDisplayStatus">
                  {tRoot("objects.filters.onDisplay")}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {tRoot("untranslatedRecords.objects.form.markOnDisplayHint")}
                </p>
              </div>
              <Switch
                id="placementDisplayStatus"
                checked={formData.displayStatus === "on_display"}
                onCheckedChange={(checked) =>
                  updateField("displayStatus", checked ? "on_display" : "")
                }
              />
            </div>
          </div>
        </div>
      </EditSection>
    </div>
  );
}
