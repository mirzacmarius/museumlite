"use client";

import { AutoSaveIndicator } from "@/components/auto-save-indicator";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { UnsavedChangesDialog } from "@/components/unsaved-changes-dialog";
import { useAutoSave } from "@/hooks/use-auto-save";
import { useBeforeUnload } from "@/hooks/use-before-unload";
import { useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@v1/ui/alert-dialog";
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
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

export default function EditCollectionPage() {
  const t = useScopedI18n("collections");
  const common = useScopedI18n("common");
  const params = useParams();
  const router = useRouter();
  const groupId = params.id as Id<"collectionGroups">;
  const { currentOrganizationId } = useOrganization();
  const updateGroup = useMutation(api.collectionGroups.update);
  const deleteGroup = useMutation(api.collectionGroups.deleteGroup);

  const group = useQuery(api.collectionGroups.get, { groupId });

  const members = useQuery(
    api.organizations.listOrganizationUsers,
    currentOrganizationId ? { organizationId: currentOrganizationId } : "skip",
  );

  const roles = useQuery(
    api.roles.listRoles,
    currentOrganizationId ? { organizationId: currentOrganizationId } : "skip",
  );
  type Role = NonNullable<typeof roles>[number];

  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(
    null,
  );
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    curatorId: "" as string | Id<"users">,
    managedByRoleId: "" as string | Id<"roles">,
  });
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (group && !isInitialized) {
      setFormData({
        name: group.name || "",
        description: group.description || "",
        curatorId: group.curatorId || "",
        managedByRoleId: group.managedByRoleId || "",
      });
      setIsInitialized(true);
    }
  }, [group, isInitialized]);

  const handleAutoSave = useCallback(
    async (data: typeof formData) => {
      if (!data.name.trim()) return;

      await updateGroup({
        groupId,
        name: data.name,
        description: data.description || undefined,
        curatorId: data.curatorId ? (data.curatorId as Id<"users">) : null,
        managedByRoleId: data.managedByRoleId
          ? (data.managedByRoleId as Id<"roles">)
          : null,
      });
    },
    [groupId, updateGroup],
  );

  const { status, lastSaved, isDirty, save } = useAutoSave({
    data: formData,
    onSave: handleAutoSave,
    enabled: isInitialized && !!formData.name.trim(),
    debounceMs: 2000,
    onError: (err) => setError(err.message),
  });

  useBeforeUnload(isDirty);

  const handleNavigate = useCallback(
    (href: string) => {
      if (isDirty) {
        setPendingNavigation(href);
        setShowUnsavedDialog(true);
      } else {
        router.push(href);
      }
    },
    [isDirty, router],
  );

  const handleDiscardAndNavigate = useCallback(() => {
    if (pendingNavigation) {
      router.push(pendingNavigation);
    }
    setShowUnsavedDialog(false);
    setPendingNavigation(null);
  }, [pendingNavigation, router]);

  const handleSaveAndNavigate = useCallback(async () => {
    await save();
    if (pendingNavigation) {
      router.push(pendingNavigation);
    }
    setShowUnsavedDialog(false);
    setPendingNavigation(null);
    return true;
  }, [pendingNavigation, router, save]);

  if (!currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">{t("selectOrganizationEdit")}</p>
      </div>
    );
  }

  if (group === undefined) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">{common("loading")}</p>
      </div>
    );
  }

  if (group === null) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">{t("notFound")}</p>
      </div>
    );
  }

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteGroup({ groupId });
      router.push("/collections");
    } catch (err) {
      console.error("Failed to delete collection:", err);
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex size-full bg-background px-6">
      <div className="z-10 mx-auto flex size-full max-w-screen-xl gap-12">
        <div className="flex w-full flex-col rounded-lg border border-border bg-card">
          <div className="flex w-full items-center justify-between rounded-lg border-b border-border p-6">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/collections/${groupId}`}>
                <ArrowLeft className="mr-2 size-4" />
                {t("backToCollection")}
              </Link>
            </Button>
          </div>

          <div className="p-6">
            {error && (
              <div className="mb-6 rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
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
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder={t("form.namePlaceholder")}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">
                  {t("form.descriptionLabel")}
                </Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
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
                    setFormData({
                      ...formData,
                      curatorId: value === "none" ? "" : value,
                    })
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
                <Label htmlFor="managedByRole">
                  {t("form.managedByRoleLabel")}
                </Label>
                <Select
                  value={formData.managedByRoleId}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      managedByRoleId: value === "none" ? "" : value,
                    })
                  }
                >
                  <SelectTrigger id="managedByRole">
                    <SelectValue
                      placeholder={t("form.managedByRolePlaceholder")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("form.anyRole")}</SelectItem>
                    {roles?.map((role: Role) => (
                      <SelectItem key={role._id} value={role._id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t("form.roleHint")}
                </p>
              </div>

              <div className="flex justify-end gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleNavigate(`/collections/${groupId}`)}
                >
                  {common("cancel")}
                </Button>
                <PermissionGate permission="collections.update">
                  <Button
                    type="button"
                    onClick={async () => {
                      await save();
                      router.push(`/collections/${groupId}`);
                    }}
                    disabled={status === "saving"}
                  >
                    <Save className="mr-2 size-4" />
                    {status === "saving"
                      ? t("form.updating")
                      : t("form.updateButton")}
                  </Button>
                </PermissionGate>
              </div>

              <div className="mt-12 border-t border-border pt-8">
                <h3 className="text-lg font-medium text-destructive mb-4">
                  {t("delete.dangerZone")}
                </h3>
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{t("delete.title")}</p>
                      <p className="text-sm text-muted-foreground">
                        {t("delete.description")}
                      </p>
                    </div>
                    <PermissionGate permission="collections.delete">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" disabled={isDeleting}>
                            <Trash2 className="mr-2 size-4" />
                            {common("delete")}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {t("delete.dialogTitle")}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{group.name}"?
                              Objects in this collection will be unlinked but
                              not deleted.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>
                              {common("cancel")}
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={handleDelete}
                              disabled={isDeleting}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {isDeleting
                                ? t("delete.deleting")
                                : t("delete.deleteButton")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </PermissionGate>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <UnsavedChangesDialog
            open={showUnsavedDialog}
            onOpenChange={setShowUnsavedDialog}
            onDiscard={handleDiscardAndNavigate}
            onSave={handleSaveAndNavigate}
            isSaving={status === "saving"}
          />
        </div>
      </div>
    </div>
  );
}
