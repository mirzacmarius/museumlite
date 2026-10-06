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
import { Input } from "@v1/ui/input";
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
import { useReducer } from "react";
import { useOrganization } from "@/components/organization-provider";
import { useScopedI18n } from "@/locales/client";

interface MoveObjectDialogProps {
  collectionId: string;
  currentLocationId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface MoveObjectDialogState {
  toLocationId: string;
  reason: string;
  notes: string;
  isSubmitting: boolean;
  error: string | null;
}

type MoveObjectDialogAction =
  | { type: "setToLocationId"; value: string }
  | { type: "setReason"; value: string }
  | { type: "setNotes"; value: string }
  | { type: "setIsSubmitting"; value: boolean }
  | { type: "setError"; value: string | null }
  | { type: "resetForm" };

const initialMoveObjectDialogState: MoveObjectDialogState = {
  toLocationId: "",
  reason: "",
  notes: "",
  isSubmitting: false,
  error: null,
};

function moveObjectDialogReducer(
  state: MoveObjectDialogState,
  action: MoveObjectDialogAction,
): MoveObjectDialogState {
  switch (action.type) {
    case "setToLocationId":
      return { ...state, toLocationId: action.value };
    case "setReason":
      return { ...state, reason: action.value };
    case "setNotes":
      return { ...state, notes: action.value };
    case "setIsSubmitting":
      return { ...state, isSubmitting: action.value };
    case "setError":
      return { ...state, error: action.value };
    case "resetForm":
      return initialMoveObjectDialogState;
  }
}

export function MoveObjectDialog({
  collectionId,
  currentLocationId,
  open,
  onOpenChange,
  onSuccess,
}: MoveObjectDialogProps) {
  const t = useScopedI18n("locations.moveObject");
  const tDashboard = useScopedI18n("untranslatedDashboard.locationViews");
  const tForm = useScopedI18n("locations.form");
  const tCommon = useScopedI18n("common");
  const { currentOrganizationId } = useOrganization();
  const [state, dispatch] = useReducer(
    moveObjectDialogReducer,
    initialMoveObjectDialogState,
  );

  const rootLocations = useQuery(
    api.locations.list,
    currentOrganizationId
      ? {
          organizationId: currentOrganizationId as Id<"organizations">,
          parentLocationId: "root",
        }
      : "skip",
  );

  const moveObject = useMutation(api.locations.moveObject);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    dispatch({ type: "setError", value: null });
    if (!state.toLocationId) {
      dispatch({ type: "setError", value: t("selectLocationError") });
      return;
    }

    dispatch({ type: "setIsSubmitting", value: true });
    try {
      await moveObject({
        collectionId: collectionId as Id<"collections">,
        toLocationId: state.toLocationId as Id<"locations">,
        reason: state.reason || undefined,
        notes: state.notes || undefined,
      });
      onOpenChange(false);
      dispatch({ type: "resetForm" });
      onSuccess?.();
    } catch (err) {
      dispatch({
        type: "setError",
        value: err instanceof Error ? err.message : t("moveFailed"),
      });
      dispatch({ type: "setIsSubmitting", value: false });
    }
  };

  // Flatten locations recursively for selection
  const flattenLocations = (
    locs: typeof rootLocations,
    parent = "",
  ): Array<{ id: string; name: string; type: string }> => {
    if (!locs) return [];
    const result: Array<{ id: string; name: string; type: string }> = [];
    for (const loc of locs) {
      const displayName = parent ? `${parent} → ${loc.name}` : loc.name;
      result.push({ id: loc._id, name: displayName, type: loc.type });
      if (loc.children && loc.children.length > 0) {
        // Children are simplified, so we can process them directly
        // without recursion since they don't have nested children
        for (const child of loc.children) {
          const childDisplayName = `${displayName} → ${child.name}`;
          result.push({
            id: child._id,
            name: childDisplayName,
            type: child.type,
          });
        }
      }
    }
    return result;
  };

  const availableLocations = flattenLocations(rootLocations).filter(
    (loc) => loc.id !== currentLocationId,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {state.error && (
              <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                {state.error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="location">{t("selectDestination")} *</Label>
              <Select
                value={state.toLocationId}
                onValueChange={(value) =>
                  dispatch({ type: "setToLocationId", value })
                }
                required
              >
                <SelectTrigger id="location">
                  <SelectValue
                    placeholder={t("selectDestinationPlaceholder")}
                  />
                </SelectTrigger>
                <SelectContent>
                  {availableLocations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name} ({loc.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">{tDashboard("moveReason")}</Label>
              <Input
                id="reason"
                value={state.reason}
                onChange={(e) =>
                  dispatch({ type: "setReason", value: e.target.value })
                }
                placeholder={tDashboard("moveReasonPlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">{tForm("notesLabel")}</Label>
              <Textarea
                id="notes"
                value={state.notes}
                onChange={(e) =>
                  dispatch({ type: "setNotes", value: e.target.value })
                }
                placeholder={tForm("notesPlaceholder")}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={state.isSubmitting}>
              {state.isSubmitting ? t("moving") : t("moveObject")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
