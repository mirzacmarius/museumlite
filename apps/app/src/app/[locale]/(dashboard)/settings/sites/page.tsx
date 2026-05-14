"use client";

import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@v1/ui/dialog";
import { EmptyState } from "@v1/ui/empty-state";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Switch } from "@v1/ui/switch";
import { Textarea } from "@v1/ui/textarea";
import { useMutation, useQuery } from "convex/react";
import { Building2, Edit, MapPin, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

export default function SitesSettingsPage() {
  const t = useScopedI18n("settings");
  const { currentOrganizationId } = useOrganization();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<{
    _id: Id<"sites">;
    name: string;
    description?: string;
    address?: string;
    isPrimary: boolean;
    isActive: boolean;
  } | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    address: "",
    isPrimary: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sites = useQuery(
    api.sites.list,
    currentOrganizationId
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );

  const createSite = useMutation(api.sites.create);
  const updateSite = useMutation(api.sites.update);
  const archiveSite = useMutation(api.sites.archive);

  if (!currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">
          Please select an organization to manage sites.
        </p>
      </div>
    );
  }

  const handleCreateSite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError("Site name is required");
      return;
    }

    setIsSubmitting(true);
    try {
      await createSite({
        organizationId: currentOrganizationId as Id<"organizations">,
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        address: formData.address.trim() || undefined,
        isPrimary: formData.isPrimary,
      });
      setFormData({
        name: "",
        description: "",
        address: "",
        isPrimary: false,
      });
      setCreateDialogOpen(false);
    } catch (err) {
      console.error("Error creating site:", err);
      setError(err instanceof Error ? err.message : "Failed to create site");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSite = (site: NonNullable<typeof sites>[0]) => {
    setEditingSite({
      _id: site._id,
      name: site.name,
      description: site.description,
      address: site.address,
      isPrimary: site.isPrimary,
      isActive: site.isActive,
    });
    setFormData({
      name: site.name,
      description: site.description || "",
      address: site.address || "",
      isPrimary: site.isPrimary,
    });
    setEditDialogOpen(true);
  };

  const handleUpdateSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSite) return;

    setError(null);

    if (!formData.name.trim()) {
      setError("Site name is required");
      return;
    }

    setIsSubmitting(true);
    try {
      await updateSite({
        siteId: editingSite._id,
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        address: formData.address.trim() || undefined,
        isPrimary: formData.isPrimary,
      });
      setEditingSite(null);
      setFormData({
        name: "",
        description: "",
        address: "",
        isPrimary: false,
      });
      setEditDialogOpen(false);
    } catch (err) {
      console.error("Error updating site:", err);
      setError(err instanceof Error ? err.message : "Failed to update site");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchiveSite = async (siteId: Id<"sites">) => {
    if (!confirm("Are you sure you want to archive this site?")) {
      return;
    }

    try {
      await archiveSite({ siteId });
    } catch (err) {
      console.error("Error archiving site:", err);
      alert(err instanceof Error ? err.message : "Failed to archive site");
    }
  };

  return (
    <PermissionGate permission="sites.read">
      <div className="flex flex-col gap-8">
        <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-medium text-foreground">
              Site Management
            </h2>
            <p className="text-sm text-muted-foreground">
              Manage physical locations and branches for your organization
            </p>
          </div>
          <PermissionGate permission="sites.create">
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 size-4" />
                  Create Site
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleCreateSite}>
                  <DialogHeader>
                    <DialogTitle>Create New Site</DialogTitle>
                    <DialogDescription>
                      Add a new physical location or branch to your
                      organization.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-4">
                    {error && (
                      <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                        {error}
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="name">Site Name *</Label>
                      <Input
                        id="name"
                        placeholder="e.g., Main Museum, Storage Facility"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            name: e.target.value,
                          }))
                        }
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        placeholder="Describe this site..."
                        value={formData.description}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            description: e.target.value,
                          }))
                        }
                        rows={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="address">Address</Label>
                      <Textarea
                        id="address"
                        placeholder="123 Main St, City, State, ZIP"
                        value={formData.address}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            address: e.target.value,
                          }))
                        }
                        rows={2}
                      />
                    </div>

                    <div className="flex items-center justify-between space-x-2 rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <Label htmlFor="isPrimary" className="font-medium">
                          Primary Site
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Set this as the main location for your organization
                        </p>
                      </div>
                      <Switch
                        id="isPrimary"
                        checked={formData.isPrimary}
                        onCheckedChange={(checked) =>
                          setFormData((prev) => ({
                            ...prev,
                            isPrimary: checked,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCreateDialogOpen(false)}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? "Creating..." : "Create Site"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </PermissionGate>
        </div>

        {/* Sites List */}
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-medium">Sites</h2>
            <p className="text-sm text-muted-foreground">
              Physical locations and branches for your organization
            </p>
          </div>

          {!sites || sites.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No sites yet"
              description="Create your first site to manage physical locations"
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {sites.map((site) => (
                <div
                  key={site._id}
                  className="rounded-lg border bg-card p-4 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="rounded-full bg-primary/10 p-2">
                        <Building2 className="size-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium truncate">{site.name}</h3>
                          {site.isPrimary && (
                            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                              Primary
                            </span>
                          )}
                          {!site.isActive && (
                            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                              Archived
                            </span>
                          )}
                        </div>
                        {site.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {site.description}
                          </p>
                        )}
                        {site.address && (
                          <div className="flex items-start gap-1.5 mt-2 text-sm text-muted-foreground">
                            <MapPin className="size-3.5 mt-0.5 flex-shrink-0" />
                            <span className="line-clamp-2">{site.address}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <PermissionGate permission="sites.update">
                    <div className="flex items-center gap-2 mt-4 pt-4 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditSite(site)}
                        className="flex-1"
                      >
                        <Edit className="mr-2 size-3.5" />
                        Edit
                      </Button>
                      {!site.isPrimary && site.isActive && (
                        <PermissionGate permission="sites.delete">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleArchiveSite(site._id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </PermissionGate>
                      )}
                    </div>
                  </PermissionGate>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <form onSubmit={handleUpdateSite}>
              <DialogHeader>
                <DialogTitle>Edit Site</DialogTitle>
                <DialogDescription>
                  Update site details and settings.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {error && (
                  <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="edit-name">Site Name *</Label>
                  <Input
                    id="edit-name"
                    placeholder="e.g., Main Museum, Storage Facility"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea
                    id="edit-description"
                    placeholder="Describe this site..."
                    value={formData.description}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-address">Address</Label>
                  <Textarea
                    id="edit-address"
                    placeholder="123 Main St, City, State, ZIP"
                    value={formData.address}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        address: e.target.value,
                      }))
                    }
                    rows={2}
                  />
                </div>

                <div className="flex items-center justify-between space-x-2 rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="edit-isPrimary" className="font-medium">
                      Primary Site
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Set this as the main location for your organization
                    </p>
                  </div>
                  <Switch
                    id="edit-isPrimary"
                    checked={formData.isPrimary}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({
                        ...prev,
                        isPrimary: checked,
                      }))
                    }
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditDialogOpen(false);
                    setEditingSite(null);
                  }}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Updating..." : "Update Site"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </PermissionGate>
  );
}
