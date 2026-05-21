"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { useOrganization } from "@/components/organization-provider";
import { useScopedI18n } from "@/locales/client";

export interface RoleFormData {
  name: string;
  description: string;
  selectedPermissions: Id<"permissions">[];
}

export interface EditingRole {
  _id: Id<"roles">;
  name: string;
  description?: string;
  permissions: Id<"permissions">[];
}

const emptyFormData: RoleFormData = {
  name: "",
  description: "",
  selectedPermissions: [],
};

export function useRolesSettings() {
  const t = useScopedI18n("settings.roles");
  const { currentOrganizationId } = useOrganization();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<EditingRole | null>(null);
  const [formData, setFormData] = useState<RoleFormData>(emptyFormData);
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

  const groupedPermissions = useMemo(() => {
    if (!permissions) return undefined;

    return permissions.reduce(
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
  }, [permissions]);

  const resetForm = () => {
    setFormData(emptyFormData);
    setError(null);
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!currentOrganizationId) return;

    if (!formData.name.trim()) {
      setError(t("nameRequired"));
      return;
    }

    if (formData.selectedPermissions.length === 0) {
      setError(t("permissionsRequired"));
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
      resetForm();
      setCreateDialogOpen(false);
    } catch (err) {
      console.error("Error creating role:", err);
      setError(err instanceof Error ? err.message : t("createFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditRole = (role: {
    _id: Id<"roles">;
    name: string;
    description?: string;
    isSystemRole: boolean;
    permissions: Array<{ _id: Id<"permissions"> }>;
  }) => {
    if (role.isSystemRole) {
      alert(t("systemRoleError"));
      return;
    }
    setEditingRole({
      _id: role._id,
      name: role.name,
      description: role.description,
      permissions: role.permissions.map(
        (p: { _id: Id<"permissions"> }) => p._id,
      ),
    });
    setFormData({
      name: role.name,
      description: role.description || "",
      selectedPermissions: role.permissions.map(
        (p: { _id: Id<"permissions"> }) => p._id,
      ),
    });
    setEditDialogOpen(true);
  };

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRole) return;

    setError(null);

    if (!formData.name.trim()) {
      setError(t("nameRequired"));
      return;
    }

    if (formData.selectedPermissions.length === 0) {
      setError(t("permissionsRequired"));
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
      resetForm();
      setEditDialogOpen(false);
    } catch (err) {
      console.error("Error updating role:", err);
      setError(err instanceof Error ? err.message : t("updateFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRole = async (roleId: Id<"roles">) => {
    if (!confirm(t("deleteConfirm"))) {
      return;
    }

    try {
      await deleteRole({ roleId });
    } catch (err) {
      console.error("Error deleting role:", err);
      alert(err instanceof Error ? err.message : t("deleteFailed"));
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

  const closeCreateDialog = () => {
    setCreateDialogOpen(false);
    resetForm();
  };

  const closeEditDialog = () => {
    setEditDialogOpen(false);
    setEditingRole(null);
    resetForm();
  };

  return {
    t,
    currentOrganizationId,
    roles,
    groupedPermissions,
    createDialogOpen,
    setCreateDialogOpen,
    editDialogOpen,
    setEditDialogOpen,
    formData,
    setFormData,
    isSubmitting,
    error,
    handleCreateRole,
    handleEditRole,
    handleUpdateRole,
    handleDeleteRole,
    togglePermission,
    closeCreateDialog,
    closeEditDialog,
  };
}
