"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { custodyConflictFromError } from "@v1/backend/convex/utils/custodyErrors";
import { Button } from "@v1/ui/button";
import { Checkbox } from "@v1/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import { useMutation, useQuery } from "convex/react";
import { useReducer, useState } from "react";
import { toast } from "sonner";
import { ActionRefusal, type Refusal } from "@/components/action-refusal";
import { LocationSelector } from "@/components/location-selector";
import {
  FieldError,
  fieldErrorProps,
} from "@/components/record-form/record-form-notices";
import { useCapabilityErrorMessage } from "@/hooks/use-capability-error-message";
import { useCustodyConflictMessage } from "@/hooks/use-custody-conflict-message";
import { useScopedI18n } from "@/locales/client";
import { movementIssueLabel } from "./movement-labels";

export type MoveDialogMode = "direct" | "request";

const DESTINATION_FIELD = "move-destination";
const REASON_FIELD = "move-reason";

interface MoveFieldErrors {
  [DESTINATION_FIELD]?: string;
  [REASON_FIELD]?: string;
}

interface MoveFormState {
  toLocationId: string;
  reason: string;
  notes: string;
  override: boolean;
  fieldErrors: MoveFieldErrors;
  refusal: Refusal | null;
  isSubmitting: boolean;
  /**
   * After a refusal because the object moved, the dialog shows and uses its
   * latest recorded location, which staff confirm by moving again.
   */
  followRecordedSource: boolean;
}

type MoveFormAction =
  | { type: "destinationChanged"; value: string }
  | { type: "reasonChanged"; value: string }
  | { type: "notesChanged"; value: string }
  | { type: "overrideChanged"; value: boolean }
  | { type: "invalid"; fieldErrors: MoveFieldErrors }
  | { type: "submitted" }
  | { type: "refused"; refusal: Refusal; sourceChanged: boolean };

const initialMoveFormState: MoveFormState = {
  toLocationId: "",
  reason: "",
  notes: "",
  override: false,
  fieldErrors: {},
  refusal: null,
  isSubmitting: false,
  followRecordedSource: false,
};

function moveFormReducer(
  state: MoveFormState,
  action: MoveFormAction,
): MoveFormState {
  switch (action.type) {
    case "destinationChanged":
      return {
        ...state,
        toLocationId: action.value,
        override: false,
        fieldErrors: { ...state.fieldErrors, [DESTINATION_FIELD]: undefined },
      };
    case "reasonChanged":
      return {
        ...state,
        reason: action.value,
        fieldErrors: { ...state.fieldErrors, [REASON_FIELD]: undefined },
      };
    case "notesChanged":
      return { ...state, notes: action.value };
    case "overrideChanged":
      return { ...state, override: action.value };
    case "invalid":
      return { ...state, fieldErrors: action.fieldErrors, refusal: null };
    case "submitted":
      return { ...state, fieldErrors: {}, refusal: null, isSubmitting: true };
    case "refused":
      return {
        ...state,
        refusal: action.refusal,
        isSubmitting: false,
        followRecordedSource:
          state.followRecordedSource || action.sourceChanged,
      };
  }
}

interface MoveObjectFormDialogProps {
  mode: MoveDialogMode;
  collectionId: Id<"collections">;
  organizationId: Id<"organizations">;
  currentLocationId?: Id<"locations">;
  currentLocationLabel: string;
  onClose: () => void;
}

