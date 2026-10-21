"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import type {
  TransferAction,
  TransferViewerAction,
} from "@v1/backend/convex/utils/transferStages";
import { Button } from "@v1/ui/button";
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
import { Loader2 } from "lucide-react";
import { createContext, type ReactNode, use, useMemo } from "react";
import type { AccessionMode } from "@/components/deaccession-dialog-types";
import { LocationSelector } from "@/components/location-selector";
import { useI18n, useScopedI18n } from "@/locales/client";
import type { MoveRequestSubmitAction } from "./use-move-request-detail";

/** One side of the transfer: the sending or the receiving organization. */
interface MoveRequestSide {
  id: Id<"organizations">;
  name: string;
}

interface MoveRequestActionsPanelContextValue {
  reviewNotes: string;
  onReviewNotesChange: (value: string) => void;
  targetLocationId: string;
  onTargetLocationChange: (value: string) => void;
  receiverTracksLocations: boolean;
  sourceAccessionNumber: string;
  accessionMode: AccessionMode;
  onAccessionModeChange: (value: AccessionMode) => void;
  manualAccessionNumber: string;
  onManualAccessionNumberChange: (value: string) => void;
  submittingAction: MoveRequestSubmitAction;
  actions: TransferViewerAction[];
  sender: MoveRequestSide;
  receiver: MoveRequestSide;
  onApprove: () => void;
  onAccept: () => void;
  onDecline: () => void;
  onCancel: () => void;
}

const MoveRequestActionsPanelContext =
  createContext<MoveRequestActionsPanelContextValue | null>(null);

function useMoveRequestActionsPanel() {
  const context = use(MoveRequestActionsPanelContext);
  if (!context) {
    throw new Error(
      "MoveRequestActionsPanel subcomponents must be used within MoveRequestActionsPanel",
    );
  }
  return context;
}

/** Whether the viewer may take `action` for `side`. */
function offers(
  actions: TransferViewerAction[],
  action: TransferAction,
  side: MoveRequestSide,
) {
  return actions.some(
    (offered) =>
      offered.action === action && offered.organizationId === side.id,
  );
}

interface MoveRequestActionsPanelProps
  extends MoveRequestActionsPanelContextValue {
  children?: ReactNode;
}

/**
 * The decisions the backend offers the viewer, grouped by the organization
 * each one acts for, so an administrator of both organizations sees which
 * side every button decides for.
 */
function MoveRequestActionsPanelProvider({
  reviewNotes,
  onReviewNotesChange,
  targetLocationId,
  onTargetLocationChange,
  receiverTracksLocations,
  sourceAccessionNumber,
  accessionMode,
  onAccessionModeChange,
  manualAccessionNumber,
  onManualAccessionNumberChange,
  submittingAction,
  actions,
  sender,
  receiver,
  onApprove,
  onAccept,
  onDecline,
  onCancel,
  children,
}: MoveRequestActionsPanelProps) {
  const tRoot = useI18n();
  const value = useMemo(
    () => ({
      reviewNotes,
      onReviewNotesChange,
      targetLocationId,
      onTargetLocationChange,
      receiverTracksLocations,
      sourceAccessionNumber,
      accessionMode,
      onAccessionModeChange,
      manualAccessionNumber,
      onManualAccessionNumberChange,
      submittingAction,
      actions,
      sender,
      receiver,
      onApprove,
      onAccept,
      onDecline,
      onCancel,
    }),
    [
      reviewNotes,
      onReviewNotesChange,
      targetLocationId,
      onTargetLocationChange,
      receiverTracksLocations,
      sourceAccessionNumber,
      accessionMode,
      onAccessionModeChange,
      manualAccessionNumber,
      onManualAccessionNumberChange,
      submittingAction,
      actions,
      sender,
      receiver,
      onApprove,
      onAccept,
      onDecline,
      onCancel,
    ],
  );

  if (actions.length === 0) {
    return null;
  }

  const showReviewNotes = actions.some((action) => action.takesNotes);

  return (
    <MoveRequestActionsPanelContext.Provider value={value}>
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">
          {tRoot("collections.mediaImport.tableHeaders.actions")}
        </h2>
        <div className="mt-4 space-y-4">
          {showReviewNotes && (
            <div className="space-y-2">
              <Label htmlFor="reviewNotes">
                {tRoot("untranslatedRecords.accessions.transfer.reviewNotes")}
              </Label>
              <Textarea
                id="reviewNotes"
                value={reviewNotes}
                onChange={(event) => onReviewNotesChange(event.target.value)}
                placeholder={tRoot(
                  "untranslatedRecords.objects.detail.additionalNotesHint",
                )}
                rows={4}
              />
            </div>
          )}

          {children ?? (
            <>
              <MoveRequestActionsPanel.ReceiverActions />
              <MoveRequestActionsPanel.SenderActions />
            </>
          )}
        </div>
      </div>
    </MoveRequestActionsPanelContext.Provider>
  );
}

/** The decisions taken for one organization, captioned with its name. */
function MoveRequestActionsPanelGroup({
  side,
  children,
}: {
  side: MoveRequestSide;
  children: ReactNode;
}) {
  const tMoves = useScopedI18n("moveRequests");
  return (
    <fieldset className="min-w-0 space-y-3">
      <legend className="text-sm font-medium text-muted-foreground">
        {tMoves("actingFor", { organization: side.name })}
      </legend>
      <div className="flex flex-wrap gap-3">{children}</div>
    </fieldset>
  );
}

