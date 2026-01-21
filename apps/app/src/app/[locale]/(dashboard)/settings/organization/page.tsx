"use client";

import { InfoTooltip } from "@/components/info-tooltip";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { TemplateCombobox } from "@/components/template-combobox";
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
import { cn } from "@v1/ui/utils";
import { useMutation, useQuery } from "convex/react";
import { Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export default function OrganizationSettingsPage() {
  const t = useScopedI18n("settings");
  const tCommon = useScopedI18n("common");
  const { currentOrganizationId } = useOrganization();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState("");
  const [saveTemplateDesc, setSaveTemplateDesc] = useState("");
  const [deleteTemplateId, setDeleteTemplateId] =
    useState<Id<"accessionTemplates"> | null>(null);
  const [selectedCustomTemplateId, setSelectedCustomTemplateId] =
    useState<Id<"accessionTemplates"> | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    accessionNumberFormat: "",
    accessionCounterScope: "year" as "global" | "year" | "month" | "day",
    autoGenerateAccessionNumbers: true,
    locationTypes: [] as string[],
    enableDetailedConditionReports: false,
  });

  const organization = useQuery(
    api.organizations.get,
    currentOrganizationId
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );

  const updateOrganization = useMutation(api.organizations.update);
  const createTemplate = useMutation(api.accessionTemplates.create);
  const removeTemplate = useMutation(api.accessionTemplates.remove);
  const updateTemplate = useMutation(api.accessionTemplates.update);

  // Query custom conditions (for display only)
  const customConditions = useQuery(
    api.conditionOptions.list,
    currentOrganizationId
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );

  // Query custom materials (for display only)
  const customMaterials = useQuery(
    api.materialOptions.list,
    currentOrganizationId
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );

  // Validation query with debouncing
  const validation = useQuery(
    api.organizations.validateAccessionFormat,
    formData.accessionNumberFormat && organization
      ? {
          template: formData.accessionNumberFormat,
          organizationSlug: organization.slug,
        }
      : "skip",
  );

  // Preset templates query
  const presets = useQuery(api.organizations.getAccessionTemplatePresets, {});

  // Custom templates query
  const customTemplates = useQuery(
    api.accessionTemplates.list,
    currentOrganizationId
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );

  useEffect(() => {
    if (organization) {
      setFormData({
        name: organization.name,
        accessionNumberFormat:
          organization.settings?.accessionNumberFormat || "",
        accessionCounterScope:
          organization.settings?.accessionCounterScope || "year",
        autoGenerateAccessionNumbers:
          organization.settings?.autoGenerateAccessionNumbers ?? true,
        locationTypes: organization.settings?.locationTypes || [],
        enableDetailedConditionReports:
          organization.settings?.enableDetailedConditionReports ?? false,
      });
    }
  }, [organization]);

  // Memoized template options for combobox
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

  // Detect if current format matches a custom template
  const selectedCustomTemplate = useMemo(() => {
    return customTemplates?.find(
      (t) => t.template === formData.accessionNumberFormat,
    );
  }, [customTemplates, formData.accessionNumberFormat]);

  // Update selected template ID when format changes
  useEffect(() => {
    setSelectedCustomTemplateId(selectedCustomTemplate?._id || null);
  }, [selectedCustomTemplate]);

  // Check if template has been modified
  const isTemplateModified = useMemo(() => {
    if (!selectedCustomTemplateId) return false;
    const template = customTemplates?.find(
      (t) => t._id === selectedCustomTemplateId,
    );
    return template?.template !== formData.accessionNumberFormat;
  }, [
    selectedCustomTemplateId,
    customTemplates,
    formData.accessionNumberFormat,
  ]);

  // Open save/update template modal
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

  // Save or update template handler
  const handleSaveTemplate = async () => {
    if (!saveTemplateName.trim()) {
      setError(t("organization.templateDialog.templateNameRequired"));
      return;
    }

    try {
      if (selectedCustomTemplateId) {
        // Update existing template
        await updateTemplate({
          templateId: selectedCustomTemplateId,
          name: saveTemplateName.trim(),
          description: saveTemplateDesc.trim() || undefined,
          template: formData.accessionNumberFormat,
        });
      } else {
        // Create new template
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

  // Delete template handler
  const handleDeleteTemplate = async () => {
    if (!deleteTemplateId) return;

    try {
      await removeTemplate({ templateId: deleteTemplateId });
      setDeleteTemplateId(null);
      // Clear the format if the deleted template was selected
      if (deleteTemplateId === selectedCustomTemplateId) {
        setFormData({ ...formData, accessionNumberFormat: "" });
        setSelectedCustomTemplateId(null);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("organization.templateDialog.deleteError"),
      );
    }
  };

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">
          Please select an organization to manage settings.
        </p>
      </div>
    );
  }

  if (organization === undefined) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">{tCommon("loading")}</p>
      </div>
    );
  }

  if (organization === null) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">{tCommon("noResults")}</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError(t("organization.organizationNameRequired"));
      return;
    }

    // Validate template if provided
    if (formData.accessionNumberFormat && validation && !validation.isValid) {
      setError(`Invalid accession format: ${validation.error}`);
      return;
    }

    setIsSubmitting(true);
    try {
      await updateOrganization({
        organizationId: currentOrganizationId as Id<"organizations">,
        name: formData.name.trim(),
        settings: {
          accessionNumberFormat:
            formData.accessionNumberFormat.trim() || undefined,
          accessionCounterScope: formData.accessionCounterScope,
          autoGenerateAccessionNumbers: formData.autoGenerateAccessionNumbers,
          locationTypes:
            formData.locationTypes.length > 0
              ? formData.locationTypes
              : undefined,
          enableDetailedConditionReports:
            formData.enableDetailedConditionReports,
        },
      });
    } catch (err) {
      console.error("Error updating organization:", err);
      setError(
        err instanceof Error ? err.message : t("organization.updateError"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddLocationType = () => {
    const newType = prompt("Enter location type name:");
    if (newType?.trim()) {
      setFormData({
        ...formData,
        locationTypes: [...formData.locationTypes, newType.trim()],
      });
    }
  };

  const handleRemoveLocationType = (index: number) => {
    setFormData({
      ...formData,
      locationTypes: formData.locationTypes.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex w-full flex-col gap-2">
        <h2 className="text-xl font-medium text-primary">
          {t("organization.title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("organization.description")}
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-medium">
            {t("organization.basicInformation")}
          </h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("organization.nameLabel")}</Label>
              <PermissionGate
                permission="organization.manage_settings"
                fallback={
                  <Input
                    id="name"
                    value={formData.name}
                    disabled
                    className="bg-muted"
                  />
                }
              >
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
              </PermissionGate>
            </div>
            <div className="space-y-2">
              <Label>{t("organization.typeLabel")}</Label>
              <Input value={organization.type} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">
                {t("organization.typeCannotChange")}
              </p>
            </div>
            <div className="space-y-2">
              <Label>{t("organization.slugLabel")}</Label>
              <Input value={organization.slug} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">
                {t("organization.slugCannotChange")}
              </p>
            </div>
          </div>
        </div>

        <PermissionGate permission="organization.manage_settings">
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-medium">
              {t("organization.accessionNumberSettings")}
            </h2>
            <div className="space-y-6">
              {/* Template Selection - Full Width */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  {t("organization.formatTemplate")}
                </Label>
                <TemplateCombobox
                  systemPresets={systemPresets}
                  customTemplates={customTemplateOptions}
                  value={formData.accessionNumberFormat}
                  onValueChange={(value) =>
                    setFormData({ ...formData, accessionNumberFormat: value })
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

              {/* Counter Configuration */}
              <div className="space-y-4">
                {/* Counter Reset */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    {t("organization.counterResetSchedule")}
                  </Label>
                  <Select
                    value={formData.accessionCounterScope}
                    onValueChange={(
                      value: "global" | "year" | "month" | "day",
                    ) =>
                      setFormData({ ...formData, accessionCounterScope: value })
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
                  <p className="text-xs text-muted-foreground">
                    {t("organization.whenCounterReset")}
                  </p>
                </div>

                {/* Auto-generate */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    {t("organization.autoGeneration")}
                  </Label>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      {t("organization.autoGenerateAccession")}
                    </p>
                    <Switch
                      id="autoGenerate"
                      checked={formData.autoGenerateAccessionNumbers}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          autoGenerateAccessionNumbers: checked,
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-medium">
              {t("organization.locationTypes")}
            </h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("organization.customLocationTypes")}</Label>
                <div className="flex flex-wrap gap-2">
                  {formData.locationTypes.map((type, index) => {
                    // Use a combination of type and index for unique key since types might have duplicates
                    const uniqueKey = `${type}-${index}`;
                    return (
                      <div
                        key={uniqueKey}
                        className="flex items-center gap-2 rounded-md border border-border bg-secondary px-3 py-1"
                      >
                        <span className="text-sm">{type}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveLocationType(index)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddLocationType}
                >
                  {t("organization.addLocationType")}
                </Button>
                <p className="text-xs text-muted-foreground">
                  {t("organization.locationTypeHint")}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-medium">
              {t("organization.conditionOptions")}
            </h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("organization.organizationConditions")}</Label>
                <p className="text-xs text-muted-foreground">
                  {t("organization.conditionHint")}
                </p>
                {customConditions && customConditions.length > 0 && (
                  <div className="mt-3 rounded-lg border p-3 bg-secondary/10">
                    <p className="text-xs font-medium mb-2">
                      {t("organization.yourCustomConditions")}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {customConditions.map((condition) => (
                        <div
                          key={condition._id}
                          className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2 py-1"
                        >
                          <span className="text-xs font-medium">
                            {condition.name}
                          </span>
                          {condition.usageCount ? (
                            <span className="text-[10px] text-muted-foreground">
                              ({condition.usageCount})
                            </span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="mt-3 rounded-lg border border-dashed p-4 bg-muted/20">
                  <p className="text-xs text-muted-foreground">
                    {t("organization.conditionTip")}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {t("organization.standardConditions")}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-medium">
              {t("organization.materialOptions")}
            </h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("organization.organizationMaterials")}</Label>
                <p className="text-xs text-muted-foreground">
                  {t("organization.materialHint")}
                </p>
                {customMaterials && customMaterials.length > 0 && (
                  <div className="mt-3 rounded-lg border p-3 bg-secondary/10">
                    <p className="text-xs font-medium mb-2">
                      {t("organization.yourMaterials")}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {customMaterials.map((material) => (
                        <div
                          key={material._id}
                          className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2 py-1"
                        >
                          <span className="text-xs font-medium">
                            {material.name}
                          </span>
                          {material.usageCount ? (
                            <span className="text-[10px] text-muted-foreground">
                              ({material.usageCount})
                            </span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="mt-3 rounded-lg border border-dashed p-4 bg-muted/20">
                  <p className="text-xs text-muted-foreground">
                    {t("organization.materialTip")}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-medium">
              {t("organization.loanSettings")}
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="detailedConditionReports">
                    {t("organization.enableDetailedConditionReports")}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t("organization.detailedConditionReportsHint")}
                  </p>
                </div>
                <Switch
                  id="detailedConditionReports"
                  checked={formData.enableDetailedConditionReports}
                  onCheckedChange={(checked) =>
                    setFormData({
                      ...formData,
                      enableDetailedConditionReports: checked,
                    })
                  }
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-4">
            <Button type="submit" disabled={isSubmitting}>
              <Save className="mr-2 h-4 w-4" />
              {isSubmitting
                ? t("organization.saving")
                : t("organization.saveChanges")}
            </Button>
          </div>
        </PermissionGate>
      </form>

      {/* Save/Update Template Modal */}
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
                onChange={(e) => setSaveTemplateName(e.target.value)}
                placeholder={t(
                  "organization.templateDialog.templateNamePlaceholder",
                )}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="templateDesc">
                {t("organization.templateDialog.description")}
              </Label>
              <Textarea
                id="templateDesc"
                value={saveTemplateDesc}
                onChange={(e) => setSaveTemplateDesc(e.target.value)}
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
              <code className="text-sm block mt-1 font-mono">
                {formData.accessionNumberFormat}
              </code>
              {validation?.preview && (
                <p className="text-xs text-muted-foreground mt-2">
                  {t("organization.templateDialog.preview")}{" "}
                  <code className="font-mono">{validation.preview}</code>
                </p>
              )}
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

      {/* Delete Template Confirmation Modal */}
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
