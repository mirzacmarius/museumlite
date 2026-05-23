"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { useMutation, useQuery } from "convex/react";
import { FolderPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CollectionMultiSelectCombobox } from "@/components/collection-multi-select-combobox";
import { useScopedI18n } from "@/locales/client";

interface AddObjectsToCollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: Id<"collectionGroups">;
  groupName: string;
  organizationId: Id<"organizations">;
  onSuccess: () => void;
}

export function AddObjectsToCollectionDialog({
  open,
  onOpenChange,
  groupId,
  groupName,
  organizationId,
  onSuccess,
}: AddObjectsToCollectionDialogProps) {
  const t = useScopedI18n("objects.collectionGroup");
  const toastT = useScopedI18n("common.toast");
  const common = useScopedI18n("common");
  const [selectedIds, setSelectedIds] = useState<Array<string>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const groupItems = useQuery(
    api.collectionGroups.listItems,
    open ? { groupId } : "skip",
  );
  const addItems = useMutation(api.collectionGroups.addItems);
  const removeItems = useMutation(api.collectionGroups.removeItems);

  useEffect(() => {
    if (!open || !groupItems) {
      return;
    }
    setSelectedIds(groupItems.map((item) => item.collectionId));
  }, [open, groupItems]);

  const initialMemberIds = groupItems?.map((item) => item.collectionId) ?? [];

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSelectedIds([]);
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = async () => {
    const selectedCollectionIds = selectedIds as Array<Id<"collections">>;
    const toAdd = selectedCollectionIds.filter(
      (id) => !initialMemberIds.includes(id),
    );
    const toRemove = initialMemberIds.filter(
      (id) => !selectedCollectionIds.includes(id),
    );

    if (toAdd.length === 0 && toRemove.length === 0) {
      handleOpenChange(false);
      return;
    }

    setIsSubmitting(true);
    try {
      if (toAdd.length > 0) {
        await addItems({ groupId, collectionIds: toAdd });
      }
      if (toRemove.length > 0) {
        await removeItems({ groupId, collectionIds: toRemove });
      }

      const changedCount = toAdd.length + toRemove.length;
      toast.success(
        toastT("itemsAddedToGroup", { count: changedCount }),
      );
      onSuccess();
      handleOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : toastT("itemsAddToGroupFailed"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="size-5" />
            {t("addObjectsTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("addObjectsDescription", { name: groupName })}
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <CollectionMultiSelectCombobox
            organizationId={organizationId}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            placeholder={t("searchAndSelectObjects")}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {t("multiCollectionHint")}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {common("cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? common("adding") : t("saveMembership")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
