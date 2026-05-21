"use client";

import { PermissionGate } from "@/components/permission-gate";
import { CreateRoleButton, RoleFormDialog } from "./role-form-dialog";
import { RolesList } from "./roles-list";
import { useRolesSettings } from "./use-roles-settings";

export default function RolesSettingsPage() {
  const {
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
  } = useRolesSettings();

  if (!currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">
          Please select an organization to manage roles.
        </p>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex w-full flex-col gap-2">
        <h2 className="text-xl font-medium text-foreground">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>
      <div className="flex w-full items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">{t("rolesLabel")}</h3>
          <p className="text-sm text-muted-foreground">
            {roles?.length || 0} role{roles?.length !== 1 ? "s" : ""} defined
          </p>
        </div>
        <PermissionGate permission="users.manage_roles">
          <RoleFormDialog
            mode="create"
            open={createDialogOpen}
            onOpenChange={setCreateDialogOpen}
            formData={formData}
            setFormData={setFormData}
            groupedPermissions={groupedPermissions}
            error={error}
            isSubmitting={isSubmitting}
            onSubmit={handleCreateRole}
            onCancel={closeCreateDialog}
            onTogglePermission={togglePermission}
            t={t}
            trigger={<CreateRoleButton label={t("createButton")} />}
          />
        </PermissionGate>
      </div>

      <RolesList
        roles={roles}
        onEditRole={handleEditRole}
        onDeleteRole={handleDeleteRole}
        t={t}
      />

      <RoleFormDialog
        mode="edit"
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        formData={formData}
        setFormData={setFormData}
        groupedPermissions={groupedPermissions}
        error={error}
        isSubmitting={isSubmitting}
        onSubmit={handleUpdateRole}
        onCancel={closeEditDialog}
        onTogglePermission={togglePermission}
        t={t}
      />
    </div>
  );
}
