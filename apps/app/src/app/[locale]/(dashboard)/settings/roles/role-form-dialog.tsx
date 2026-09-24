"use client";

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
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import { RolePermissionsSelector } from "./role-permissions-selector";
import type { RoleFormData } from "./use-roles-settings";

interface Permission {
  _id: Id<"permissions">;
  name: string;
  description?: string;
}

interface RoleFormDialogProps {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: RoleFormData;
  setFormData: React.Dispatch<React.SetStateAction<RoleFormData>>;
  groupedPermissions: Record<string, Permission[]> | undefined;
  error: string | null;
  isSubmitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  onTogglePermission: (permissionId: Id<"permissions">) => void;
  t: ReturnType<
    typeof import("@/locales/client").useScopedI18n<"settings.roles">
  >;
  trigger?: React.ReactNode;
}

export function RoleFormDialog({
  mode,
  open,
  onOpenChange,
  formData,
  setFormData,
  groupedPermissions,
  error,
  isSubmitting,
  onSubmit,
  onCancel,
  onTogglePermission,
  t,
  trigger,
}: RoleFormDialogProps) {
  const isCreate = mode === "create";
  const idPrefix = isCreate ? "perm" : "edit-perm";
  const nameInputId = isCreate ? "role-name" : "edit-role-name";
  const descriptionInputId = isCreate
    ? "role-description"
    : "edit-role-description";

  const dialog = (
    <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
      <form onSubmit={onSubmit}>
        <DialogHeader>
          <DialogTitle>
            {isCreate ? t("createNewRole") : t("editRole")}
          </DialogTitle>
          <DialogDescription>
            {isCreate ? t("createDescription") : t("editDescription")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {error && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor={nameInputId}>{t("roleNameLabel")}</Label>
            <Input
              id={nameInputId}
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder={isCreate ? t("roleNamePlaceholder") : undefined}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={descriptionInputId}>{t("descriptionLabel")}</Label>
            <Textarea
              id={descriptionInputId}
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              placeholder={isCreate ? t("descriptionPlaceholder") : undefined}
              rows={3}
            />
          </div>
          <RolePermissionsSelector
            idPrefix={idPrefix}
            groupedPermissions={groupedPermissions}
            selectedPermissions={formData.selectedPermissions}
            onTogglePermission={onTogglePermission}
            label={t("permissionsLabel")}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            {t("cancel")}
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? t("updating")
              : isCreate
                ? t("createButton")
                : t("updateButton")}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );

  if (isCreate) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
        {dialog}
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {dialog}
    </Dialog>
  );
}
