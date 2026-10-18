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
import { useEffect, useReducer } from "react";
import { toast } from "sonner";
import { useObjectMoveErrorMessage } from "@/hooks/use-object-move-error-message";
import { useI18n } from "@/locales/client";
import { DeaccessionArchiveDeleteForm } from "./deaccession-archive-delete-form";
import {
  getDeaccessionDialogCopy,
  RemovalValidationError,
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

interface DeaccessionDialogState {
  removalType: RemovalType | null;
  date: Date;
  reason: string;
  method: "sale" | "donation" | "transfer" | "destruction";
  disposition: string;
  notes: string;
  accessionMode: AccessionMode;
  targetOrganizationId: Id<"organizations"> | "";
  manualAccessionNumber: string;
  isSubmitting: boolean;
  error: string | null;
}

type DeaccessionDialogAction =
  | { type: "setRemovalType"; value: RemovalType | null }
  | { type: "setDate"; value: Date }
  | { type: "setReason"; value: string }
  | {
      type: "setMethod";
      value: "sale" | "donation" | "transfer" | "destruction";
    }
  | { type: "setDisposition"; value: string }
  | { type: "setNotes"; value: string }
  | { type: "setAccessionMode"; value: AccessionMode }
  | { type: "setTargetOrganizationId"; value: Id<"organizations"> | "" }
  | { type: "setManualAccessionNumber"; value: string }
  | { type: "setIsSubmitting"; value: boolean }
  | { type: "setError"; value: string | null }
  | { type: "reset" };

const initialDeaccessionDialogState: DeaccessionDialogState = {
  removalType: null,
  date: new Date(),
  reason: "",
  method: "sale",
  disposition: "",
  notes: "",
  accessionMode: "keep",
  targetOrganizationId: "",
  manualAccessionNumber: "",
  isSubmitting: false,
  error: null,
};

function deaccessionDialogReducer(
  state: DeaccessionDialogState,
  action: DeaccessionDialogAction,
): DeaccessionDialogState {
  switch (action.type) {
    case "setRemovalType":
      return { ...state, removalType: action.value };
    case "setDate":
      return { ...state, date: action.value };
    case "setReason":
      return { ...state, reason: action.value };
    case "setMethod":
      return { ...state, method: action.value };
    case "setDisposition":
      return { ...state, disposition: action.value };
    case "setNotes":
      return { ...state, notes: action.value };
    case "setAccessionMode":
      return { ...state, accessionMode: action.value };
    case "setTargetOrganizationId":
      return { ...state, targetOrganizationId: action.value };
    case "setManualAccessionNumber":
      return { ...state, manualAccessionNumber: action.value };
    case "setIsSubmitting":
      return { ...state, isSubmitting: action.value };
    case "setError":
      return { ...state, error: action.value };
    case "reset":
      return {
        ...initialDeaccessionDialogState,
        date: new Date(),
      };
  }
}

export function DeaccessionDialog({
  open,
  onOpenChange,
  collectionId,
  collectionTitle,
  organizationId,
  initialRemovalType = null,
}: DeaccessionDialogProps) {
  const translate = useI18n();
  const errorMessage = useObjectMoveErrorMessage();
  const [state, dispatch] = useReducer(
    deaccessionDialogReducer,
    initialDeaccessionDialogState,
  );

  const { push } = useRouter();
  const createDeaccession = useMutation(api.deaccessions.create);
  const createMoveRequest = useMutation(api.objectMoves.createRequest);
  const archiveCollection = useMutation(api.collections.archiveCollection);

  useEffect(() => {
    if (open) {
      dispatch({ type: "setRemovalType", value: initialRemovalType });
    }
  }, [initialRemovalType, open]);

  const objectActions = useQuery(
    api.objectActions.get,
    open ? { collectionId } : "skip",
  );
  const moveEligibility = useQuery(
    api.objectMoves.getEligibility,
    state.removalType === "move" && state.targetOrganizationId
      ? {
          collectionId,
          targetOrganizationId:
            state.targetOrganizationId as Id<"organizations">,
        }
      : open
        ? { collectionId }
        : "skip",
  );

  const approvalSteps =
    objectActions?.deaccession.state === "available"
      ? objectActions.deaccession.approvalSteps
      : undefined;

  const resetForm = () => {
    dispatch({ type: "reset" });
  };

  const handleSubmit = async () => {
    if (!state.removalType) return;

    dispatch({ type: "setIsSubmitting", value: true });
    dispatch({ type: "setError", value: null });

    try {
      const result = await submitDeaccession({
        removalType: state.removalType,
        reason: state.reason,
        organizationId,
        collectionId,
        archiveCollection,
        date: state.date,
        method: state.method,
        disposition: state.disposition,
        notes: state.notes,
        targetOrganizationId: state.targetOrganizationId,
        accessionMode: state.accessionMode,
        manualAccessionNumber: state.manualAccessionNumber,
        moveEligibility,
        translate,
        createDeaccession,
        createMoveRequest,
      });

      resetForm();
      onOpenChange(false);

      if (result.kind === "archive") {
        toast.success(translate("objects.withdrawal.withdrawn"));
        return;
      }
      if (result.kind === "move") {
        push(`/objects/move-requests/${result.id}`);
      } else {
        push(`/deaccessions/${result.id}`);
      }
    } catch (err) {
      console.error("Failed to process object removal or transfer:", err);
      dispatch({
        type: "setError",
        value:
          err instanceof RemovalValidationError
            ? err.message
            : errorMessage(
                err,
                translate("untranslatedComponents.deaccession.processFailed"),
              ),
      });
    } finally {
      dispatch({ type: "setIsSubmitting", value: false });
    }
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const blockers = moveEligibility?.blockers ?? [];
  const isDirectRemovalFlow = initialRemovalType !== null;
  const { dialogTitle, dialogDescription } = getDeaccessionDialogCopy(
    state.removalType,
    collectionTitle,
    translate,
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        {!state.removalType && (
          <DeaccessionTypePicker
            actions={objectActions}
            onSelect={(value) => dispatch({ type: "setRemovalType", value })}
          />
        )}

        {state.removalType === "sold" && (
          <DeaccessionSoldForm
            isDirectRemovalFlow={isDirectRemovalFlow}
            approvalSteps={approvalSteps}
            date={state.date}
            reason={state.reason}
            method={state.method}
            disposition={state.disposition}
            notes={state.notes}
            onBack={() => dispatch({ type: "setRemovalType", value: null })}
            onDateChange={(value) => dispatch({ type: "setDate", value })}
            onReasonChange={(value) => dispatch({ type: "setReason", value })}
            onMethodChange={(value) => dispatch({ type: "setMethod", value })}
            onDispositionChange={(value) =>
              dispatch({ type: "setDisposition", value })
            }
            onNotesChange={(value) => dispatch({ type: "setNotes", value })}
          />
        )}

        {state.removalType === "move" && (
          <DeaccessionMoveForm
            isDirectRemovalFlow={isDirectRemovalFlow}
            collectionId={collectionId}
            blockers={blockers}
            targetOrganizationId={state.targetOrganizationId}
            accessionMode={state.accessionMode}
            manualAccessionNumber={state.manualAccessionNumber}
            reason={state.reason}
            notes={state.notes}
            onBack={() => dispatch({ type: "setRemovalType", value: null })}
            onTargetOrganizationChange={(value) =>
              dispatch({ type: "setTargetOrganizationId", value })
            }
            onAccessionModeChange={(value) =>
              dispatch({ type: "setAccessionMode", value })
            }
            onManualAccessionNumberChange={(value) =>
              dispatch({ type: "setManualAccessionNumber", value })
            }
            onReasonChange={(value) => dispatch({ type: "setReason", value })}
            onNotesChange={(value) => dispatch({ type: "setNotes", value })}
          />
        )}

        {state.removalType === "archived" && (
          <DeaccessionArchiveDeleteForm
            isDirectRemovalFlow={isDirectRemovalFlow}
            reason={state.reason}
            onBack={() => dispatch({ type: "setRemovalType", value: null })}
            onReasonChange={(value) => dispatch({ type: "setReason", value })}
          />
        )}

        {state.error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {state.error}
          </div>
        )}

        {state.removalType && (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={state.isSubmitting}
            >
              {translate("untranslatedComponents.labels.cancel")}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                state.isSubmitting ||
                !state.reason.trim() ||
                (state.removalType === "move" &&
                  (!state.targetOrganizationId ||
                    (moveEligibility !== undefined &&
                      !moveEligibility.isEligible) ||
                    (state.accessionMode === "manual" &&
                      !state.manualAccessionNumber.trim())))
              }
              variant="default"
            >
              {state.isSubmitting && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              {state.removalType === "sold" &&
                translate(
                  "untranslatedComponents.deaccession.submitForApproval",
                )}
              {state.removalType === "move" &&
                translate(
                  "untranslatedComponents.deaccession.submitMoveRequest",
                )}
              {state.removalType === "archived" &&
                translate(
                  "untranslatedComponents.deaccession.submitArchiveRequest",
                )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
