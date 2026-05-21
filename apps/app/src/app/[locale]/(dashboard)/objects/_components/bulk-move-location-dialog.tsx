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
import { useState } from "react";
import { toast } from "sonner";
import { useScopedI18n } from "@/locales/client";

interface BulkMoveLocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: Id<"collections">[];
  organizationId: Id<"organizations">;
  onSuccess: () => void;
}

export function BulkMoveLocationDialog({
  open,
  onOpenChange,
  selectedIds,
  organizationId,
  onSuccess,
}: BulkMoveLocationDialogProps) {
  const t = useScopedI18n("common.toast");
  const tDialog = useScopedI18n("objects.bulkDialogs.moveLocation");
  const tCommon = useScopedI18n("common");
  const _placeholders = useScopedI18n("objects.form.placeholders");
  const [locationId, setLocationId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const locations = useQuery(api.locations.listAllWithPaths, {
    organizationId,
  });

  const bulkUpdateLocation = useMutation(api.collections.bulkUpdateLocation);

  const handleSubmit = async () => {
    if (!locationId) {
      toast.error(t("selectLocation"));
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await bulkUpdateLocation({
        collectionIds: selectedIds,
        locationId: locationId as Id<"locations">,
      });

      if (result.updated > 0) {
        toast.success(t("itemsMoved", { count: result.updated }));
      }
      if (result.failed > 0) {
        toast.error(
          `Failed to move ${result.failed} item${result.failed !== 1 ? "s" : ""}`,
        );
      }

      onSuccess();
      onOpenChange(false);
      setLocationId("");
    } catch (_error) {
      toast.error(t("itemsMoveFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tDialog("title")}</DialogTitle>
          <DialogDescription>
            {tDialog("description", {
              count: selectedIds.length,
              s: selectedIds.length !== 1 ? "s" : "",
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="location">{tDialog("label")}</Label>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger id="location">
                <SelectValue placeholder={tDialog("placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {locations?.map((location) => (
                  <SelectItem key={location._id} value={location._id}>
                    {location.path.map((p) => p.name).join(" > ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            {tCommon("cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !locationId}>
            {isSubmitting ? tDialog("moving") : tDialog("moveItems")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
