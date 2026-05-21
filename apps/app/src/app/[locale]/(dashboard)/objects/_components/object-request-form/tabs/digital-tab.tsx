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

export function ObjectRequestDigitalTab({
  formData,
  updateField,
  placeholders,
  currentOrganizationId,
  isLocationTrackingEnabled,
}: CollectionFormTabProps) {
  return (
    <div className="space-y-8">
      <EditSection
        title="Digital asset visibility"
        description="Control how this object appears and behaves in public experiences."
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border/50 p-4">
            <div className="space-y-0.5">
              <Label htmlFor="isPubliclyVisible">Public Visibility</Label>
              <p className="text-xs text-muted-foreground">
                Allow this object to appear in public catalogs.
              </p>
            </div>
            <Switch
              id="isPubliclyVisible"
              checked={formData.isPubliclyVisible ?? false}
              onCheckedChange={(checked) =>
                updateField("isPubliclyVisible", checked)
              }
            />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-border/50 p-4">
            <div className="space-y-0.5">
              <Label htmlFor="isHighResDownloadable">
                High-Resolution Downloads
              </Label>
              <p className="text-xs text-muted-foreground">
                Allow public users to download high-resolution images.
              </p>
            </div>
            <Switch
              id="isHighResDownloadable"
              checked={formData.isHighResDownloadable ?? false}
              onCheckedChange={(checked) =>
                updateField("isHighResDownloadable", checked)
              }
            />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-border/50 p-4">
            <div className="space-y-0.5">
              <Label htmlFor="isSearchable">Searchable</Label>
              <p className="text-xs text-muted-foreground">
                Include this object in public search results.
              </p>
            </div>
            <Switch
              id="isSearchable"
              checked={formData.isSearchable ?? true}
              onCheckedChange={(checked) =>
                updateField("isSearchable", checked)
              }
            />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-border/50 p-4">
            <div className="space-y-0.5">
              <Label htmlFor="isValuationVisible">Valuation Visibility</Label>
              <p className="text-xs text-muted-foreground">
                Show valuation information on the public page.
              </p>
            </div>
            <Switch
              id="isValuationVisible"
              checked={formData.isValuationVisible ?? false}
              onCheckedChange={(checked) =>
                updateField("isValuationVisible", checked)
              }
            />
          </div>
        </div>
      </EditSection>

      <EditSection
        title="Public URL"
        description="Optional custom slug for public-facing access."
      >
        <div className="space-y-2">
          <Label htmlFor="publicSlug">Public URL Slug</Label>
          <Input
            id="publicSlug"
            value={formData.publicSlug ?? ""}
            onChange={(event) => updateField("publicSlug", event.target.value)}
            placeholder="custom-url-slug"
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Leave blank to use the default public path.
          </p>
        </div>
      </EditSection>
    </div>
  );
}