export function MoveObjectFormDialog({
  mode,
  collectionId,
  organizationId,
  currentLocationId,
  currentLocationLabel,
  onClose,
}: MoveObjectFormDialogProps) {
  const t = useScopedI18n("locations.movements");
  const tCommon = useScopedI18n("common");
  const capabilityMessage = useCapabilityErrorMessage();
  const custodyConflictMessage = useCustodyConflictMessage();
  const [state, dispatch] = useReducer(moveFormReducer, initialMoveFormState);
  // The source is where staff saw the object when they opened the dialog. If
  // it moves meanwhile, the server refuses rather than recording an
  // observation nobody made.
  const [openedSource] = useState(() => ({
    id: currentLocationId ?? null,
    label: currentLocationLabel,
  }));
  const source = state.followRecordedSource
    ? { id: currentLocationId ?? null, label: currentLocationLabel }
    : openedSource;

  const moveObject = useMutation(api.locations.moveObject);
  const createMoveRequest = useMutation(api.locations.createMoveRequest);
  const preflight = useQuery(
    api.locations.checkMoveAllowed,
    state.toLocationId
      ? { collectionId, toLocationId: state.toLocationId as Id<"locations"> }
      : "skip",
  );

  const isDirect = mode === "direct";
  const blockingIssues =
    preflight?.issues.filter((issue) => !issue.canOverride) ?? [];
  const overridableIssues =
    preflight?.issues.filter((issue) => issue.canOverride) ?? [];
  const isBlocked =
    isDirect &&
    (blockingIssues.length > 0 ||
      (overridableIssues.length > 0 && !state.override));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const fieldErrors: MoveFieldErrors = {};
    if (!state.toLocationId) {
      fieldErrors[DESTINATION_FIELD] = t("dialog.selectDestinationError");
    }
    if (!isDirect && !state.reason.trim()) {
      fieldErrors[REASON_FIELD] = t("dialog.reasonRequired");
    }
    const [firstInvalid] = Object.keys(fieldErrors);
    if (firstInvalid) {
      dispatch({ type: "invalid", fieldErrors });
      document.getElementById(firstInvalid)?.focus();
      return;
    }
    dispatch({ type: "submitted" });
    try {
      if (isDirect) {
        await moveObject({
          collectionId,
          toLocationId: state.toLocationId as Id<"locations">,
          reason: state.reason.trim() || undefined,
          notes: state.notes.trim() || undefined,
          expectedFromLocationId: source.id,
          overrideStatus: state.override || undefined,
          overrideCapacity: state.override || undefined,
        });
        toast.success(t("dialog.moved"));
      } else {
        await createMoveRequest({
          collectionId,
          toLocationId: state.toLocationId as Id<"locations">,
          reason: state.reason.trim(),
          notes: state.notes.trim() || undefined,
        });
        toast.success(t("dialog.requested"));
      }
      onClose();
    } catch (submitError) {
      dispatch({
        type: "refused",
        refusal: {
          message:
            capabilityMessage(submitError) ??
            custodyConflictMessage(submitError, t("dialog.failed")),
        },
        sourceChanged:
          custodyConflictFromError(submitError)?.code === "SOURCE_CHANGED",
      });
    }
  };

  const issuesToShow = isDirect ? (preflight?.issues ?? []) : blockingIssues;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <form noValidate onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isDirect ? t("dialog.directTitle") : t("dialog.requestTitle")}
            </DialogTitle>
            <DialogDescription>
              {isDirect
                ? t("dialog.directDescription")
                : t("dialog.requestDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">
                {t("dialog.observedSource")}
              </span>
              <p className="break-words text-sm">{source.label}</p>
            </div>
            <ActionRefusal refusal={state.refusal} />
            <div className="space-y-2">
              <Label htmlFor={DESTINATION_FIELD}>
                {t("dialog.destination")} *
              </Label>
              <LocationSelector
                id={DESTINATION_FIELD}
                organizationId={organizationId}
                value={state.toLocationId}
                onValueChange={(value) =>
                  dispatch({ type: "destinationChanged", value })
                }
                placeholder={t("dialog.destinationPlaceholder")}
                allowNone={false}
                {...fieldErrorProps(
                  DESTINATION_FIELD,
                  state.fieldErrors[DESTINATION_FIELD],
                )}
              />
              <FieldError
                field={DESTINATION_FIELD}
                message={state.fieldErrors[DESTINATION_FIELD]}
              />
              {state.toLocationId && preflight === undefined && (
                <p className="text-xs text-muted-foreground" aria-live="polite">
                  {t("dialog.checking")}
                </p>
              )}
              {issuesToShow.length > 0 && (
                <ul
                  className="space-y-1 text-sm text-amber-500"
                  aria-live="polite"
                >
                  {issuesToShow.map((issue) => (
                    <li key={issue.type}>{movementIssueLabel(t, issue)}</li>
                  ))}
                </ul>
              )}
              {isDirect &&
                blockingIssues.length === 0 &&
                overridableIssues.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="move-override"
                      checked={state.override}
                      onCheckedChange={(checked) =>
                        dispatch({
                          type: "overrideChanged",
                          value: checked === true,
                        })
                      }
                    />
                    <Label htmlFor="move-override" className="text-sm">
                      {t("dialog.override")}
                    </Label>
                  </div>
                )}
            </div>
            <div className="space-y-2">
              <Label htmlFor={REASON_FIELD}>
                {t("dialog.reason")}
                {isDirect ? "" : " *"}
              </Label>
              <Input
                id={REASON_FIELD}
                value={state.reason}
                onChange={(event) =>
                  dispatch({ type: "reasonChanged", value: event.target.value })
                }
                placeholder={t("dialog.reasonPlaceholder")}
                {...fieldErrorProps(
                  REASON_FIELD,
                  state.fieldErrors[REASON_FIELD],
                )}
              />
              <FieldError
                field={REASON_FIELD}
                message={state.fieldErrors[REASON_FIELD]}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="move-notes">{t("dialog.notes")}</Label>
              <Textarea
                id="move-notes"
                value={state.notes}
                onChange={(event) =>
                  dispatch({ type: "notesChanged", value: event.target.value })
                }
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={state.isSubmitting || isBlocked}>
              {state.isSubmitting
                ? t("dialog.submitting")
                : isDirect
                  ? t("dialog.submitMove")
                  : t("dialog.submitRequest")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
