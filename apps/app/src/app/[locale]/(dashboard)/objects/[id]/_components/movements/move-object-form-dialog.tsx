"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
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
import { useReducer } from "react";
import { toast } from "sonner";
import { LocationSelector } from "@/components/location-selector";
import { useScopedI18n } from "@/locales/client";
import { movementIssueLabel } from "./movement-labels";

export type MoveDialogMode = "direct" | "request";

interface MoveFormState {
  toLocationId: string;
  reason: string;
  notes: string;
  override: boolean;
  error: string | null;
  isSubmitting: boolean;
}

type MoveFormAction =
  | { type: "destinationChanged"; value: string }
  | { type: "reasonChanged"; value: string }
  | { type: "notesChanged"; value: string }
  | { type: "overrideChanged"; value: boolean }
  | { type: "errorChanged"; value: string | null }
  | { type: "submittingChanged"; value: boolean };

const initialMoveFormState: MoveFormState = {
  toLocationId: "",
  reason: "",
  notes: "",
  override: false,
  error: null,
  isSubmitting: false,
};

function moveFormReducer(
  state: MoveFormState,
  action: MoveFormAction,
): MoveFormState {
  switch (action.type) {
    case "destinationChanged":
      return { ...state, toLocationId: action.value, override: false };
    case "reasonChanged":
      return { ...state, reason: action.value };
    case "notesChanged":
      return { ...state, notes: action.value };
    case "overrideChanged":
      return { ...state, override: action.value };
    case "errorChanged":
      return { ...state, error: action.value };
    case "submittingChanged":
      return { ...state, isSubmitting: action.value };
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
  const [state, dispatch] = useReducer(moveFormReducer, initialMoveFormState);

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
    dispatch({ type: "errorChanged", value: null });
    if (!state.toLocationId) {
      dispatch({
        type: "errorChanged",
        value: t("dialog.selectDestinationError"),
      });
      return;
    }
    if (!isDirect && !state.reason.trim()) {
      dispatch({ type: "errorChanged", value: t("dialog.reasonRequired") });
      return;
    }
    dispatch({ type: "submittingChanged", value: true });
    try {
      if (isDirect) {
        await moveObject({
          collectionId,
          toLocationId: state.toLocationId as Id<"locations">,
          reason: state.reason.trim() || undefined,
          notes: state.notes.trim() || undefined,
          expectedFromLocationId: currentLocationId ?? null,
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
        type: "errorChanged",
        value:
          submitError instanceof Error
            ? submitError.message
            : t("dialog.failed"),
      });
      dispatch({ type: "submittingChanged", value: false });
    }
  };

  const issuesToShow = isDirect ? (preflight?.issues ?? []) : blockingIssues;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <form onSubmit={handleSubmit}>
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
            {state.error && (
              <div
                role="alert"
                className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive"
              >
                {state.error}
              </div>
            )}
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">
                {t("dialog.observedSource")}
              </span>
              <p className="break-words text-sm">{currentLocationLabel}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="move-destination">
                {t("dialog.destination")} *
              </Label>
              <div id="move-destination">
                <LocationSelector
                  organizationId={organizationId}
                  value={state.toLocationId}
                  onValueChange={(value) =>
                    dispatch({ type: "destinationChanged", value })
                  }
                  placeholder={t("dialog.destinationPlaceholder")}
                  allowNone={false}
                />
              </div>
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
              <Label htmlFor="move-reason">
                {t("dialog.reason")}
                {isDirect ? "" : " *"}
              </Label>
              <Input
                id="move-reason"
                value={state.reason}
                onChange={(event) =>
                  dispatch({ type: "reasonChanged", value: event.target.value })
                }
                placeholder={t("dialog.reasonPlaceholder")}
                required={!isDirect}
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
