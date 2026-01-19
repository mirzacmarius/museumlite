"use client";

import { useScopedI18n } from "@/locales/client";
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
import { Textarea } from "@v1/ui/textarea";
import { useMutation } from "convex/react";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface BulkDeaccessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: Id<"collections">[];
  onSuccess: () => void;
}

export function BulkDeaccessionDialog({
  open,
  onOpenChange,
  selectedIds,
  onSuccess,
}: BulkDeaccessionDialogProps) {
  const t = useScopedI18n("common.toast");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const bulkDeaccession = useMutation(api.collections.bulkDeaccession);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast.error(t("selectDeaccessionReason"));
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await bulkDeaccession({
        collectionIds: selectedIds,
        reason: reason.trim(),
      });

      const messages = [];
      if (result.deaccessioned > 0) {
        messages.push(t("itemsDeaccessioned", { count: result.deaccessioned }));
      }
      if (result.skipped > 0) {
        messages.push(t("someItemsSkipped", { count: result.skipped }));
      }
      if (result.failed > 0) {
        messages.push(`${result.failed} failed (may be on loan)`);
      }

      if (result.deaccessioned > 0) {
        toast.success(messages.join(", "));
      } else {
        toast.warning(messages.join(", "));
      }

      onSuccess();
      onOpenChange(false);
      setReason("");
    } catch (error) {
      toast.error(t("itemsDeaccessionFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Bulk Deaccession
          </DialogTitle>
          <DialogDescription>
            You are about to deaccession {selectedIds.length} item
            {selectedIds.length !== 1 ? "s" : ""}. This action will remove them
            from your active collection.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
            Items currently on loan cannot be deaccessioned and will be skipped.
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Deaccessioning</Label>
            <Textarea
              id="reason"
              placeholder="Enter the reason for deaccessioning these items..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={isSubmitting || !reason.trim()}
          >
            {isSubmitting ? "Processing..." : "Deaccession Items"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
