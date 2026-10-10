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
import { type RefObject, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { useCapabilityErrorMessage } from "@/hooks/use-capability-error-message";
import { useCustodyConflictMessage } from "@/hooks/use-custody-conflict-message";
import { useI18n, useScopedI18n } from "@/locales/client";

interface BulkMoveLocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: Id<"collections">[];
  organizationId: Id<"organizations">;
  onSuccess: () => void;
  /** Takes focus on close when the selection bar that opened it is gone. */
  returnFocusRef: RefObject<HTMLElement | null>;
}

export function BulkMoveLocationDialog({
  open,
  onOpenChange,
  selectedIds,
  organizationId,
  onSuccess,
  returnFocusRef,
}: BulkMoveLocationDialogProps) {
  const tRoot = useI18n();
  const t = useScopedI18n("common.toast");
  const tDialog = useScopedI18n("objects.bulkDialogs.moveLocation");
  const tCommon = useScopedI18n("common");
  const _placeholders = useScopedI18n("objects.form.placeholders");
  const [locationId, setLocationId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const capabilityMessage = useCapabilityErrorMessage();
  const custodyConflictMessage = useCustodyConflictMessage();
  // A refused move is explained in the dialog, where staff can change the
  // location or cancel; each refusal takes focus, even a repeated one.
  const [refusal, setRefusal] = useState<{ message: string } | null>(null);
  const refusalRef = useRef<HTMLParagraphElement>(null);
  const refusalId = useId();
  useEffect(() => {
    if (refusal) refusalRef.current?.focus();
  }, [refusal]);
  const handleOpenChange = (next: boolean) => {
    if (!next) setRefusal(null);
    onOpenChange(next);
  };

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
    setRefusal(null);
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
          tRoot("untranslatedRecords.objects.bulk.failedMove", {
            count: result.failed,
          }),
        );
      }

      onSuccess();
      handleOpenChange(false);
      setLocationId("");
    } catch (error) {
      setRefusal({
        message:
          capabilityMessage(error) ??
          custodyConflictMessage(error, tDialog("failed")),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent fallbackFocusRef={returnFocusRef}>
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
              <SelectTrigger
                id="location"
                aria-describedby={refusal ? refusalId : undefined}
              >
                <SelectValue placeholder={tDialog("placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {locations?.map((location) => (
                  <SelectItem
                    key={location._id}
                    value={location._id}
                    disabled={location.status !== "active"}
                  >
                    {location.path.map((p) => p.name).join(" > ")}
                    {location.status !== "active"
                      ? ` (${location.status})`
                      : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {refusal ? (
              <p
                ref={refusalRef}
                id={refusalId}
                role="alert"
                tabIndex={-1}
                className="text-sm text-destructive outline-none"
              >
                {refusal.message}
              </p>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
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
