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
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DeaccessionArchiveDeleteForm } from "./deaccession-archive-delete-form";
import {
  getDeaccessionDialogCopy,
  submitDeaccession,
} from "./deaccession-dialog-submit";
import type {
  AccessionMode,
  DeaccessionDialogProps,
  RemovalType,
} from "./deaccession-dialog-types";
import { DeaccessionMoveForm } from "./deaccession-move-form";
import { DeaccessionSoldForm } from "./deaccession-sold-form";
import { DeaccessionTypePicker } from "./deaccession-type-picker";

export type { RemovalType } from "./deaccession-dialog-types";

export function DeaccessionDialog({
  open,
  onOpenChange,
  collectionId,
  collectionTitle,
  organizationId,
  initialRemovalType = null,
}: DeaccessionDialogProps) {
  const [removalType, setRemovalType] = useState<RemovalType | null>(null);
  const [date, setDate] = useState<Date>(new Date());
  const [reason, setReason] = useState("");
  const [method, setMethod] = useState<
    "sale" | "donation" | "transfer" | "destruction"
  >("sale");
  const [disposition, setDisposition] = useState("");
  const [notes, setNotes] = useState("");
  const [accessionMode, setAccessionMode] = useState<AccessionMode>("keep");
  const [targetOrganizationId, setTargetOrganizationId] = useState<
    Id<"organizations"> | ""
  >("");
  const [manualAccessionNumber, setManualAccessionNumber] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { push } = useRouter();
  const createDeaccession = useMutation(api.deaccessions.create);
  const createMoveRequest = useMutation(api.objectMoves.createRequest);

  useEffect(() => {
    if (open) {
      setRemovalType(initialRemovalType);
    }
  }, [initialRemovalType, open]);

  const workflowConfigs = useQuery(
    api.organizations.getWorkflowConfigs,
    organizationId ? { organizationId } : "skip",
  );
  const targetOrganizations = useQuery(
    api.objectMoves.listEligibleTargetOrganizations,
    open ? { collectionId } : "skip",
  );
  const moveEligibility = useQuery(
    api.objectMoves.getEligibility,
    removalType === "move" && targetOrganizationId
      ? {
          collectionId,
          targetOrganizationId: targetOrganizationId as Id<"organizations">,
        }
      : open
        ? { collectionId }
        : "skip",
  );

  const deaccessionWorkflow = workflowConfigs?.find(
    (workflow) => workflow.workflowType === "deaccession",
  );

  const resetForm = () => {
    setRemovalType(null);
    setReason("");
    setDisposition("");
    setNotes("");
    setDate(new Date());
    setMethod("sale");
    setAccessionMode("keep");
    setTargetOrganizationId("");
    setManualAccessionNumber("");
    setError(null);
  };

  const handleSubmit = async () => {
    if (!removalType) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await submitDeaccession({
        removalType,
        reason,
        organizationId,
        collectionId,
        date,
        method,
        disposition,
        notes,
        targetOrganizationId,
        accessionMode,
        manualAccessionNumber,
        moveEligibility,
        createDeaccession,
        createMoveRequest,
      });

      resetForm();
      onOpenChange(false);

      if (result.kind === "move") {
        push(`/objects/move-requests/${result.id}`);
      } else {
        push(`/deaccessions/${result.id}`);
      }
    } catch (err) {
      console.error("Failed to process object removal or transfer:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to process object removal or transfer",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const blockers = moveEligibility?.blockers ?? [];
  const isDirectRemovalFlow = initialRemovalType !== null;
  const { dialogTitle, dialogDescription } = getDeaccessionDialogCopy(
    removalType,
    collectionTitle,
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        {!removalType && (
          <DeaccessionTypePicker
            deaccessionWorkflow={deaccessionWorkflow}
            onSelect={setRemovalType}
          />
        )}

        {removalType === "sold" && (
          <DeaccessionSoldForm
            isDirectRemovalFlow={isDirectRemovalFlow}
            deaccessionWorkflow={deaccessionWorkflow}
            workflowConfigsLoaded={workflowConfigs !== undefined}
            date={date}
            reason={reason}
            method={method}
            disposition={disposition}
            notes={notes}
            onBack={() => setRemovalType(null)}
            onDateChange={setDate}
            onReasonChange={setReason}
            onMethodChange={setMethod}
            onDispositionChange={setDisposition}
            onNotesChange={setNotes}
          />
        )}

        {removalType === "move" && (
          <DeaccessionMoveForm
            isDirectRemovalFlow={isDirectRemovalFlow}
            targetOrganizations={targetOrganizations ?? undefined}
            blockers={blockers}
            targetOrganizationId={targetOrganizationId}
            accessionMode={accessionMode}
            manualAccessionNumber={manualAccessionNumber}
            reason={reason}
            notes={notes}
            onBack={() => setRemovalType(null)}
            onTargetOrganizationChange={setTargetOrganizationId}
            onAccessionModeChange={setAccessionMode}
            onManualAccessionNumberChange={setManualAccessionNumber}
            onReasonChange={setReason}
            onNotesChange={setNotes}
          />
        )}

        {removalType === "archived" && (
          <DeaccessionArchiveDeleteForm
            variant="archived"
            isDirectRemovalFlow={isDirectRemovalFlow}
            reason={reason}
            onBack={() => setRemovalType(null)}
            onReasonChange={setReason}
          />
        )}

        {removalType === "deleted" && (
          <DeaccessionArchiveDeleteForm
            variant="deleted"
            isDirectRemovalFlow={isDirectRemovalFlow}
            reason={reason}
            onBack={() => setRemovalType(null)}
            onReasonChange={setReason}
          />
        )}

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {removalType && (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                isSubmitting ||
                !reason.trim() ||
                (removalType === "move" &&
                  (!targetOrganizationId ||
                    (moveEligibility !== undefined &&
                      !moveEligibility.isEligible) ||
                    (accessionMode === "manual" &&
                      !manualAccessionNumber.trim())))
              }
              variant={removalType === "deleted" ? "destructive" : "default"}
            >
              {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              {removalType === "sold" && "Submit for Approval"}
              {removalType === "move" && "Submit Move Request"}
              {removalType === "archived" && "Submit Archive Request"}
              {removalType === "deleted" && "Submit Delete Request"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
