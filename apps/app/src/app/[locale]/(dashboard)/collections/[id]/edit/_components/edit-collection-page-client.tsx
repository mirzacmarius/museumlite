"use client";

import { useOrganization } from "@/components/organization-provider";
import { UnsavedChangesDialog } from "@/components/unsaved-changes-dialog";
import { useAutoSave } from "@/hooks/use-auto-save";
import { useBeforeUnload } from "@/hooks/use-before-unload";
import { useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { EditCollectionDeleteZone } from "./edit-collection-delete-zone";
import {
  type EditCollectionFormData,
  EditCollectionFormFields,
} from "./edit-collection-form-fields";

export function EditCollectionPageClient() {
  const t = useScopedI18n("collections");
  const common = useScopedI18n("common");
  const params = useParams();
  const { push } = useRouter();
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

  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(
    null,
  );
  const [formData, setFormData] = useState<EditCollectionFormData>({
    name: "",
    description: "",
    curatorId: "",
    managedByRoleId: "",
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
    async (data: EditCollectionFormData) => {
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
        push(href);
      }
    },
    [isDirty, push],
  );

  const handleDiscardAndNavigate = useCallback(() => {
    if (pendingNavigation) {
      push(pendingNavigation);
    }
    setShowUnsavedDialog(false);
    setPendingNavigation(null);
  }, [pendingNavigation, push]);

  const handleSaveAndNavigate = useCallback(async () => {
    await save();
    if (pendingNavigation) {
      push(pendingNavigation);
    }
    setShowUnsavedDialog(false);
    setPendingNavigation(null);
    return true;
  }, [pendingNavigation, push, save]);

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
      push("/collections");
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
            <EditCollectionFormFields
              groupId={groupId}
              formData={formData}
              setFormData={setFormData}
              members={members}
              roles={roles}
              status={status}
              lastSaved={lastSaved}
              isDirty={isDirty}
              error={error}
              onNavigate={handleNavigate}
              onSave={save}
            />
            <EditCollectionDeleteZone
              groupName={group.name}
              isDeleting={isDeleting}
              onDelete={handleDelete}
            />
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
