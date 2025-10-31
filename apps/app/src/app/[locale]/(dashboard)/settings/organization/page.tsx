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
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { useMutation, useQuery } from "convex/react";
import { Save } from "lucide-react";
import { useState, useEffect } from "react";

export default function OrganizationSettingsPage() {
  const { currentOrganizationId } = useOrganization();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    accessionNumberFormat: "",
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

  useEffect(() => {
    if (organization) {
      setFormData({
        name: organization.name,
        accessionNumberFormat:
          organization.settings?.accessionNumberFormat || "",
        autoGenerateAccessionNumbers:
          organization.settings?.autoGenerateAccessionNumbers ?? true,
        locationTypes: organization.settings?.locationTypes || [],
        enableDetailedConditionReports:
          organization.settings?.enableDetailedConditionReports ?? false,
      });
    }
  }, [organization]);

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

    setIsSubmitting(true);
    try {
      await updateOrganization({
        organizationId: currentOrganizationId as Id<"organizations">,
        name: formData.name.trim(),
        settings: {
          accessionNumberFormat:
            formData.accessionNumberFormat.trim() || undefined,
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
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="accessionFormat">
                    Accession Number Format
                  </Label>
                  <Input
                    id="accessionFormat"
                    value={formData.accessionNumberFormat}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        accessionNumberFormat: e.target.value,
                      })
                    }
                    placeholder="e.g., YYYY-###"
                  />
                  <p className="text-xs text-muted-foreground">
                    Define the format for auto-generated accession numbers. Use
                    YYYY for year, ### for sequential number.
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="autoGenerate">
                      Auto-generate Accession Numbers
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically generate accession numbers when creating new
                      collection objects
                    </p>
                  </div>
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
    </div>
  );
}

