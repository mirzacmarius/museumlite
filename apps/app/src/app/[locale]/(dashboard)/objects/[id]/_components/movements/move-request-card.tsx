"use client";

import { api } from "@v1/backend/convex/_generated/api";
import { Badge } from "@v1/ui/badge";
import { Button } from "@v1/ui/button";
import { Checkbox } from "@v1/ui/checkbox";
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ArrowRight, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useActionErrorMessage } from "@/hooks/use-action-error-message";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { formatMovementTime, movementIssueLabel } from "./movement-labels";

export type MoveRequestSummary = FunctionReturnType<
  typeof api.locations.listMoveRequests
>[number];

type RequestAction = "approve" | "reject" | "execute" | "cancel";

interface MoveRequestCardProps {
  request: MoveRequestSummary;
  canManage: boolean;
}

export function MoveRequestCard({ request, canManage }: MoveRequestCardProps) {
  const t = useScopedI18n("locations.movements");
  const actionErrorMessage = useActionErrorMessage();
  const locale = useCurrentLocale();
  const [notes, setNotes] = useState("");
  const [override, setOverride] = useState(false);
  const [pending, setPending] = useState<RequestAction | null>(null);

  const approve = useMutation(api.locations.approveMoveRequest);
  const reject = useMutation(api.locations.rejectMoveRequest);
  const execute = useMutation(api.locations.executeMoveRequest);
  const cancel = useMutation(api.locations.cancelMoveRequest);

  const isReviewable =
    request.status === "pending" || request.status === "conflict";
  const isOpen = isReviewable || request.status === "approved";
  const currentCheck = useQuery(
    api.locations.checkMoveAllowed,
    canManage && isReviewable
      ? {
          collectionId: request.collectionId,
          toLocationId: request.toLocationId,
        }
      : "skip",
  );
  const currentIssues = currentCheck?.issues ?? [];
  const canOverride =
    currentIssues.length > 0 &&
    currentIssues.every((issue) => issue.canOverride);
  const unknownUser = t("unknownUser");
  const locationLabel = (name: string | undefined) => name ?? t("noLocation");

  const run = async (action: RequestAction, work: () => Promise<string>) => {
    setPending(action);
    try {
      const message = await work();
      setNotes("");
      setOverride(false);
      toast.success(message);
    } catch (error) {
      toast.error(actionErrorMessage(error, t("requests.actionFailed")));
    } finally {
      setPending(null);
    }
  };

  const handleApprove = () =>
    run("approve", async () => {
      await approve({
        requestId: request._id,
        reviewNotes: notes.trim() || undefined,
        overrideCapacity: override || undefined,
        overrideStatus: override || undefined,
      });
      return t("requests.approved");
    });
  const handleReject = () => {
    if (!notes.trim()) {
      toast.error(t("requests.rejectNotesRequired"));
      return;
    }
    void run("reject", async () => {
      await reject({ requestId: request._id, reviewNotes: notes.trim() });
      return t("requests.rejected");
    });
  };
  const handleExecute = () =>
    run("execute", async () => {
      const result = await execute({
        requestId: request._id,
        executionNotes: notes.trim() || undefined,
      });
      if (result.outcome === "conflict") {
        throw new Error(t("requests.conflictRecorded"));
      }
      return t("requests.executed");
    });
  const handleCancel = () =>
    run("cancel", async () => {
      await cancel({
        requestId: request._id,
        reason: notes.trim() || undefined,
      });
      return t("requests.cancelled");
    });

  const spinner = (action: RequestAction) =>
    pending === action ? (
      <Loader2 className="mr-2 size-4 animate-spin" />
    ) : null;

  return (
    <li className="space-y-3 rounded-lg border border-white/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
          <span className="break-words">
            {locationLabel(request.fromLocationName)}
          </span>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
          <span className="break-words font-medium">
            {request.toLocationName}
          </span>
        </div>
        <Badge
          variant={request.status === "conflict" ? "destructive" : "outline"}
        >
          {t(`requests.status.${request.status}`)}
        </Badge>
      </div>
      <p className="break-words text-sm">{request.reason}</p>
      {request.notes && (
        <p className="break-words text-sm text-muted-foreground">
          {request.notes}
        </p>
      )}
      <div className="space-y-1 text-xs text-white/60">
        <p>
          {t("requests.requestedBy", {
            name: request.requestedByName ?? unknownUser,
          })}{" "}
          · {formatMovementTime(locale, request.requestedAt)}
        </p>
        {request.reviewedAt && (
          <p>
            {t("requests.reviewedBy", {
              name: request.reviewedByName ?? unknownUser,
            })}{" "}
            · {formatMovementTime(locale, request.reviewedAt)}
            {request.approvedFromLocationName &&
              ` · ${t("requests.approvedSource", { location: request.approvedFromLocationName })}`}
          </p>
        )}
        {(request.capacityOverride || request.statusOverride) && (
          <p>{t("requests.overridesApproved")}</p>
        )}
        {request.reviewNotes && (
          <p className="break-words">
            {t("requests.reviewNotes")}: {request.reviewNotes}
          </p>
        )}
        {request.executedAt && (
          <p>
            {t("requests.executedBy", {
              name: request.executedByName ?? unknownUser,
            })}{" "}
            · {formatMovementTime(locale, request.executedAt)}
          </p>
        )}
        {request.executionNotes && (
          <p className="break-words">
            {t("requests.executionNotes")}: {request.executionNotes}
          </p>
        )}
      </div>

      {request.conflicts.length > 0 && (
        <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-3">
          <p className="text-xs font-medium">{t("requests.conflictsTitle")}</p>
          <ul className="space-y-2 text-xs">
            {request.conflicts.map((conflict) => (
              <li key={conflict.detectedAt}>
                <p className="text-white/60">
                  {t("requests.conflictObserved", {
                    date: formatMovementTime(locale, conflict.detectedAt),
                    location: locationLabel(conflict.observedFromLocationName),
                    name: conflict.detectedByName ?? unknownUser,
                  })}
                </p>
                <ul className="list-disc pl-4">
                  {conflict.issues.map((issue) => (
                    <li key={issue.type}>{movementIssueLabel(t, issue)}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}

      {canManage && isOpen && (
        <div className="space-y-3 border-t border-white/10 pt-3">
          {isReviewable && currentIssues.length > 0 && (
            <div
              className="space-y-1 text-sm text-amber-500"
              aria-live="polite"
            >
              <p className="text-xs font-medium">
                {t("requests.currentIssues")}
              </p>
              <ul className="list-disc pl-4">
                {currentIssues.map((issue) => (
                  <li key={issue.type}>{movementIssueLabel(t, issue)}</li>
                ))}
              </ul>
            </div>
          )}
          {isReviewable && canOverride && (
            <div className="flex items-center gap-2">
              <Checkbox
                id={`override-${request._id}`}
                checked={override}
                onCheckedChange={(checked) => setOverride(checked === true)}
              />
              <Label htmlFor={`override-${request._id}`} className="text-sm">
                {t("dialog.override")}
              </Label>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor={`notes-${request._id}`}>
              {request.status === "approved"
                ? t("requests.executionNotes")
                : t("requests.reviewNotes")}
            </Label>
            <Textarea
              id={`notes-${request._id}`}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={
                request.status === "approved"
                  ? t("requests.executionNotesPlaceholder")
                  : t("requests.reviewNotesPlaceholder")
              }
              rows={2}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {isReviewable && (
              <>
                <Button
                  size="sm"
                  onClick={handleApprove}
                  disabled={
                    pending !== null ||
                    currentCheck === undefined ||
                    (currentIssues.length > 0 && !(canOverride && override))
                  }
                >
                  {spinner("approve")}
                  {request.status === "conflict"
                    ? t("requests.reapprove")
                    : t("requests.approve")}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleReject}
                  disabled={pending !== null}
                >
                  {spinner("reject")}
                  {t("requests.reject")}
                </Button>
              </>
            )}
            {request.status === "approved" && (
              <Button
                size="sm"
                onClick={handleExecute}
                disabled={pending !== null}
              >
                {spinner("execute")}
                {t("requests.execute")}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancel}
              disabled={pending !== null}
            >
              {spinner("cancel")}
              {t("requests.cancel")}
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
