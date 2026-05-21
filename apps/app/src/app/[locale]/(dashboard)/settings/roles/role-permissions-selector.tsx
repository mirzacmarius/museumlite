"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Checkbox } from "@v1/ui/checkbox";
import { Label } from "@v1/ui/label";

interface Permission {
  _id: Id<"permissions">;
  name: string;
  description?: string;
}

interface RolePermissionsSelectorProps {
  idPrefix: string;
  groupedPermissions: Record<string, Permission[]> | undefined;
  selectedPermissions: Id<"permissions">[];
  onTogglePermission: (permissionId: Id<"permissions">) => void;
  label: string;
}

export function RolePermissionsSelector({
  idPrefix,
  groupedPermissions,
  selectedPermissions,
  onTogglePermission,
  label,
}: RolePermissionsSelectorProps) {
  return (
    <div className="space-y-3">
      <Label>{label}</Label>
      <div className="space-y-4 rounded-lg border border-border p-4">
        {groupedPermissions &&
          Object.entries(groupedPermissions).map(([category, perms]) => (
            <div key={category} className="space-y-2">
              <h4 className="text-sm font-medium capitalize">{category}</h4>
              <div className="space-y-2 pl-4">
                {perms.map((perm) => (
                  <div key={perm._id} className="flex items-center gap-x-2">
                    <Checkbox
                      id={`${idPrefix}-${perm._id}`}
                      checked={selectedPermissions.includes(perm._id)}
                      onCheckedChange={() => onTogglePermission(perm._id)}
                    />
                    <Label
                      htmlFor={`${idPrefix}-${perm._id}`}
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
          ))}
      </div>
    </div>
  );
}
