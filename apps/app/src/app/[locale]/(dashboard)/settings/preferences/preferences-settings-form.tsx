"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { Save } from "lucide-react";
import { MaterialsCombobox } from "@/components/materials-combobox";
import { PermissionGate } from "@/components/permission-gate";
import { TemplateCombobox } from "@/components/template-combobox";
import { TypeCombobox } from "@/components/type-combobox";
import {
  type CounterScope,
  LocationTypesEditor,
  PreferenceSwitch,
  SettingsSection,
} from "./preferences-settings-shared";

export interface PreferencesFormData {
  accessionNumberFormat: string;
  accessionCounterScope: CounterScope;
  autoGenerateAccessionNumbers: boolean;
  accessionWorkflowEnabled: boolean;
  deaccessionWorkflowEnabled: boolean;
  locationTrackingEnabled: boolean;
  locationTypes: string[];
  enableDetailedConditionReports: boolean;
}

interface PreferencesSettingsFormProps {
  currentOrganizationId: string;
  formData: PreferencesFormData;
  setFormData: React.Dispatch<React.SetStateAction<PreferencesFormData>>;
  t: (key: string) => string;
  systemPresets: Array<{
    value: string;
    label: string;
    description?: string;
  }>;
  customTemplateOptions: Array<{
    value: string;
    label: string;
    description?: string;
    id: Id<"accessionTemplates">;
  }>;
  validation:
    | {
        isValid: boolean;
        error?: string;
        preview?: string;
      }
    | undefined;
  selectedCustomTemplateId: Id<"accessionTemplates"> | null;
  onOpenSaveTemplateModal: (isUpdate: boolean) => void;
  onDeleteTemplate: (id: Id<"accessionTemplates">) => void;
  isSubmitting: boolean;
  onSavePreferences: () => void;
}

export function PreferencesSettingsForm({
  currentOrganizationId,
  formData,
  setFormData,
  t,
  systemPresets,
  customTemplateOptions,
  validation,
  selectedCustomTemplateId,
  onOpenSaveTemplateModal,
  onDeleteTemplate,
  isSubmitting,
  onSavePreferences,
}: PreferencesSettingsFormProps) {
  return (
    <PermissionGate permission="organization.manage_settings">
      <SettingsSection
        title="Physical Descriptions"
        description="Reusable vocabulary for cataloging object materials and types."
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-2">
            <Label>Materials</Label>
            <MaterialsCombobox
              organizationId={currentOrganizationId}
              value={[]}
              placeholder="Search or add materials..."
            />
          </div>
          <div className="space-y-2">
            <Label>Object Types</Label>
            <TypeCombobox
              organizationId={currentOrganizationId}
              value={[]}
              placeholder="Search or add object types..."
            />
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title={t("organization.accessionNumberSettings")}>
        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {t("organization.formatTemplate")}
            </Label>
            <TemplateCombobox
              systemPresets={systemPresets}
              customTemplates={customTemplateOptions}
              value={formData.accessionNumberFormat}
              onValueChange={(value) =>
                setFormData((prev) => ({
                  ...prev,
                  accessionNumberFormat: value,
                }))
              }
              placeholder={t("organization.chooseTemplate")}
              validation={
                validation
                  ? {
                      isValid: validation.isValid,
                      error: validation.error,
                      preview: validation.preview,
                    }
                  : undefined
              }
              onSaveTemplate={() =>
                onOpenSaveTemplateModal(!!selectedCustomTemplateId)
              }
              onDeleteTemplate={(id) =>
                onDeleteTemplate(id as Id<"accessionTemplates">)
              }
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {t("organization.counterResetSchedule")}
              </Label>
              <Select
                value={formData.accessionCounterScope}
                onValueChange={(value: CounterScope) =>
                  setFormData((prev) => ({
                    ...prev,
                    accessionCounterScope: value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">
                    {t("organization.neverGlobal")}
                  </SelectItem>
                  <SelectItem value="year">
                    {t("organization.yearlyResets")}
                  </SelectItem>
                  <SelectItem value="month">
                    {t("organization.monthlyResets")}
                  </SelectItem>
                  <SelectItem value="day">
                    {t("organization.dailyResets")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <PreferenceSwitch
              id="autoGenerate"
              label={t("organization.autoGeneration")}
              description={t("organization.autoGenerateAccession")}
              checked={formData.autoGenerateAccessionNumbers}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({
                  ...prev,
                  autoGenerateAccessionNumbers: checked,
                }))
              }
            />
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Automations and workflows">
        <div className="space-y-4">
          <PreferenceSwitch
            id="accessionWorkflowEnabled"
            label="Accessions approval workflow"
            description="When enabled, new object requests are routed for curator and admin approval. When disabled, submitted objects are approved and published immediately."
            checked={formData.accessionWorkflowEnabled}
            onCheckedChange={(checked) =>
              setFormData((prev) => ({
                ...prev,
                accessionWorkflowEnabled: checked,
              }))
            }
          />
          <PreferenceSwitch
            id="deaccessionWorkflowEnabled"
            label="Deaccessions approval workflow"
            description="When enabled, deaccession requests require approval before objects are removed. When disabled, deaccession requests are applied immediately."
            checked={formData.deaccessionWorkflowEnabled}
            onCheckedChange={(checked) =>
              setFormData((prev) => ({
                ...prev,
                deaccessionWorkflowEnabled: checked,
              }))
            }
          />
        </div>
      </SettingsSection>

      <SettingsSection title="Locations">
        <div className="space-y-6">
          <PreferenceSwitch
            id="locationTrackingEnabled"
            label="Locations and tracking"
            description="When disabled, location navigation and object placement surfaces are hidden."
            checked={formData.locationTrackingEnabled}
            onCheckedChange={(checked) =>
              setFormData((prev) => ({
                ...prev,
                locationTrackingEnabled: checked,
              }))
            }
          />
          <LocationTypesEditor
            locationTypes={formData.locationTypes}
            onChange={(locationTypes) =>
              setFormData((prev) => ({ ...prev, locationTypes }))
            }
          />
        </div>
      </SettingsSection>

      <SettingsSection title={t("organization.loanSettings")}>
        <PreferenceSwitch
          id="detailedConditionReports"
          label={t("organization.enableDetailedConditionReports")}
          description={t("organization.detailedConditionReportsHint")}
          checked={formData.enableDetailedConditionReports}
          onCheckedChange={(checked) =>
            setFormData((prev) => ({
              ...prev,
              enableDetailedConditionReports: checked,
            }))
          }
        />
      </SettingsSection>

      <div className="flex justify-end">
        <Button onClick={onSavePreferences} disabled={isSubmitting}>
          <Save className="mr-2 size-4" />
          {isSubmitting
            ? t("organization.saving")
            : t("organization.saveChanges")}
        </Button>
      </div>
    </PermissionGate>
  );
}
