"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { EmptyState } from "@v1/ui/empty-state";
import { Edit, Shield, Trash2 } from "lucide-react";
import { PermissionGate } from "@/components/permission-gate";

interface RolePermission {
  _id: Id<"permissions">;
  name: string;
}

interface Role {
  _id: Id<"roles">;
  name: string;
  description: string | undefined;
  isSystemRole: boolean;
  permissions: RolePermission[];
}

interface RolesListProps {
  roles: Role[] | undefined;
  onEditRole: (role: {
    _id: Id<"roles">;
    name: string;
    description: string | undefined;
    isSystemRole: boolean;
    permissions: RolePermission[];
  }) => void;
  onDeleteRole: (roleId: Id<"roles">) => void;
  t: ReturnType<
    typeof import("@/locales/client").useScopedI18n<"settings.roles">
  >;
}

export function RolesList({
  roles,
  onEditRole,
  onDeleteRole,
  t,
}: RolesListProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {roles === undefined ? (
        <div className="col-span-2 flex h-64 items-center justify-center">
          <p className="text-muted-foreground">Loading roles…</p>
        </div>
      ) : roles.length === 0 ? (
        <div className="col-span-2">
          <EmptyState
            icon={Shield}
            title="No roles found"
            description="Create custom roles to manage team permissions"
            size="md"
          />
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
                      {t("systemBadge")}
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
                        +{role.permissions.length - 5} {t("morePermissions")}
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
                      onClick={() => onEditRole(role)}
                    >
                      <Edit className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteRole(role._id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </PermissionGate>
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
