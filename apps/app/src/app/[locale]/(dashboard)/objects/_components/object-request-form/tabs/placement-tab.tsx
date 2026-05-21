"use client";

import { CollectionGroupCombobox } from "@/components/collection-group-combobox";
import { CollectionTypeSelector } from "@/components/collection-type-selector";
import { ConditionCombobox } from "@/components/condition-combobox";
import { DonationDetailsField } from "@/components/donation-details-field";
import { LocationSelector } from "@/components/location-selector";
import { MaterialsCombobox } from "@/components/materials-combobox";
import { ObjectCombobox } from "@/components/object-combobox";
import { RepeatableTextField } from "@/components/repeatable-text-field";
import { TypeCombobox } from "@/components/type-combobox";
import type { useFeatureAccess } from "@/hooks/use-feature-access";
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
import { Camera, CheckCircle, Plus, Star, Upload, X } from "lucide-react";
import Image from "next/image";
import type React from "react";
import { ACQUISITION_METHODS } from "../../collection-form-shared/constants";
import { EditSection } from "../../collection-form-shared/edit-section";
import type {
  CollectionFormTabProps,
  DraftMediaItem,
  OwnershipEntry,
} from "../../collection-form-shared/types";

export function ObjectRequestPlacementTab({
  formData,
  updateField,
  placeholders,
  currentOrganizationId,
  isLocationTrackingEnabled,
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
