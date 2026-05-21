"use client";

import { MaterialsCombobox } from "@/components/materials-combobox";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { TemplateCombobox } from "@/components/template-combobox";
import { TypeCombobox } from "@/components/type-combobox";
import { useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@v1/ui/alert-dialog";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
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
import { useMutation, useQuery } from "convex/react";
import { Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type CounterScope = "global" | "year" | "month" | "day";

const PAGE_HEADER = (
  <div className="flex flex-col gap-2">
    <h2 className="text-xl font-medium text-foreground">Preferences</h2>
    <p className="text-sm text-muted-foreground">
      Configure catalog vocabulary, numbering, workflows, and location tracking.
    </p>
  </div>
);

function SettingsSection({
  children,
  description,
  title,
}: {
  children: React.ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <div className="mb-5 space-y-1">
        <h2 className="text-lg font-medium">{title}</h2>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function PreferenceSwitch({
  checked,
  description,
  id,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  description: string;
  id: string;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-6 rounded-lg border border-border/70 bg-secondary/20 p-4">
      <div className="space-y-1">
        <Label htmlFor={id}>{label}</Label>
        <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function LocationTypesEditor({
  locationTypes,
  onChange,
}: {
  locationTypes: string[];
  onChange: (locationTypes: string[]) => void;
}) {
  const [newLocationType, setNewLocationType] = useState("");

  const addLocationType = () => {
    const trimmed = newLocationType.trim();
    if (!trimmed) return;
    if (
      locationTypes.some((type) => type.toLowerCase() === trimmed.toLowerCase())
    ) {
      setNewLocationType("");
      return;
    }
    onChange([...locationTypes, trimmed]);
    setNewLocationType("");
  };

  return (
    <div className="space-y-3">
      <Label>Location Types</Label>
      <div className="flex gap-2">
        <Input
          value={newLocationType}
          onChange={(event) => setNewLocationType(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addLocationType();
            }
          }}
          placeholder="Gallery, Vault, Shelf"
        />
        <Button type="button" variant="outline" onClick={addLocationType}>
          <Plus className="mr-2 size-4" />
          Add
        </Button>
      </div>
      {locationTypes.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {locationTypes.map((type) => (
            <div
              key={type}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-secondary px-3 py-1"
            >
              <span className="text-sm">{type}</span>
              <button
                type="button"
                onClick={() =>
                  onChange(locationTypes.filter((item) => item !== type))
                }
                className="text-muted-foreground hover:text-destructive"
                aria-label={`Delete ${type}`}
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No custom location types.
        </p>
      )}
    </div>
  );
}

export default function PreferencesSettingsPage() {
  const t = useScopedI18n("settings");
  const tCommon = useScopedI18n("common");
  const { currentOrganizationId } = useOrganization();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState("");
  const [saveTemplateDesc, setSaveTemplateDesc] = useState("");
  const [deleteTemplateId, setDeleteTemplateId] =
    useState<Id<"accessionTemplates"> | null>(null);
  const [formData, setFormData] = useState({
    accessionNumberFormat: "",
    accessionCounterScope: "year" as CounterScope,
    autoGenerateAccessionNumbers: true,
    accessionWorkflowEnabled: true,
    deaccessionWorkflowEnabled: true,
    locationTrackingEnabled: true,
    locationTypes: [] as string[],
    enableDetailedConditionReports: false,
  });

  const organization = useQuery(
    api.organizations.get,
    currentOrganizationId
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );
  const validation = useQuery(
    api.organizations.validateAccessionFormat,
    formData.accessionNumberFormat && organization
      ? {
          template: formData.accessionNumberFormat,
          organizationSlug: organization.slug,
        }
      : "skip",
  );
  const presets = useQuery(api.organizations.getAccessionTemplatePresets, {});
  const customTemplates = useQuery(
    api.accessionTemplates.list,
    currentOrganizationId
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );
  const updateOrganization = useMutation(api.organizations.update);
  const createTemplate = useMutation(api.accessionTemplates.create);
  const removeTemplate = useMutation(api.accessionTemplates.remove);
  const updateTemplate = useMutation(api.accessionTemplates.update);

  useEffect(() => {
    if (!organization) return;
    setFormData({
      accessionNumberFormat: organization.settings?.accessionNumberFormat || "",
      accessionCounterScope:
        organization.settings?.accessionCounterScope || "year",
      autoGenerateAccessionNumbers:
        organization.settings?.autoGenerateAccessionNumbers ?? true,
      accessionWorkflowEnabled:
        organization.settings?.accessionWorkflowEnabled ?? true,
      deaccessionWorkflowEnabled:
        organization.settings?.deaccessionWorkflowEnabled ?? true,
      locationTrackingEnabled:
        organization.settings?.locationTrackingEnabled ?? true,
      locationTypes: organization.settings?.locationTypes || [],
      enableDetailedConditionReports:
        organization.settings?.enableDetailedConditionReports ?? false,
    });
  }, [organization]);

  const systemPresets = useMemo(() => {
    return (presets || []).map((preset) => ({
      value: preset.template,
      label: preset.name,
      description: preset.description,
    }));
  }, [presets]);

  const customTemplateOptions = useMemo(() => {
    return (customTemplates || []).map((template) => ({
      value: template.template,
      label: template.name,
      description: template.description,
      id: template._id,
    }));
  }, [customTemplates]);

  const selectedCustomTemplate = useMemo(() => {
    return customTemplates?.find(
      (template) => template.template === formData.accessionNumberFormat,
    );
  }, [customTemplates, formData.accessionNumberFormat]);

  const selectedCustomTemplateId = selectedCustomTemplate?._id ?? null;

  const openSaveTemplateModal = (isUpdate = false) => {
    if (!formData.accessionNumberFormat || !validation?.isValid) {
      setError(t("organization.templateDialog.validTemplateRequired"));
      return;
    }

    if (isUpdate && selectedCustomTemplate) {
      setSaveTemplateName(selectedCustomTemplate.name);
      setSaveTemplateDesc(selectedCustomTemplate.description || "");
    } else {
      setSaveTemplateName("");
      setSaveTemplateDesc("");
    }
    setShowSaveModal(true);
  };

  const handleSaveTemplate = async () => {
    if (!currentOrganizationId || !saveTemplateName.trim()) {
      setError(t("organization.templateDialog.templateNameRequired"));
      return;
    }

    try {
      if (selectedCustomTemplateId) {
        await updateTemplate({
          templateId: selectedCustomTemplateId,
          name: saveTemplateName.trim(),
          description: saveTemplateDesc.trim() || undefined,
          template: formData.accessionNumberFormat,
        });
      } else {
        await createTemplate({
          organizationId: currentOrganizationId as Id<"organizations">,
          name: saveTemplateName.trim(),
          template: formData.accessionNumberFormat,
          description: saveTemplateDesc.trim() || undefined,
        });
      }
      setShowSaveModal(false);
      setSaveTemplateName("");
      setSaveTemplateDesc("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("organization.templateDialog.saveError"),
      );
    }
  };

  const handleDeleteTemplate = async () => {
    if (!deleteTemplateId) return;

    try {
      await removeTemplate({ templateId: deleteTemplateId });
      if (deleteTemplateId === selectedCustomTemplateId) {
        setFormData((current) => ({
          ...current,
          accessionNumberFormat: "",
        }));
      }
      setDeleteTemplateId(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("organization.templateDialog.deleteError"),
      );
    }
  };

  const handleSavePreferences = async () => {
    if (!currentOrganizationId) return;
    setError(null);

    if (formData.accessionNumberFormat && validation && !validation.isValid) {
      setError(`Invalid accession format: ${validation.error}`);
      return;
    }

    setIsSubmitting(true);
    try {
      await updateOrganization({
        organizationId: currentOrganizationId as Id<"organizations">,
        settings: {
          accessionNumberFormat:
            formData.accessionNumberFormat.trim() || undefined,
          accessionCounterScope: formData.accessionCounterScope,
          autoGenerateAccessionNumbers: formData.autoGenerateAccessionNumbers,
          accessionWorkflowEnabled: formData.accessionWorkflowEnabled,
          deaccessionWorkflowEnabled: formData.deaccessionWorkflowEnabled,
          locationTrackingEnabled: formData.locationTrackingEnabled,
          locationTypes:
            formData.locationTypes.length > 0
              ? formData.locationTypes
              : undefined,
          enableDetailedConditionReports:
            formData.enableDetailedConditionReports,
        },
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update preferences",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!currentOrganizationId) {
    return (
      <div className="flex w-full flex-col gap-6">
        {PAGE_HEADER}
        <div className="flex min-h-48 items-center justify-center rounded-lg border border-border bg-card p-6">
          <p className="text-muted-foreground">
            Please select an organization to manage preferences.
          </p>
        </div>
      </div>
    );
  }

  if (organization === undefined) {
    return (
      <div className="flex w-full flex-col gap-6">
        {PAGE_HEADER}
        <div className="flex min-h-48 items-center justify-center rounded-lg border border-border bg-card p-6">
          <p className="text-muted-foreground">{tCommon("loading")}</p>
        </div>
      </div>
    );
  }

  if (organization === null) {
    return (
      <div className="flex w-full flex-col gap-6">
        {PAGE_HEADER}
        <div className="flex min-h-48 items-center justify-center rounded-lg border border-border bg-card p-6">
          <p className="text-muted-foreground">{tCommon("noResults")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6">
      {PAGE_HEADER}
      {error ? (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

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
                  openSaveTemplateModal(!!selectedCustomTemplateId)
                }
                onDeleteTemplate={(id) =>
                  setDeleteTemplateId(id as Id<"accessionTemplates">)
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
          <Button onClick={handleSavePreferences} disabled={isSubmitting}>
            <Save className="mr-2 size-4" />
            {isSubmitting
              ? t("organization.saving")
              : t("organization.saveChanges")}
          </Button>
        </div>
      </PermissionGate>

      <Dialog open={showSaveModal} onOpenChange={setShowSaveModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedCustomTemplateId
                ? t("organization.templateDialog.updateTemplate")
                : t("organization.templateDialog.saveTemplate")}
            </DialogTitle>
            <DialogDescription>
              {selectedCustomTemplateId
                ? t("organization.templateDialog.updateDescription")
                : t("organization.templateDialog.saveDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="templateName">
                {t("organization.templateDialog.templateName")}
              </Label>
              <Input
                id="templateName"
                value={saveTemplateName}
                onChange={(event) => setSaveTemplateName(event.target.value)}
                placeholder={t(
                  "organization.templateDialog.templateNamePlaceholder",
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="templateDesc">
                {t("organization.templateDialog.description")}
              </Label>
              <Textarea
                id="templateDesc"
                value={saveTemplateDesc}
                onChange={(event) => setSaveTemplateDesc(event.target.value)}
                placeholder={t(
                  "organization.templateDialog.descriptionPlaceholder",
                )}
                rows={3}
              />
            </div>
            <div className="rounded-md bg-secondary p-3">
              <Label className="text-xs text-muted-foreground">
                {t("organization.templateDialog.templateFormat")}
              </Label>
              <code className="mt-1 block font-mono text-sm">
                {formData.accessionNumberFormat}
              </code>
              {validation?.preview ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("organization.templateDialog.preview")}{" "}
                  <code className="font-mono">{validation.preview}</code>
                </p>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowSaveModal(false);
                setSaveTemplateName("");
                setSaveTemplateDesc("");
              }}
            >
              {t("organization.templateDialog.cancel")}
            </Button>
            <Button type="button" onClick={handleSaveTemplate}>
              {selectedCustomTemplateId
                ? t("organization.templateDialog.update")
                : t("organization.templateDialog.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTemplateId}
        onOpenChange={() => setDeleteTemplateId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("organization.deleteTemplateDialog.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("organization.deleteTemplateDialog.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("organization.deleteTemplateDialog.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTemplate}>
              {t("organization.deleteTemplateDialog.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
