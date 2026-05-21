"use client";

import { Label } from "@v1/ui/label";
import { Switch } from "@v1/ui/switch";
import { CollectionGroupCombobox } from "@/components/collection-group-combobox";
import { LocationSelector } from "@/components/location-selector";
import { ObjectCombobox } from "@/components/object-combobox";
import { EditSection } from "../../collection-form-shared/edit-section";
import type { CollectionFormTabProps } from "../../collection-form-shared/types";

export function ObjectRequestPlacementTab({
  formData,
  updateField,
  placeholders,
  currentOrganizationId,
}: CollectionFormTabProps) {
  return (
    <div className="space-y-8">
      <EditSection
        title="Placement and relationships"
        description="Where the object should live in the system and how it relates to other records."
      >
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-2 xl:col-span-2">
            <Label htmlFor="placementCurrentLocationId">Current Location</Label>
            <LocationSelector
              organizationId={currentOrganizationId}
              value={formData.currentLocationId}
              onValueChange={(value) => {
                updateField("currentLocationId", value);
                if (!value) {
                  updateField("displayStatus", undefined);
                }
              }}
              placeholder={placeholders("location")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="placementCollectionGroupId">Collection</Label>
            <CollectionGroupCombobox
              organizationId={currentOrganizationId}
              value={formData.collectionGroupIds}
              onValueChange={(value) => {
                updateField("collectionGroupIds", value);
                updateField("collectionGroupId", value[0] || "");
              }}
              placeholder={placeholders("collection")}
            />
          </div>

          <div className="space-y-2 md:col-span-2 xl:col-span-3">
            <Label htmlFor="placementParentObjectId">Parent Object</Label>
            <p className="text-xs text-muted-foreground">
              Link this object to a parent record when it belongs to a larger
              set or container.
            </p>
            <ObjectCombobox
              organizationId={currentOrganizationId}
              value={formData.parentObjectId}
              onValueChange={(value) => updateField("parentObjectId", value)}
              placeholder={placeholders("parentObject")}
            />
          </div>

          <div className="md:col-span-2 xl:col-span-3">
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border/50 p-4">
              <div className="space-y-0.5">
                <Label htmlFor="placementDisplayStatus">On display</Label>
                <p className="text-xs text-muted-foreground">
                  Mark this object as visible to visitors in its current
                  location.
                </p>
              </div>
              <Switch
                id="placementDisplayStatus"
                checked={formData.displayStatus === "on_display"}
                onCheckedChange={(checked) =>
                  updateField(
                    "displayStatus",
                    checked ? "on_display" : undefined,
                  )
                }
              />
            </div>
          </div>
        </div>
      </EditSection>
    </div>
  );
}
