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
import { useState } from "react";
import { toast } from "sonner";
import { LocationSelector } from "@/components/location-selector";
import { useScopedI18n } from "@/locales/client";
import { movementIssueLabel } from "./movement-labels";

export type MoveDialogMode = "direct" | "request";

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
  const [toLocationId, setToLocationId] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [override, setOverride] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const moveObject = useMutation(api.locations.moveObject);
  const createMoveRequest = useMutation(api.locations.createMoveRequest);
  const preflight = useQuery(
    api.locations.checkMoveAllowed,
    toLocationId
      ? { collectionId, toLocationId: toLocationId as Id<"locations"> }
      : "skip",
  );

  const isDirect = mode === "direct";
  const blockingIssues =
    preflight?.issues.filter((issue) => !issue.canOverride) ?? [];
  const overridableIssues =
    preflight?.issues.filter((issue) => issue.canOverride) ?? [];
  const isBlocked =
    isDirect &&
    (blockingIssues.length > 0 || (overridableIssues.length > 0 && !override));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!toLocationId) {
      setError(t("dialog.selectDestinationError"));
      return;
    }
    if (!isDirect && !reason.trim()) {
      setError(t("dialog.reasonRequired"));
      return;
    }
    setIsSubmitting(true);
    try {
      if (isDirect) {
        await moveObject({
          collectionId,
          toLocationId: toLocationId as Id<"locations">,
          reason: reason.trim() || undefined,
          notes: notes.trim() || undefined,
          expectedFromLocationId: currentLocationId ?? null,
          overrideStatus: override || undefined,
          overrideCapacity: override || undefined,
        });
        toast.success(t("dialog.moved"));
      } else {
        await createMoveRequest({
          collectionId,
          toLocationId: toLocationId as Id<"locations">,
          reason: reason.trim(),
          notes: notes.trim() || undefined,
        });
        toast.success(t("dialog.requested"));
      }
      onClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : t("dialog.failed"),
      );
      setIsSubmitting(false);
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
            {error && (
              <div
                role="alert"
                className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive"
              >
                {error}
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
                  value={toLocationId}
                  onValueChange={(value) => {
                    setToLocationId(value);
                    setOverride(false);
                  }}
                  placeholder={t("dialog.destinationPlaceholder")}
                  allowNone={false}
                />
              </div>
              {toLocationId && preflight === undefined && (
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
                      checked={override}
                      onCheckedChange={(checked) =>
                        setOverride(checked === true)
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
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={t("dialog.reasonPlaceholder")}
                required={!isDirect}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="move-notes">{t("dialog.notes")}</Label>
              <Textarea
                id="move-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting || isBlocked}>
              {isSubmitting
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
