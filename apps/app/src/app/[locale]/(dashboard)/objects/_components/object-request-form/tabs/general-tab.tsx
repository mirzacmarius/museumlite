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

export interface ObjectRequestGeneralTabProps extends CollectionFormTabProps {
  enabledModules: ReturnType<typeof useFeatureAccess>["enabledModules"];
}

export function ObjectRequestGeneralTab({
  formData,
  updateField,
  placeholders,
  currentOrganizationId,
  isLocationTrackingEnabled,
  enabledModules,
}: ObjectRequestGeneralTabProps) {
  return (
    <div className="space-y-8">
      <EditSection
        title="Record identity"
        description="Core catalog information that identifies and classifies this object."
      >
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-2">
            <CollectionTypeSelector
              value={formData.collectionType}
              enabledModules={enabledModules}
              onValueChange={(value) => updateField("collectionType", value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="accessionNumber">Accession Number</Label>
            <Input
              id="accessionNumber"
              value={formData.accessionNumber || ""}
              onChange={(event) =>
                updateField("accessionNumber", event.target.value)
              }
              placeholder={placeholders("accessionNumber")}
            />
          </div>

          <div className="space-y-2 xl:col-span-1">
            <RepeatableTextField
              label="Alternate Accession Numbers"
              value={formData.alternateAccessionNumbers || []}
              onChange={(values) =>
                updateField("alternateAccessionNumbers", values)
              }
              placeholder={placeholders("alternateId")}
              id="alternateAccessionNumbers"
            />
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

          {isLocationTrackingEnabled ? (
            <div className="space-y-2">
              <Label htmlFor="generalCurrentLocationId">Location</Label>
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
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="generalCollectionGroupId">Collection</Label>
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
