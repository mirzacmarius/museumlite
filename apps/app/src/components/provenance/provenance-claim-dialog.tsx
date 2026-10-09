"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import { useMutation } from "convex/react";
import { type FormEvent, useReducer } from "react";
import { toast } from "sonner";
import { useProvenanceErrorMessage } from "@/hooks/use-provenance-error-message";
import { useScopedI18n } from "@/locales/client";
import {
  ClaimDetailFields,
  ClaimEvidenceList,
  ClaimHolderFields,
} from "./claim-form-sections";
import {
  type ClaimDefaults,
  type ClaimFormState,
  claimFormReducer,
  claimInputFromForm,
  initialClaimFormState,
} from "./claim-form-state";
import type { EvidenceFile } from "./evidence-fields";

interface ProvenanceClaimDialogProps {
  onClose: () => void;
  objectId: Id<"collections">;
  organizationId: Id<"organizations">;
  /** Current claims the new claim may contradict. */
  currentClaims: Array<{ _id: Id<"provenanceClaims">; statement: string }>;
  canLinkParties: boolean;
  files: EvidenceFile[] | undefined;
  defaults?: ClaimDefaults;
  /** When set, the form records a correction that supersedes this claim. */
  corrects?: Id<"provenanceClaims">;
}

/**
 * Records a provenance claim, or a correction of one, in its author's
 * wording with partial dates, holder, confidence and evidence.
 */
export function ProvenanceClaimDialog({
  onClose,
  objectId,
  organizationId,
  currentClaims,
  canLinkParties,
  files,
  defaults,
  corrects,
}: ProvenanceClaimDialogProps) {
  const t = useScopedI18n("provenance");
  const errorMessage = useProvenanceErrorMessage();
  const recordClaim = useMutation(api.provenance.recordClaim);
  const correctClaim = useMutation(api.provenance.correctClaim);
  const [state, dispatch] = useReducer(
    claimFormReducer,
    defaults,
    initialClaimFormState,
  );
  const update = (patch: Partial<ClaimFormState>) =>
    dispatch({ type: "update", patch });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = claimInputFromForm(state, {
      canLinkParties,
      isCorrection: corrects !== undefined,
    });
    if ("problem" in result) {
      toast.error(t(`form.${result.problem}`));
      return;
    }
    update({ isSaving: true });
    try {
      if (corrects) {
        await correctClaim({
          claimId: corrects,
          reason: state.reason.trim(),
          ...result.claim,
        });
        toast.success(t("form.corrected"));
      } else {
        await recordClaim({ objectId, ...result.claim });
        toast.success(t("form.recorded"));
      }
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
      update({ isSaving: false });
    }
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>
            {corrects ? t("form.correctTitle") : t("form.recordTitle")}
          </DialogTitle>
          <DialogDescription>
            {corrects
              ? t("form.correctDescription")
              : t("form.recordDescription")}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          {corrects ? (
            <div className="space-y-1.5">
              <Label htmlFor="claim-reason">{t("form.reason")}</Label>
              <Input
                id="claim-reason"
                value={state.reason}
                placeholder={t("form.reasonPlaceholder")}
                disabled={state.isSaving}
                onChange={(event) => update({ reason: event.target.value })}
              />
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="claim-statement">{t("form.statement")}</Label>
            <Textarea
              id="claim-statement"
              value={state.statement}
              placeholder={t("form.statementPlaceholder")}
              disabled={state.isSaving}
              rows={3}
              onChange={(event) => update({ statement: event.target.value })}
            />
          </div>
          <ClaimHolderFields
            state={state}
            update={update}
            organizationId={organizationId}
            canLinkParties={canLinkParties}
          />
          <ClaimDetailFields
            state={state}
            update={update}
            contradictable={currentClaims.filter(
              (claim) => claim._id !== corrects,
            )}
          />
          <ClaimEvidenceList
            state={state}
            dispatch={dispatch}
            files={files}
            isCorrection={corrects !== undefined}
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={state.isSaving}
              onClick={onClose}
            >
              {t("form.cancel")}
            </Button>
            <Button type="submit" disabled={state.isSaving}>
              {state.isSaving ? t("form.saving") : t("form.save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
