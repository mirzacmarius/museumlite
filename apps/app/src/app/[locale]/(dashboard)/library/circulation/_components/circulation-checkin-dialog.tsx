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
import { CheckCircle, Loader2 } from "lucide-react";
import type { CheckinResult, SelectedCopy } from "./circulation-types";

interface CirculationCheckinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tCirc: (key: string) => string;
  tLib: (key: string) => string;
  selectedCopy: SelectedCopy | null;
  checkinResult: CheckinResult | null;
  isProcessing: boolean;
  formatDate: (timestamp: number) => string;
  onCheckin: (circulationId: Id<"circulations">) => void;
  onDone: () => void;
  onCancel: () => void;
}

export function CirculationCheckinDialog({
  open,
  onOpenChange,
  tCirc,
  tLib,
  selectedCopy,
  checkinResult,
  isProcessing,
  formatDate,
  onCheckin,
  onDone,
  onCancel,
}: CirculationCheckinDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tCirc("dialogs.checkinTitle")}</DialogTitle>
          <DialogDescription>
            {checkinResult
              ? tCirc("dialogs.checkinSuccess")
              : tCirc("dialogs.checkinDescription")}
          </DialogDescription>
        </DialogHeader>
        {checkinResult ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-2 py-4">
              <CheckCircle className="size-12 text-green-500" />
            </div>
            <p className="text-center">{tCirc("dialogs.returnSuccess")}</p>
            {checkinResult.fineCreated && (
              <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
                <p className="text-center text-destructive">
                  {tCirc("dialogs.fineCreated")} $
                  {checkinResult.fineAmount?.toFixed(2)}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {selectedCopy?.circulation && (
              <>
                <div className="rounded-lg border border-border p-4">
                  <p className="font-medium">
                    {selectedCopy.circulation.item?.title}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {tCirc("labels.barcode")} {selectedCopy.copy.barcode}
                  </p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <p className="text-sm text-muted-foreground">
                    {tCirc("dialogs.checkedOutTo")}
                  </p>
                  <p className="font-medium">
                    {selectedCopy.circulation.account?.firstName}{" "}
                    {selectedCopy.circulation.account?.lastName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {tCirc("labels.due")}{" "}
                    {formatDate(selectedCopy.circulation.dueDate)}
                  </p>
                </div>
              </>
            )}
          </div>
        )}
        <DialogFooter>
          {checkinResult ? (
            <Button onClick={onDone}>{tCirc("actions.done")}</Button>
          ) : (
            <>
              <Button variant="outline" onClick={onCancel}>
                {tLib("cancel")}
              </Button>
              <Button
                onClick={() => {
                  if (selectedCopy?.circulation) {
                    onCheckin(selectedCopy.circulation._id);
                  }
                }}
                disabled={isProcessing}
              >
                {isProcessing && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}
                {tCirc("actions.confirmCheckin")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
