"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { Textarea } from "@v1/ui/textarea";
import { Label } from "@v1/ui/label";
import { Checkbox } from "@v1/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@v1/ui/dialog";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { useMutation, useQuery } from "convex/react";
import { Plus, Trash2, Edit } from "lucide-react";
import { useState } from "react";

export default function RolesSettingsPage() {
  const { currentOrganizationId } = useOrganization();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<{
    _id: Id<"roles">;
    name: string;
    description?: string;
    permissions: Id<"permissions">[];
  } | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    selectedPermissions: [] as Id<"permissions">[],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roles = useQuery(
    api.roles.listRoles,
    currentOrganizationId
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );

  const permissions = useQuery(api.roles.listPermissions, {});

  const createRole = useMutation(api.roles.createRole);
  const updateRole = useMutation(api.roles.updateRole);
  const deleteRole = useMutation(api.roles.deleteRole);

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">
          Please select an organization to manage roles.
        </p>
      </div>
    );
  }

  const groupedPermissions = permissions?.reduce(
    (acc, perm) => {
      const category = perm.category;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category]!.push(perm);
      return acc;
    },
    {} as Record<string, Array<(typeof permissions)[0]>>,
  );

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError("Role name is required");
      return;
    }

    if (formData.selectedPermissions.length === 0) {
      setError("At least one permission must be selected");
      return;
    }

    setIsSubmitting(true);
    try {
      await createRole({
        organizationId: currentOrganizationId as Id<"organizations">,
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        permissionIds: formData.selectedPermissions,
      });
      setFormData({
        name: "",
        description: "",
        selectedPermissions: [],
      });
      setCreateDialogOpen(false);
    } catch (err) {
      console.error("Error creating role:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to create role. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditRole = (role: NonNullable<typeof roles>[0]) => {
    if (role.isSystemRole) {
      alert("System roles cannot be edited");
      return;
    }
    setEditingRole({
      _id: role._id,
      name: role.name,
      description: role.description,
      permissions: role.permissions.map((p: { _id: Id<"permissions"> }) => p._id),
    });
    setFormData({
      name: role.name,
      description: role.description || "",
      selectedPermissions: role.permissions.map((p: { _id: Id<"permissions"> }) => p._id),
    });
    setEditDialogOpen(true);
  };

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRole) return;

    setError(null);

    if (!formData.name.trim()) {
      setError("Role name is required");
      return;
    }

    if (formData.selectedPermissions.length === 0) {
      setError("At least one permission must be selected");
      return;
    }

    setIsSubmitting(true);
    try {
      await updateRole({
        roleId: editingRole._id,
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        permissionIds: formData.selectedPermissions,
      });
      setEditingRole(null);
      setFormData({
        name: "",
        description: "",
        selectedPermissions: [],
      });
      setEditDialogOpen(false);
    } catch (err) {
      console.error("Error updating role:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update role. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRole = async (roleId: Id<"roles">) => {
    if (
      !confirm(
        "Are you sure you want to delete this role? Users with this role will need to be reassigned.",
      )
    ) {
      return;
    }

    try {
      await deleteRole({ roleId });
    } catch (err) {
      console.error("Error deleting role:", err);
      alert(
        err instanceof Error
          ? err.message
          : "Failed to delete role. Please try again.",
      );
    }
  };

  const togglePermission = (permissionId: Id<"permissions">) => {
    setFormData((prev) => ({
      ...prev,
      selectedPermissions: prev.selectedPermissions.includes(permissionId)
        ? prev.selectedPermissions.filter((id) => id !== permissionId)
        : [...prev.selectedPermissions, permissionId],
    }));
  };

  return (
    <div className="flex w-full flex-col gap-6">
        <div className="flex w-full flex-col gap-2">
          <h2 className="text-xl font-medium text-primary">Role Management</h2>
          <p className="text-sm text-muted-foreground">
            Create and manage custom roles with specific permissions
          </p>
        </div>
        <div className="flex w-full items-center justify-between">
          <div>
            <h3 className="text-lg font-medium">Roles</h3>
            <p className="text-sm text-muted-foreground">
              {roles?.length || 0} role{roles?.length !== 1 ? "s" : ""} defined
            </p>
          </div>
          <PermissionGate permission="users.manage_roles">
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Role
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
                <form onSubmit={handleCreateRole}>
                  <DialogHeader>
                    <DialogTitle>Create New Role</DialogTitle>
                    <DialogDescription>
                      Create a custom role with specific permissions for your
                      organization.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    {error && (
                      <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                        {error}
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="role-name">Role Name *</Label>
                      <Input
                        id="role-name"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        placeholder="e.g., Assistant Curator"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role-description">Description</Label>
                      <Textarea
                        id="role-description"
                        value={formData.description}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            description: e.target.value,
                          })
                        }
                        placeholder="Describe what this role can do..."
                        rows={3}
                      />
                    </div>
                    <div className="space-y-3">
                      <Label>Permissions *</Label>
                      <div className="space-y-4 rounded-lg border border-border p-4">
                        {groupedPermissions &&
                          Object.entries(groupedPermissions).map(
                            ([category, perms]) => (
                              <div key={category} className="space-y-2">
                                <h4 className="text-sm font-medium capitalize">
                                  {category}
                                </h4>
                                <div className="space-y-2 pl-4">
                                  {perms.map((perm) => (
                                    <div
                                      key={perm._id}
                                      className="flex items-center space-x-2"
                                    >
                                      <Checkbox
                                        id={`perm-${perm._id}`}
                                        checked={formData.selectedPermissions.includes(
                                          perm._id,
                                        )}
                                        onCheckedChange={() =>
                                          togglePermission(perm._id)
                                        }
                                      />
                                      <Label
                                        htmlFor={`perm-${perm._id}`}
                                        className="text-sm font-normal cursor-pointer"
                                      >
                                        {perm.name}
                                        {perm.description && (
                                          <span className="ml-2 text-xs text-muted-foreground">
                                            - {perm.description}
                                          </span>
                                        )}
                                      </Label>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ),
                          )}
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setCreateDialogOpen(false);
                        setFormData({
                          name: "",
                          description: "",
                          selectedPermissions: [],
                        });
                        setError(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? "Creating..." : "Create Role"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </PermissionGate>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {roles === undefined ? (
            <div className="col-span-2 flex h-64 items-center justify-center">
              <p className="text-muted-foreground">Loading roles...</p>
            </div>
          ) : roles.length === 0 ? (
            <div className="col-span-2 flex h-64 items-center justify-center">
              <p className="text-muted-foreground">No roles found</p>
            </div>
          ) : (
            roles.map((role) => (
              <div
                key={role._id}
                className="rounded-lg border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{role.name}</h3>
                      {role.isSystemRole && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                          System
                        </span>
                      )}
                    </div>
                    {role.description && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {role.description}
                      </p>
                    )}
                    <div className="mt-3">
                      <p className="text-xs font-medium text-muted-foreground">
                        Permissions ({role.permissions.length})
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {role.permissions.slice(0, 5).map((perm) => (
                          <span
                            key={perm._id}
                            className="rounded bg-secondary px-2 py-0.5 text-xs"
                          >
                            {perm.name}
                          </span>
                        ))}
                        {role.permissions.length > 5 && (
                          <span className="rounded bg-secondary px-2 py-0.5 text-xs">
                            +{role.permissions.length - 5} more
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {!role.isSystemRole && (
                    <div className="flex gap-2">
                      <PermissionGate permission="users.manage_roles">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditRole(role)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteRole(role._id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </PermissionGate>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
            <form onSubmit={handleUpdateRole}>
              <DialogHeader>
                <DialogTitle>Edit Role</DialogTitle>
                <DialogDescription>
                  Update role details and permissions.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {error && (
                  <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="edit-role-name">Role Name *</Label>
                  <Input
                    id="edit-role-name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-role-description">Description</Label>
                  <Textarea
                    id="edit-role-description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        description: e.target.value,
                      })
                    }
                    rows={3}
                  />
                </div>
                <div className="space-y-3">
                  <Label>Permissions *</Label>
                  <div className="space-y-4 rounded-lg border border-border p-4">
                    {groupedPermissions &&
                      Object.entries(groupedPermissions).map(
                        ([category, perms]) => (
                          <div key={category} className="space-y-2">
                            <h4 className="text-sm font-medium capitalize">
                              {category}
                            </h4>
                            <div className="space-y-2 pl-4">
                              {perms.map((perm) => (
                                <div
                                  key={perm._id}
                                  className="flex items-center space-x-2"
                                >
                                  <Checkbox
                                    id={`edit-perm-${perm._id}`}
                                    checked={formData.selectedPermissions.includes(
                                      perm._id,
                                    )}
                                    onCheckedChange={() =>
                                      togglePermission(perm._id)
                                    }
                                  />
                                  <Label
                                    htmlFor={`edit-perm-${perm._id}`}
                                    className="text-sm font-normal cursor-pointer"
                                  >
                                    {perm.name}
                                    {perm.description && (
                                      <span className="ml-2 text-xs text-muted-foreground">
                                        - {perm.description}
                                      </span>
                                    )}
                                  </Label>
                                </div>
                              ))}
                            </div>
                          </div>
                        ),
                      )}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditDialogOpen(false);
                    setEditingRole(null);
                    setFormData({
                      name: "",
                      description: "",
                      selectedPermissions: [],
                    });
                    setError(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Updating..." : "Update Role"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
  );
}

