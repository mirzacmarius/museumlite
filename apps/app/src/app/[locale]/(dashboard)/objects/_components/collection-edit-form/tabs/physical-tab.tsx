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

export interface CollectionEditPhysicalTabProps extends CollectionFormTabProps {
  collection: CollectionDoc;
  typedCollectionId: Id<"collections">;
  hasConditionChanged: boolean;
  requiresConditionChangeNote: boolean;
  conditionChangeNote: string;
  onConditionChangeNoteChange: (value: string) => void;
}

export function CollectionEditPhysicalTab({
  formData,
  updateField,
  placeholders,
  currentOrganizationId,
  collection,
  typedCollectionId,
  hasConditionChanged,
  requiresConditionChangeNote,
  conditionChangeNote,
  onConditionChangeNoteChange,
}: CollectionEditPhysicalTabProps) {
  return (
    <div className="space-y-8">
      <EditSection
        title="Physical characteristics"
        description="Material, dimensional, and condition details for the object."
      >
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="materials">Materials</Label>
            <MaterialsCombobox
              organizationId={currentOrganizationId}
              collectionId={typedCollectionId}
              value={
                Array.isArray(formData.materials) ? formData.materials : []
              }
              onValueChange={(value) => updateField("materials", value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="condition">Condition</Label>
            <ConditionCombobox
              organizationId={currentOrganizationId}
              value={formData.condition || ""}
              onValueChange={(value) => updateField("condition", value)}
            />
            {hasConditionChanged ? (
              <div className="rounded-lg border border-dashed border-border/60 bg-secondary/10 p-3">
                <p className="text-xs text-muted-foreground">
                  This change will be dated and attributed automatically.
                </p>
                <div className="mt-3 space-y-2">
                  <Label htmlFor="conditionChangeNote">
                    Condition change note
                  </Label>
                  <Textarea
                    autoResize
                    id="conditionChangeNote"
                    value={conditionChangeNote}
                    onChange={(event) =>
                      onConditionChangeNoteChange(event.target.value)
                    }
                    rows={3}
                    placeholder="Explain what changed and why."
                  />
                  <p className="text-xs text-muted-foreground">
                    {requiresConditionChangeNote
                      ? "Required when replacing an existing condition."
                      : "Optional for the initial condition entry."}
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-3 md:col-span-2 xl:col-span-3">
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-foreground">
                Detailed Dimensions
              </h3>
              <p className="text-sm text-muted-foreground">
                Document dimensions, diameter, and weight.
              </p>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="dimensions">Dimensions</Label>
                <Input
                  id="dimensions"
                  value={formData.dimensions || ""}
                  onChange={(event) =>
                    updateField("dimensions", event.target.value)
                  }
                  placeholder={placeholders("dimensions")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dimensionDiameter">Diameter</Label>
                <Input
                  id="dimensionDiameter"
                  value={formData.dimensionDiameter || ""}
                  onChange={(event) =>
                    updateField("dimensionDiameter", event.target.value)
                  }
                  placeholder="e.g., 43 mm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dimensionWeight">Weight</Label>
                <Input
                  id="dimensionWeight"
                  inputMode="decimal"
                  value={formData.dimensionWeight ?? ""}
                  onChange={(event) =>
                    updateField("dimensionWeight", event.target.value)
                  }
                  placeholder="e.g., 200gram or 2kg"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2 md:col-span-2 xl:col-span-3">
            <Label htmlFor="inscriptions">Inscriptions & Marks</Label>
            <Textarea
              autoResize
              id="inscriptions"
              value={formData.inscriptions || ""}
              onChange={(event) =>
                updateField("inscriptions", event.target.value)
              }
              rows={4}
              placeholder="Document signatures, stamps, labels, engravings, or collector marks"
            />
          </div>
        </div>
      </EditSection>
    </div>
  );
}
