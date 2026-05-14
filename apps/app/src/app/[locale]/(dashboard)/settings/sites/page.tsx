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
import { useReducer } from "react";

interface SiteFormData {
  name: string;
  description: string;
  address: string;
  isPrimary: boolean;
}

interface EditingSite {
  _id: Id<"sites">;
  name: string;
  description?: string;
  address?: string;
  isPrimary: boolean;
  isActive: boolean;
}

interface SitesPageState {
  createDialogOpen: boolean;
  editDialogOpen: boolean;
  editingSite: EditingSite | null;
  formData: SiteFormData;
  isSubmitting: boolean;
  error: string | null;
}

type SitesPageAction =
  | { type: "setCreateDialogOpen"; open: boolean }
  | { type: "setEditDialogOpen"; open: boolean }
  | { type: "setEditingSite"; site: EditingSite | null }
  | { type: "setFormData"; formData: SiteFormData }
  | { type: "patchFormData"; patch: Partial<SiteFormData> }
  | { type: "setIsSubmitting"; isSubmitting: boolean }
  | { type: "setError"; error: string | null }
  | { type: "resetForm" };

const EMPTY_SITE_FORM: SiteFormData = {
  name: "",
  description: "",
  address: "",
  isPrimary: false,
};

const INITIAL_SITES_PAGE_STATE: SitesPageState = {
  createDialogOpen: false,
  editDialogOpen: false,
  editingSite: null,
  formData: EMPTY_SITE_FORM,
  isSubmitting: false,
  error: null,
};

function sitesPageReducer(
  state: SitesPageState,
  action: SitesPageAction,
): SitesPageState {
  switch (action.type) {
    case "setCreateDialogOpen":
      return { ...state, createDialogOpen: action.open };
    case "setEditDialogOpen":
      return { ...state, editDialogOpen: action.open };
    case "setEditingSite":
      return { ...state, editingSite: action.site };
    case "setFormData":
      return { ...state, formData: action.formData };
    case "patchFormData":
      return { ...state, formData: { ...state.formData, ...action.patch } };
    case "setIsSubmitting":
      return { ...state, isSubmitting: action.isSubmitting };
    case "setError":
      return { ...state, error: action.error };
    case "resetForm":
      return { ...state, formData: EMPTY_SITE_FORM };
  }
}

export default function SitesSettingsPage() {
  const t = useScopedI18n("settings");
  const { currentOrganizationId } = useOrganization();
  const [state, dispatch] = useReducer(
    sitesPageReducer,
    INITIAL_SITES_PAGE_STATE,
  );
  const {
    createDialogOpen,
    editDialogOpen,
    editingSite,
    formData,
    isSubmitting,
    error,
  } = state;

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
    dispatch({ type: "setError", error: null });

    if (!formData.name.trim()) {
      dispatch({ type: "setError", error: "Site name is required" });
      return;
    }

    dispatch({ type: "setIsSubmitting", isSubmitting: true });
    try {
      await createSite({
        organizationId: currentOrganizationId as Id<"organizations">,
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        address: formData.address.trim() || undefined,
        isPrimary: formData.isPrimary,
      });
      dispatch({ type: "resetForm" });
      dispatch({ type: "setCreateDialogOpen", open: false });
    } catch (err) {
      console.error("Error creating site:", err);
      dispatch({
        type: "setError",
        error: err instanceof Error ? err.message : "Failed to create site",
      });
    } finally {
      dispatch({ type: "setIsSubmitting", isSubmitting: false });
    }
  };

  const handleEditSite = (site: NonNullable<typeof sites>[0]) => {
    dispatch({
      type: "setEditingSite",
      site: {
        _id: site._id,
        name: site.name,
        description: site.description,
        address: site.address,
        isPrimary: site.isPrimary,
        isActive: site.isActive,
      },
    });
    dispatch({
      type: "setFormData",
      formData: {
        name: site.name,
        description: site.description || "",
        address: site.address || "",
        isPrimary: site.isPrimary,
      },
    });
    dispatch({ type: "setEditDialogOpen", open: true });
  };

  const handleUpdateSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSite) return;

    dispatch({ type: "setError", error: null });

    if (!formData.name.trim()) {
      dispatch({ type: "setError", error: "Site name is required" });
      return;
    }

    dispatch({ type: "setIsSubmitting", isSubmitting: true });
    try {
      await updateSite({
        siteId: editingSite._id,
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        address: formData.address.trim() || undefined,
        isPrimary: formData.isPrimary,
      });
      dispatch({ type: "setEditingSite", site: null });
      dispatch({ type: "resetForm" });
      dispatch({ type: "setEditDialogOpen", open: false });
    } catch (err) {
      console.error("Error updating site:", err);
      dispatch({
        type: "setError",
        error: err instanceof Error ? err.message : "Failed to update site",
      });
    } finally {
      dispatch({ type: "setIsSubmitting", isSubmitting: false });
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
            <Dialog
              open={createDialogOpen}
              onOpenChange={(open) =>
                dispatch({ type: "setCreateDialogOpen", open })
              }
            >
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
                          dispatch({
                            type: "patchFormData",
                            patch: { name: e.target.value },
                          })
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
                          dispatch({
                            type: "patchFormData",
                            patch: { description: e.target.value },
                          })
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
                          dispatch({
                            type: "patchFormData",
                            patch: { address: e.target.value },
                          })
                        }
                        rows={2}
                      />
                    </div>

                    <div className="flex items-center justify-between gap-x-2 rounded-lg border p-3">
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
                          dispatch({
                            type: "patchFormData",
                            patch: { isPrimary: checked },
                          })
                        }
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        dispatch({ type: "setCreateDialogOpen", open: false })
                      }
                      disabled={isSubmitting}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? "Creating…" : "Create Site"}
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
        <Dialog
          open={editDialogOpen}
          onOpenChange={(open) => dispatch({ type: "setEditDialogOpen", open })}
        >
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
                      dispatch({
                        type: "patchFormData",
                        patch: { name: e.target.value },
                      })
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
                      dispatch({
                        type: "patchFormData",
                        patch: { description: e.target.value },
                      })
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
                      dispatch({
                        type: "patchFormData",
                        patch: { address: e.target.value },
                      })
                    }
                    rows={2}
                  />
                </div>

                <div className="flex items-center justify-between gap-x-2 rounded-lg border p-3">
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
                      dispatch({
                        type: "patchFormData",
                        patch: { isPrimary: checked },
                      })
                    }
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    dispatch({ type: "setEditDialogOpen", open: false });
                    dispatch({ type: "setEditingSite", site: null });
                  }}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Updating…" : "Update Site"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </PermissionGate>
  );
}
