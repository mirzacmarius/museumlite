"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { Textarea } from "@v1/ui/textarea";
import { Save } from "lucide-react";
import { AutoSaveIndicator } from "@/components/auto-save-indicator";
import { PermissionGate } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";

export interface EditCollectionFormData {
  name: string;
  description: string;
  curatorId: string | Id<"users">;
  managedByRoleId: string | Id<"roles">;
}

interface OrganizationMember {
  _id: Id<"users">;
  name?: string;
  email?: string;
}

interface Role {
  _id: Id<"roles">;
  name: string;
}

interface EditCollectionFormFieldsProps {
  groupId: Id<"collectionGroups">;
  formData: EditCollectionFormData;
  setFormData: React.Dispatch<React.SetStateAction<EditCollectionFormData>>;
  members: OrganizationMember[] | undefined;
  roles: Role[] | undefined;
  status: "idle" | "saving" | "saved" | "error";
  lastSaved: Date | null;
  isDirty: boolean;
  error: string | null;
  onNavigate: (href: string) => void;
  onSave: () => Promise<void>;
}

export function EditCollectionFormFields({
  groupId,
  formData,
  setFormData,
  members,
  roles,
  status,
  lastSaved,
  isDirty,
  error,
  onNavigate,
  onSave,
}: EditCollectionFormFieldsProps) {
  const t = useScopedI18n("collections");
  const common = useScopedI18n("common");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-end">
        <AutoSaveIndicator
          status={status}
          lastSaved={lastSaved}
          isDirty={isDirty}
          error={error}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="name">
          {t("form.nameLabel")}{" "}
          <span className="text-red-500">{t("form.nameRequired")}</span>
        </Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, name: e.target.value }))
          }
          placeholder={t("form.namePlaceholder")}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">{t("form.descriptionLabel")}</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              description: e.target.value,
            }))
          }
          placeholder={t("form.descriptionPlaceholder")}
          rows={4}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="curator">{t("form.curatorLabel")}</Label>
        <Select
          value={formData.curatorId}
          onValueChange={(value) =>
            setFormData((prev) => ({
              ...prev,
              curatorId: value === "none" ? "" : value,
            }))
          }
        >
          <SelectTrigger id="curator">
            <SelectValue placeholder={t("form.curatorPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t("form.noCurator")}</SelectItem>
            {members?.map((member) => (
              <SelectItem key={member._id} value={member._id}>
                {member.name || member.email || t("form.unknown")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="managedByRole">{t("form.managedByRoleLabel")}</Label>
        <Select
          value={formData.managedByRoleId}
          onValueChange={(value) =>
            setFormData((prev) => ({
              ...prev,
              managedByRoleId: value === "none" ? "" : value,
            }))
          }
        >
          <SelectTrigger id="managedByRole">
            <SelectValue placeholder={t("form.managedByRolePlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t("form.anyRole")}</SelectItem>
            {roles?.map((role) => (
              <SelectItem key={role._id} value={role._id}>
                {role.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{t("form.roleHint")}</p>
      </div>

      <div className="flex justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => onNavigate(`/collections/${groupId}`)}
        >
          {common("cancel")}
        </Button>
        <PermissionGate permission="collections.update">
          <Button
            type="button"
            onClick={async () => {
              await onSave();
              onNavigate(`/collections/${groupId}`);
            }}
            disabled={status === "saving"}
          >
            <Save className="mr-2 size-4" />
            {status === "saving" ? t("form.updating") : t("form.updateButton")}
          </Button>
        </PermissionGate>
      </div>
    </div>
  );
}
