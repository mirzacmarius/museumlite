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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { Textarea } from "@v1/ui/textarea";
import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { useEffect, useMemo, useReducer } from "react";

interface DeleteLocationDialogProps {
  locationId: string;
  locationName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: (options: { sentToDeaccessions: boolean }) => void;
}

type DeaccessionMethod = "sale" | "donation" | "destruction" | "transfer";

interface DeleteLocationDialogState {
  reason: string;
  notes: string;
  method: DeaccessionMethod;
  error: string | null;
  isSubmitting: boolean;
}

type DeleteLocationDialogAction =
  | { type: "setReason"; value: string }
  | { type: "setNotes"; value: string }
  | { type: "setMethod"; value: DeaccessionMethod }
  | { type: "setError"; value: string | null }
  | { type: "setIsSubmitting"; value: boolean }
  | { type: "resetForm" };

const initialDeleteLocationDialogState: DeleteLocationDialogState = {
  reason: "",
  notes: "",
  method: "destruction",
  error: null,
  isSubmitting: false,
};

function deleteLocationDialogReducer(
  state: DeleteLocationDialogState,
  action: DeleteLocationDialogAction,
): DeleteLocationDialogState {
  switch (action.type) {
    case "setReason":
      return { ...state, reason: action.value };
    case "setNotes":
      return { ...state, notes: action.value };
    case "setMethod":
      return { ...state, method: action.value };
    case "setError":
      return { ...state, error: action.value };
    case "setIsSubmitting":
      return { ...state, isSubmitting: action.value };
    case "resetForm":
      return initialDeleteLocationDialogState;
  }
}

const RETIRED_OBJECT_STATUSES = new Set([
  "deaccessioned",
  "archived",
  "deleted",
]);

export function DeleteLocationDialog({
  locationId,
  locationName,
  open,
  onOpenChange,
  onDeleted,
}: DeleteLocationDialogProps) {
  const t = useScopedI18n("locations");
  const tCommon = useScopedI18n("common");
  const [state, dispatch] = useReducer(
    deleteLocationDialogReducer,
    initialDeleteLocationDialogState,
  );

  const location = useQuery(
    api.locations.get,
    open && locationId ? { locationId: locationId as Id<"locations"> } : "skip",
  );
  const objects = useQuery(
    api.locations.getObjectsAtLocation,
    open && locationId ? { locationId: locationId as Id<"locations"> } : "skip",
  );
  const deleteLocation = useMutation(api.locations.deleteLocation);

  useEffect(() => {
    if (!open) {
      dispatch({ type: "resetForm" });
    }
  }, [open]);

  const blockingObjects = useMemo(
    () =>
      (objects ?? []).filter(
        (object) => !RETIRED_OBJECT_STATUSES.has(object.status),
      ),
    [objects],
  );

  const hasActiveChildren = (location?.children.length ?? 0) > 0;
  const requiresDeaccession = blockingObjects.length > 0;
  const canDelete =
    !hasActiveChildren && (!requiresDeaccession || !!state.reason.trim());

  const handleDelete = async () => {
    if (!locationId || !canDelete) {
      return;
    }

    dispatch({ type: "setIsSubmitting", value: true });
    dispatch({ type: "setError", value: null });

    try {
      await deleteLocation({
        locationId: locationId as Id<"locations">,
        ...(requiresDeaccession
          ? {
              deaccessionReason: state.reason.trim(),
              deaccessionMethod: state.method,
              deaccessionNotes: state.notes.trim() || undefined,
              dateDeaccessioned: Date.now(),
            }
          : {}),
      });
      onDeleted?.({ sentToDeaccessions: requiresDeaccession });
      onOpenChange(false);
    } catch (err) {
      dispatch({
        type: "setError",
        value: err instanceof Error ? err.message : t("deleteFailed"),
      });
      dispatch({ type: "setIsSubmitting", value: false });
      return;
    }

    dispatch({ type: "setIsSubmitting", value: false });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("deleteLocation")}</DialogTitle>
          <DialogDescription>
            {t("deleteConfirmWithName", { name: locationName })}
          </DialogDescription>
        </DialogHeader>

        {state.error ? (
          <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
            {state.error}
          </div>
        ) : null}

        {location === undefined || objects === undefined ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" />
            {t("loading")}
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {hasActiveChildren ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-400" />
                  <p>{t("deleteBlockedByChildren")}</p>
                </div>
              </div>
            ) : null}

            {requiresDeaccession ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-400" />
                    <p>
                      {t("deleteRequiresDeaccession", {
                        count: blockingObjects.length,
                      })}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="deaccession-method">
                    {t("deleteDialog.methodLabel")}
                  </Label>
                  <Select
                    value={state.method}
                    onValueChange={(value: DeaccessionMethod) =>
                      dispatch({ type: "setMethod", value })
                    }
                  >
                    <SelectTrigger id="deaccession-method">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="destruction">
                        {t("deleteDialog.methods.destruction")}
                      </SelectItem>
                      <SelectItem value="transfer">
                        {t("deleteDialog.methods.transfer")}
                      </SelectItem>
                      <SelectItem value="donation">
                        {t("deleteDialog.methods.donation")}
                      </SelectItem>
                      <SelectItem value="sale">
                        {t("deleteDialog.methods.sale")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="deaccession-reason">
                    {t("deleteDialog.reasonLabel")}
                  </Label>
                  <Textarea
                    id="deaccession-reason"
                    value={state.reason}
                    onChange={(event) =>
                      dispatch({ type: "setReason", value: event.target.value })
                    }
                    placeholder={t("deleteDialog.reasonPlaceholder")}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="deaccession-notes">
                    {t("deleteDialog.notesLabel")}
                  </Label>
                  <Textarea
                    id="deaccession-notes"
                    value={state.notes}
                    onChange={(event) =>
                      dispatch({ type: "setNotes", value: event.target.value })
                    }
                    placeholder={t("deleteDialog.notesPlaceholder")}
                    rows={3}
                  />
                </div>
              </div>
            ) : null}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={state.isSubmitting}
          >
            {tCommon("cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={
              state.isSubmitting ||
              location === undefined ||
              objects === undefined ||
              !canDelete
            }
          >
            {state.isSubmitting ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 size-4" />
            )}
            {requiresDeaccession
              ? t("deleteDialog.submitWithDeaccessions")
              : t("deleteLocation")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
