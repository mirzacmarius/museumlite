"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Checkbox } from "@v1/ui/checkbox";
import { Label } from "@v1/ui/label";
import { Shield } from "lucide-react";
import type { useScopedI18n } from "@/locales/client";
import type { EditAccountFormData } from "./edit-account-form-types";

interface Role {
  _id: Id<"roles">;
  name: string;
  description?: string;
}

interface EditAccountPermissionsFieldsProps {
  t: ReturnType<typeof useScopedI18n<"accounts">>;
  formData: EditAccountFormData;
  toggleRole: (roleId: Id<"roles">) => void;
  rolesWithLoansPermissions: Role[] | undefined;
  groupedPermissionEntries: Array<
    [string, Array<{ _id: string; name: string; description?: string }>]
  >;
}

export function EditAccountPermissionsFields({
  t,
  formData,
  toggleRole,
  rolesWithLoansPermissions,
  groupedPermissionEntries,
}: EditAccountPermissionsFieldsProps) {
  return (
    <>
      {/* Permissions */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Shield className="size-4" />
          {t("form.rolesWithAccess")}
        </h3>
        <div className="space-y-4 rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground">
            {t("form.rolesDescription")}
          </p>
          {rolesWithLoansPermissions && rolesWithLoansPermissions.length > 0 ? (
            <div className="space-y-3">
              {rolesWithLoansPermissions.map((role) => (
                <div key={role._id} className="flex items-center gap-x-2">
                  <Checkbox
                    id={`role-${role._id}`}
                    checked={formData.selectedRoles.includes(role._id)}
                    onCheckedChange={() => toggleRole(role._id)}
                  />
                  <Label
                    htmlFor={`role-${role._id}`}
                    className="text-sm font-normal cursor-pointer flex-1"
                  >
                    {role.name}
                    {role.description && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        - {role.description}
                      </span>
                    )}
                  </Label>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No roles found. Roles with loans permissions will appear here.
            </p>
          )}
        </div>
      </div>

      {/* Permissions Details */}
      {groupedPermissionEntries.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Shield className="size-4" />
            Available Permissions
          </h3>
          <div className="space-y-4 rounded-lg border border-border p-4">
            {groupedPermissionEntries.map(([category, perms]) => (
              <div key={category} className="space-y-2">
                <h4 className="text-sm font-medium capitalize">{category}</h4>
                <div className="space-y-1 pl-4">
                  {perms.map((perm) => (
                    <div
                      key={perm._id}
                      className="text-xs text-muted-foreground"
                    >
                      • {perm.name}
                      {perm.description && (
                        <span className="ml-2">- {perm.description}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
