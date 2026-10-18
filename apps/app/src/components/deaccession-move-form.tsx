"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import type { EligibilityBlockerCode } from "@v1/backend/convex/utils/objectMoveErrors";
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
import { AlertTriangle, CheckCircle } from "lucide-react";
import { useMoveBlockerMessage } from "@/hooks/use-object-move-error-message";
import { useI18n } from "@/locales/client";
import type { AccessionMode } from "./deaccession-dialog-types";
import { TransferDestinationPicker } from "./transfer-destination-picker";

interface MoveBlocker {
  code: EligibilityBlockerCode;
}

interface DeaccessionMoveFormProps {
  isDirectRemovalFlow: boolean;
  collectionId: Id<"collections">;
  blockers: MoveBlocker[];
  targetOrganizationId: Id<"organizations"> | "";
  accessionMode: AccessionMode;
  manualAccessionNumber: string;
  reason: string;
  notes: string;
  onBack: () => void;
  onTargetOrganizationChange: (id: Id<"organizations">) => void;
  onAccessionModeChange: (mode: AccessionMode) => void;
  onManualAccessionNumberChange: (value: string) => void;
  onReasonChange: (reason: string) => void;
  onNotesChange: (notes: string) => void;
}

export function DeaccessionMoveForm({
  isDirectRemovalFlow,
  collectionId,
  blockers,
  targetOrganizationId,
  accessionMode,
  manualAccessionNumber,
  reason,
  notes,
  onBack,
  onTargetOrganizationChange,
  onAccessionModeChange,
  onManualAccessionNumberChange,
  onReasonChange,
  onNotesChange,
}: DeaccessionMoveFormProps) {
  const translate = useI18n();
  const blockerMessage = useMoveBlockerMessage();
  return (
    <div className="space-y-4 py-4">
      {!isDirectRemovalFlow && (
        <Button variant="ghost" size="sm" onClick={onBack} className="mb-2">
          {translate("untranslatedComponents.labels.backToOptions")}
        </Button>
      )}

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
        <div className="flex items-start gap-3">
          <CheckCircle className="mt-0.5 size-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
          <div className="text-sm">
            <p className="font-medium text-blue-900 dark:text-blue-100">
              {translate(
                "untranslatedComponents.labels.administratorApprovalRequired",
              )}
            </p>
            <p className="mt-1 text-blue-700 dark:text-blue-300">
              {translate(
                "untranslatedComponents.labels.theObjectWillRemainInItsCurrentOrganizationUntilASourceOrganizationAdministratorApprovesTheMove",
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>
          {translate("untranslatedComponents.labels.destinationOrganization")}
        </Label>
        <TransferDestinationPicker
          collectionId={collectionId}
          value={targetOrganizationId}
          onValueChange={onTargetOrganizationChange}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="move-reason">
          {translate("untranslatedComponents.labels.reasonForMove")}
        </Label>
        <Textarea
          id="move-reason"
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
          placeholder={translate(
            "untranslatedComponents.labels.explainWhyThisObjectShouldBeMovedToAnotherOrganization",
          )}
          rows={4}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="accession-mode">
          {translate("untranslatedComponents.labels.accessionNumberHandling")}
        </Label>
        <Select
          value={accessionMode}
          onValueChange={(value) =>
            onAccessionModeChange(value as AccessionMode)
          }
        >
          <SelectTrigger id="accession-mode">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="keep">
              {translate(
                "untranslatedComponents.labels.keepCurrentAccessionNumber",
              )}
            </SelectItem>
            <SelectItem value="auto">
              {translate(
                "untranslatedComponents.labels.generateANewAccessionNumber",
              )}
            </SelectItem>
            <SelectItem value="manual">
              {translate(
                "untranslatedComponents.labels.enterANewAccessionNumberManually",
              )}
            </SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {translate(
            "untranslatedComponents.labels.ifYouAssignANewAccessionNumberTheCurrentOneWillBeStoredInAlternateAccessionNumbers",
          )}
        </p>
      </div>

      {accessionMode === "manual" && (
        <div className="space-y-2">
          <Label htmlFor="manual-accession-number">
            {translate("untranslatedComponents.labels.newAccessionNumber")}
          </Label>
          <Input
            id="manual-accession-number"
            value={manualAccessionNumber}
            onChange={(event) =>
              onManualAccessionNumberChange(event.target.value)
            }
            placeholder={translate(
              "untranslatedComponents.labels.enterTheNewAccessionNumber",
            )}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="move-notes">
          {translate("untranslatedComponents.labels.additionalNotes")}
        </Label>
        <Textarea
          id="move-notes"
          value={notes}
          onChange={(event) => onNotesChange(event.target.value)}
          placeholder={translate(
            "untranslatedComponents.labels.addAnyContextForTheReviewingAdministrator",
          )}
          rows={3}
        />
      </div>

      {blockers.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="space-y-2 text-sm">
              <p className="font-medium text-amber-900 dark:text-amber-100">
                {translate(
                  "untranslatedComponents.labels.thisObjectCannotBeMovedYet",
                )}
              </p>
              <ul className="list-disc space-y-1 pl-4 text-amber-700 dark:text-amber-300">
                {blockers.map((blocker) => (
                  <li key={blocker.code}>{blockerMessage(blocker.code)}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
