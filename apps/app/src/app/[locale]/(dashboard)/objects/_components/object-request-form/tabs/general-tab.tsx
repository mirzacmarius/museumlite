"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { useQuery } from "convex/react";
import { CollectionGroupCombobox } from "@/components/collection-group-combobox";
import { CollectionTypeSelector } from "@/components/collection-type-selector";
import { IdentifierAvailabilityHint } from "@/components/identifier-availability-hint";
import { LocationSelector } from "@/components/location-selector";
import { usePermissions } from "@/components/permission-gate";
import { RepeatableTextField } from "@/components/repeatable-text-field";
import { TypeCombobox } from "@/components/type-combobox";
import type { useFeatureAccess } from "@/hooks/use-feature-access";
import { useI18n } from "@/locales/client";
import { TagsField } from "../../collection-form-shared/catalog-parity-fields";
import { EditSection } from "../../collection-form-shared/edit-section";
import type { CollectionFormTabProps } from "../../collection-form-shared/types";
export interface ObjectRequestGeneralTabProps extends CollectionFormTabProps {
  identifierAccessionId?: Id<"accessions">;
  enabledModules: ReturnType<typeof useFeatureAccess>["enabledModules"];
}

export function ObjectRequestGeneralTab({
  formData,
  updateField,
  placeholders,
  currentOrganizationId,
  isLocationTrackingEnabled,
  enabledModules,
  identifierAccessionId,
}: ObjectRequestGeneralTabProps) {
  const { hasPermission } = usePermissions();
  const savedAccession = useQuery(
    api.accessions.get,
    identifierAccessionId &&
      !formData.accessionNumber &&
      hasPermission("collections.read")
      ? { accessionId: identifierAccessionId }
      : "skip",
  );
  const displayedIdentifier =
    formData.accessionNumber || savedAccession?.accessionNumber || "";
  const tRoot = useI18n();
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
            <CollectionTypeSelector
              value={formData.collectionType}
              enabledModules={enabledModules}
              onValueChange={(value) => updateField("collectionType", value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="accessionNumber">
              {tRoot("objects.form.accessionNumber")}
            </Label>
            <Input
              id="accessionNumber"
              readOnly={!!identifierAccessionId}
              value={displayedIdentifier}
              onChange={(event) =>
                updateField("accessionNumber", event.target.value)
              }
              placeholder={placeholders("accessionNumber")}
            />
            {identifierAccessionId ? (
              <p className="text-xs text-muted-foreground">
                {tRoot("identifiers.hint.permanentInDraft")}
              </p>
            ) : null}
            <IdentifierAvailabilityHint
              organizationId={currentOrganizationId}
              register="accession"
              existingId={identifierAccessionId}
              identifier={displayedIdentifier}
            />
          </div>

          <div className="space-y-2 xl:col-span-1">
            <RepeatableTextField
              label={tRoot("objects.form.alternateAccessionNumbers")}
              value={formData.alternateAccessionNumbers || []}
              onChange={(values) =>
                updateField("alternateAccessionNumbers", values)
              }
              placeholder={placeholders("alternateId")}
              id="alternateAccessionNumbers"
            />
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

          <div className="space-y-2">
            <Label id="objectType-label" htmlFor="objectType">
              {tRoot("objects.filters.objectType")}
            </Label>
            <TypeCombobox
              id="objectType"
              aria-labelledby="objectType-label"
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

          {isLocationTrackingEnabled ? (
            <div className="space-y-2">
              <Label htmlFor="generalCurrentLocationId">
                {tRoot("objects.filters.location")}
              </Label>
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
            <Label htmlFor="generalCollectionGroupId">
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
          </div>
        </div>
      </EditSection>
    </div>
  );
}
