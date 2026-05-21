"use client";

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
import { BookOpen, Loader2, User } from "lucide-react";
import type { SelectedCopy, SelectedPatron } from "./circulation-types";

interface CirculationCheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tCirc: (key: string) => string;
  tLib: (key: string) => string;
  selectedPatron: SelectedPatron | null;
  selectedCopy: SelectedCopy | null;
  isProcessing: boolean;
  onCheckout: (accountId: Id<"accounts">, copyId: Id<"itemCopies">) => void;
  onClose: () => void;
}

export function CirculationCheckoutDialog({
  open,
  onOpenChange,
  tCirc,
  tLib,
  selectedPatron,
  selectedCopy,
  isProcessing,
  onCheckout,
  onClose,
}: CirculationCheckoutDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tCirc("dialogs.checkoutTitle")}</DialogTitle>
          <DialogDescription>
            {tCirc("dialogs.checkoutDescription")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {selectedPatron && (
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-3">
                <User className="size-8 text-muted-foreground" />
                <div>
                  <p className="font-medium">
                    {selectedPatron.firstName} {selectedPatron.lastName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedPatron.cardNumber}
                  </p>
                </div>
              </div>
            </div>
          )}
          {selectedCopy?.copy && (
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-3">
                <BookOpen className="size-8 text-muted-foreground" />
                <div>
                  <p className="font-medium">
                    {selectedCopy.item?.title || tLib("unknownItem")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedCopy.copy.barcode}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {tLib("cancel")}
          </Button>
          <Button
            onClick={() => {
              if (selectedPatron && selectedCopy?.copy) {
                onCheckout(selectedPatron._id, selectedCopy.copy._id);
              }
            }}
            disabled={isProcessing || !selectedPatron || !selectedCopy?.copy}
          >
            {isProcessing && <Loader2 className="mr-2 size-4 animate-spin" />}
            {tCirc("actions.confirmCheckout")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
