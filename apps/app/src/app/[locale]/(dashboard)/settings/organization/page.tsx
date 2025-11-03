"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { Textarea } from "@v1/ui/textarea";
import { Label } from "@v1/ui/label";
import { Switch } from "@v1/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
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
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { TemplateCombobox } from "@/components/template-combobox";
import { InfoTooltip } from "@/components/info-tooltip";
import { useMutation, useQuery } from "convex/react";
import { Save, Trash2, Plus, Pencil } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { cn } from "@v1/ui/utils";

export default function OrganizationSettingsPage() {
  const { currentOrganizationId } = useOrganization();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState("");
  const [saveTemplateDesc, setSaveTemplateDesc] = useState("");
  const [deleteTemplateId, setDeleteTemplateId] = useState<Id<"accessionTemplates"> | null>(null);
  const [selectedCustomTemplateId, setSelectedCustomTemplateId] = useState<Id<"accessionTemplates"> | null>(null);
  
  // Condition management state
  const [showConditionModal, setShowConditionModal] = useState(false);
  const [editingCondition, setEditingCondition] = useState<any | null>(null);
  const [conditionName, setConditionName] = useState("");
  const [conditionDesc, setConditionDesc] = useState("");
  const [deleteConditionId, setDeleteConditionId] = useState<Id<"conditionOptions"> | null>(null);
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
  
  // Condition mutations
  const createCondition = useMutation(api.conditionOptions.create);
  const updateCondition = useMutation(api.conditionOptions.update);
  const removeCondition = useMutation(api.conditionOptions.remove);
  
  // Query custom conditions
  const customConditions = useQuery(
    api.conditionOptions.list,
    currentOrganizationId ? { organizationId: currentOrganizationId as Id<"organizations"> } : "skip"
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
    currentOrganizationId ? { organizationId: currentOrganizationId as Id<"organizations"> } : "skip",
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
    return customTemplates?.find((t) => t.template === formData.accessionNumberFormat);
  }, [customTemplates, formData.accessionNumberFormat]);

  // Update selected template ID when format changes
  useEffect(() => {
    setSelectedCustomTemplateId(selectedCustomTemplate?._id || null);
  }, [selectedCustomTemplate]);

  // Check if template has been modified
  const isTemplateModified = useMemo(() => {
    if (!selectedCustomTemplateId) return false;
    const template = customTemplates?.find((t) => t._id === selectedCustomTemplateId);
    return template?.template !== formData.accessionNumberFormat;
  }, [selectedCustomTemplateId, customTemplates, formData.accessionNumberFormat]);

  // Open save/update template modal
  const openSaveTemplateModal = (isUpdate = false) => {
    if (!formData.accessionNumberFormat || !validation?.isValid) {
      setError("Please enter a valid template first");
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
      setError("Template name is required");
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
      setError(err instanceof Error ? err.message : "Failed to save template");
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
      setError(err instanceof Error ? err.message : "Failed to delete template");
    }
  };

  // Condition handlers
  const openAddConditionModal = () => {
    setEditingCondition(null);
    setConditionName("");
    setConditionDesc("");
    setShowConditionModal(true);
  };

  const openEditConditionModal = (condition: any) => {
    setEditingCondition(condition);
    setConditionName(condition.name);
    setConditionDesc(condition.description);
    setShowConditionModal(true);
  };

  const handleSaveCondition = async () => {
    if (!conditionName.trim()) {
      setError("Condition name is required");
      return;
    }
    if (!conditionDesc.trim()) {
      setError("Condition description is required");
      return;
    }

    try {
      if (editingCondition) {
        // Update existing condition
        await updateCondition({
          conditionId: editingCondition._id,
          name: conditionName.trim(),
          description: conditionDesc.trim(),
        });
      } else {
        // Create new condition
        await createCondition({
          organizationId: currentOrganizationId as Id<"organizations">,
          name: conditionName.trim(),
          description: conditionDesc.trim(),
        });
      }
      setShowConditionModal(false);
      setConditionName("");
      setConditionDesc("");
      setEditingCondition(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save condition");
    }
  };

  const handleDeleteCondition = async () => {
    if (!deleteConditionId) return;

    try {
      await removeCondition({ conditionId: deleteConditionId });
      setDeleteConditionId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete condition");
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
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (organization === null) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">Organization not found</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError("Organization name is required");
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
        err instanceof Error
          ? err.message
          : "Failed to update organization. Please try again.",
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
          <h2 className="text-xl font-medium text-primary">Organization Settings</h2>
          <p className="text-sm text-muted-foreground">
            Manage your organization's settings and preferences
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-medium">Basic Information</h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Organization Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Organization Type</Label>
                <Input
                  value={organization.type}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Organization type cannot be changed
                </p>
              </div>
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input
                  value={organization.slug}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Slug cannot be changed
                </p>
              </div>
            </div>
          </div>

          <PermissionGate permission="organization.manage_settings">
            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="mb-4 text-lg font-medium">
                Accession Number Settings
              </h2>
              <div className="space-y-6">
                {/* Template Selection - Full Width */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Format Template</Label>
                  <TemplateCombobox
                    systemPresets={systemPresets}
                    customTemplates={customTemplateOptions}
                    value={formData.accessionNumberFormat}
                    onValueChange={(value) =>
                      setFormData({ ...formData, accessionNumberFormat: value })
                    }
                    placeholder="Choose template..."
                    validation={validation ? {
                      isValid: validation.isValid,
                      error: validation.error,
                      preview: validation.preview
                    } : undefined}
                    onSaveTemplate={() => openSaveTemplateModal(!!selectedCustomTemplateId)}
                    onDeleteTemplate={(id) => setDeleteTemplateId(id as Id<"accessionTemplates">)}
                  />
                </div>

                {/* Counter Configuration */}
                <div className="space-y-4">
                  {/* Counter Reset */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Counter Reset Schedule</Label>
                    <Select
                      value={formData.accessionCounterScope}
                      onValueChange={(value: "global" | "year" | "month" | "day") =>
                        setFormData({ ...formData, accessionCounterScope: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="global">Never (Global Counter)</SelectItem>
                        <SelectItem value="year">Yearly (Resets Jan 1)</SelectItem>
                        <SelectItem value="month">Monthly (Resets 1st)</SelectItem>
                        <SelectItem value="day">Daily (Resets Midnight)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      When should the counter reset to 1?
                    </p>
                  </div>

                  {/* Auto-generate */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Auto-generation</Label>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        Automatically generate accession numbers
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
              <h2 className="mb-4 text-lg font-medium">Location Types</h2>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Custom Location Types</Label>
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
                    Add Location Type
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Define custom location types for your organization (e.g.,
                    Gallery, Vault, Display Case)
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="mb-4 text-lg font-medium">Condition Management</h2>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Custom Condition Options</Label>
                  <p className="text-xs text-muted-foreground">
                    Manage custom condition options for your organization. These will be available when cataloging objects.
                  </p>
                  <div className="space-y-2 mt-3">
                    {customConditions && customConditions.length > 0 ? (
                      customConditions.map((condition) => (
                        <div key={condition._id} className="flex items-start justify-between rounded-lg border p-3 bg-secondary/30">
                          <div className="flex-1">
                            <p className="font-medium">{condition.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{condition.description}</p>
                            {condition.usageCount ? (
                              <p className="text-xs text-muted-foreground mt-1">
                                Used {condition.usageCount} {condition.usageCount === 1 ? 'time' : 'times'}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex gap-2 ml-4">
                            <Button 
                              type="button"
                              size="sm" 
                              variant="ghost" 
                              onClick={() => openEditConditionModal(condition)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button 
                              type="button"
                              size="sm" 
                              variant="ghost" 
                              onClick={() => setDeleteConditionId(condition._id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-lg border border-dashed p-8 text-center">
                        <p className="text-sm text-muted-foreground">
                          No custom conditions defined yet. Add your first custom condition.
                        </p>
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={openAddConditionModal}
                    className="mt-2"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Custom Condition
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    Standard conditions (Excellent, Very Good, Good, Poor) are always available and cannot be edited.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="mb-4 text-lg font-medium">Loan Settings</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="detailedConditionReports">
                      Enable Detailed Condition Reports
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Require detailed condition reports with photos for loan
                      items
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
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </PermissionGate>
        </form>

        {/* Save/Update Template Modal */}
        <Dialog open={showSaveModal} onOpenChange={setShowSaveModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {selectedCustomTemplateId ? "Update Template" : "Save Template"}
              </DialogTitle>
              <DialogDescription>
                {selectedCustomTemplateId 
                  ? "Update your custom template with the current format, name, and description."
                  : "Save your current accession number format as a reusable template."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="templateName">Template Name *</Label>
                <Input
                  id="templateName"
                  value={saveTemplateName}
                  onChange={(e) => setSaveTemplateName(e.target.value)}
                  placeholder="e.g., Monthly Format"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="templateDesc">Description (optional)</Label>
                <Textarea
                  id="templateDesc"
                  value={saveTemplateDesc}
                  onChange={(e) => setSaveTemplateDesc(e.target.value)}
                  placeholder="Describe when to use this template..."
                  rows={3}
                />
              </div>
              <div className="rounded-md bg-secondary p-3">
                <Label className="text-xs text-muted-foreground">Template Format</Label>
                <code className="text-sm block mt-1 font-mono">{formData.accessionNumberFormat}</code>
                {validation?.preview && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Preview: <code className="font-mono">{validation.preview}</code>
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
                Cancel
              </Button>
              <Button type="button" onClick={handleSaveTemplate}>
                {selectedCustomTemplateId ? "Update Template" : "Save Template"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Template Confirmation Modal */}
        <AlertDialog open={!!deleteTemplateId} onOpenChange={() => setDeleteTemplateId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Template</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this template? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteTemplate}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Add/Edit Condition Modal */}
        <Dialog open={showConditionModal} onOpenChange={setShowConditionModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingCondition ? "Edit Condition" : "Add Custom Condition"}
              </DialogTitle>
              <DialogDescription>
                {editingCondition 
                  ? "Update the condition name and description."
                  : "Create a new custom condition for your organization."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="conditionName">Condition Name *</Label>
                <Input
                  id="conditionName"
                  value={conditionName}
                  onChange={(e) => setConditionName(e.target.value)}
                  placeholder="e.g., Fair"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="conditionDesc">Description *</Label>
                <Textarea
                  id="conditionDesc"
                  value={conditionDesc}
                  onChange={(e) => setConditionDesc(e.target.value)}
                  placeholder="Describe this condition level..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowConditionModal(false);
                  setConditionName("");
                  setConditionDesc("");
                  setEditingCondition(null);
                }}
              >
                Cancel
              </Button>
              <Button type="button" onClick={handleSaveCondition}>
                {editingCondition ? "Update Condition" : "Add Condition"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Condition Confirmation Modal */}
        <AlertDialog open={!!deleteConditionId} onOpenChange={() => setDeleteConditionId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Condition</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this custom condition? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteCondition}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}

