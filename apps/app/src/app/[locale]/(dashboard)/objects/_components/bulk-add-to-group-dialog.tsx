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
import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { useMutation, useQuery } from "convex/react";
import { FolderPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useI18n, useScopedI18n } from "@/locales/client";

interface BulkAddToGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: Id<"collections">[];
  organizationId: Id<"organizations">;
  onSuccess: () => void;
}

export function BulkAddToGroupDialog({
  open,
  onOpenChange,
  selectedIds,
  organizationId,
  onSuccess,
}: BulkAddToGroupDialogProps) {
  const tRoot = useI18n();
  const t = useScopedI18n("common.toast");
  const placeholders = useScopedI18n("objects.form.placeholders");
  const common = useScopedI18n("common");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const collectionGroups = useQuery(
    api.collectionGroups.list,
    open ? { organizationId } : "skip",
  );
  const addItems = useMutation(api.collectionGroups.addItems);

  const handleSubmit = async () => {
    if (!selectedGroupId) {
      toast.error(t("selectCollectionGroup"));
      return;
    }

    setIsSubmitting(true);
    try {
      await addItems({
        groupId: selectedGroupId as Id<"collectionGroups">,
        collectionIds: selectedIds,
      });
      toast.success(t("itemsAddedToGroup", { count: selectedIds.length }));
      onSuccess();
      onOpenChange(false);
      setSelectedGroupId("");
    } catch {
      toast.error(t("itemsAddToGroupFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSelectedGroupId("");
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="size-5" />
            {tRoot("objects.bulkDialogs.addToGroup.title")}
          </DialogTitle>
          <DialogDescription>
            {tRoot("untranslatedRecords.objects.groups.addObjects", {
              count: selectedIds.length,
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="group">
              {tRoot("objects.bulkDialogs.addToGroup.label")}
            </Label>
            <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
              <SelectTrigger id="group">
                <SelectValue placeholder={placeholders("collectionGroup")} />
              </SelectTrigger>
              <SelectContent>
                {collectionGroups === undefined ? (
                  <SelectItem value="loading" disabled>
                    {common("loading")}
                  </SelectItem>
                ) : collectionGroups.length === 0 ? (
                  <SelectItem value="none" disabled>
                    {tRoot("untranslatedRecords.objects.groups.noneAvailable")}
                  </SelectItem>
                ) : (
                  collectionGroups.map((group) => (
                    <SelectItem key={group._id} value={group._id}>
                      {group.name}
                      {group.itemsCount !== undefined && (
                        <span className="ml-2 text-muted-foreground">
                          {tRoot(
                            "untranslatedRecords.objects.groups.itemsCount",
                            {
                              count: group.itemsCount,
                            },
                          )}
                        </span>
                      )}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {tRoot("objects.form.actions.cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedGroupId || isSubmitting}
          >
            {isSubmitting ? common("adding") : common("addToGroup")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