/**
 * The sender's administrators approve; they, or the requester before
 * approval, stop the transfer with Cancel. Declining is the receiver's.
 */
function MoveRequestActionsPanelSenderActions() {
  const tRoot = useI18n();
  const { submittingAction, actions, sender, onApprove, onCancel } =
    useMoveRequestActionsPanel();
  const approve = offers(actions, "approve", sender);
  const cancel = offers(actions, "cancel", sender);

  if (!approve && !cancel) return null;

  return (
    <MoveRequestActionsPanelGroup side={sender}>
      {approve && (
        <Button onClick={onApprove} disabled={submittingAction !== null}>
          {submittingAction === "approve" && (
            <Loader2 className="mr-2 size-4 animate-spin" />
          )}
          {tRoot("untranslatedRecords.objects.move.approve")}
        </Button>
      )}
      {cancel && (
        <Button
          variant="destructive"
          onClick={onCancel}
          disabled={submittingAction !== null}
        >
          {submittingAction === "cancel" && (
            <Loader2 className="mr-2 size-4 animate-spin" />
          )}
          {tRoot("untranslatedRecords.objects.move.cancel")}
        </Button>
      )}
    </MoveRequestActionsPanelGroup>
  );
}

function MoveRequestActionsPanelReceiverActions() {
  const tRoot = useI18n();
  const {
    submittingAction,
    actions,
    receiver,
    onAccept,
    onDecline,
    targetLocationId,
    onTargetLocationChange,
    receiverTracksLocations,
  } = useMoveRequestActionsPanel();
  const accept = offers(actions, "accept", receiver);
  const decline = offers(actions, "decline", receiver);

  if (!accept && !decline) return null;

  return (
    <MoveRequestActionsPanelGroup side={receiver}>
      {accept && (
        <>
          <MoveRequestActionsPanelAccessionChoice />
          {receiverTracksLocations ? (
            <div className="w-full space-y-2">
              <Label htmlFor="receiving-location">
                {tRoot(
                  "untranslatedRecords.objects.transfer.receivingLocation",
                )}
              </Label>
              <LocationSelector
                id="receiving-location"
                organizationId={receiver.id}
                value={targetLocationId}
                onValueChange={onTargetLocationChange}
                placeholder={tRoot(
                  "untranslatedRecords.objects.transfer.receivingLocationPlaceholder",
                )}
                aria-describedby="receiving-location-hint"
              />
              <p
                id="receiving-location-hint"
                className="text-xs text-muted-foreground"
              >
                {tRoot(
                  "untranslatedRecords.objects.transfer.receivingLocationHint",
                )}
              </p>
            </div>
          ) : null}
          <Button onClick={onAccept} disabled={submittingAction !== null}>
            {submittingAction === "accept" && (
              <Loader2 className="mr-2 size-4 animate-spin" />
            )}
            {tRoot("untranslatedRecords.objects.move.accept")}
          </Button>
        </>
      )}
      {decline && (
        <Button
          variant="destructive"
          onClick={onDecline}
          disabled={submittingAction !== null}
        >
          {submittingAction === "decline" && (
            <Loader2 className="mr-2 size-4 animate-spin" />
          )}
          {tRoot("untranslatedRecords.objects.move.reject")}
        </Button>
      )}
    </MoveRequestActionsPanelGroup>
  );
}

/** The receiving organization decides the object's accession number here. */
function MoveRequestActionsPanelAccessionChoice() {
  const t = useScopedI18n("moveRequests.accession");
  const {
    sourceAccessionNumber,
    accessionMode,
    onAccessionModeChange,
    manualAccessionNumber,
    onManualAccessionNumberChange,
  } = useMoveRequestActionsPanel();

  return (
    <div className="w-full space-y-2">
      <Label htmlFor="accession-mode">{t("label")}</Label>
      <Select
        value={accessionMode}
        onValueChange={(value) => onAccessionModeChange(value as AccessionMode)}
      >
        <SelectTrigger id="accession-mode">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="keep">
            {t("keep", { number: sourceAccessionNumber })}
          </SelectItem>
          <SelectItem value="auto">{t("auto")}</SelectItem>
          <SelectItem value="manual">{t("manual")}</SelectItem>
        </SelectContent>
      </Select>
      {accessionMode === "manual" && (
        <div className="space-y-2 pt-2">
          <Label htmlFor="manual-accession-number">{t("manualLabel")}</Label>
          <Input
            id="manual-accession-number"
            value={manualAccessionNumber}
            onChange={(event) =>
              onManualAccessionNumberChange(event.target.value)
            }
            placeholder={t("manualPlaceholder")}
          />
        </div>
      )}
      <p className="text-xs text-muted-foreground">{t("hint")}</p>
    </div>
  );
}

export const MoveRequestActionsPanel = Object.assign(
  MoveRequestActionsPanelProvider,
  {
    SenderActions: MoveRequestActionsPanelSenderActions,
    ReceiverActions: MoveRequestActionsPanelReceiverActions,
  },
);
