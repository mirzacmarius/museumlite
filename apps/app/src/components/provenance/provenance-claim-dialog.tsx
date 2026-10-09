"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import { useMutation } from "convex/react";
import { useReducer } from "react";
import { toast } from "sonner";
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
import { DialogForm, useSubmit } from "./provenance-claim-dialogs";

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
  const recordClaim = useMutation(api.provenance.recordClaim);
  const correctClaim = useMutation(api.provenance.correctClaim);
  const { isSaving, submit } = useSubmit(onClose);
  const [state, dispatch] = useReducer(
    claimFormReducer,
    defaults,
    initialClaimFormState,
  );
  const update = (patch: Partial<ClaimFormState>) =>
    dispatch({ type: "update", patch });

  const save = () => {
    const result = claimInputFromForm(state, {
      canLinkParties,
      isCorrection: corrects !== undefined,
    });
    if ("problem" in result) {
      toast.error(t(`form.${result.problem}`));
      return;
    }
    const { claim } = result;
    void submit(
      () =>
        corrects
          ? correctClaim({
              claimId: corrects,
              reason: state.reason.trim(),
              ...claim,
            })
          : recordClaim({
              objectId,
              ...claim,
              partyAccountId: claim.partyAccountId ?? undefined,
            }),
      corrects ? t("form.corrected") : t("form.recorded"),
    );
  };

  return (
    <DialogForm
      wide
      title={corrects ? t("form.correctTitle") : t("form.recordTitle")}
      description={
        corrects ? t("form.correctDescription") : t("form.recordDescription")
      }
      submitLabel={isSaving ? t("form.saving") : t("form.save")}
      isSaving={isSaving}
      onSubmit={save}
      onClose={onClose}
    >
      {corrects ? (
        <div className="space-y-1.5">
          <Label htmlFor="claim-reason">{t("form.reason")}</Label>
          <Input
            id="claim-reason"
            value={state.reason}
            placeholder={t("form.reasonPlaceholder")}
            disabled={isSaving}
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
          disabled={isSaving}
          rows={3}
          onChange={(event) => update({ statement: event.target.value })}
        />
      </div>
      <ClaimHolderFields
        state={state}
        update={update}
        disabled={isSaving}
        organizationId={organizationId}
        canLinkParties={canLinkParties}
      />
      <ClaimDetailFields
        state={state}
        update={update}
        disabled={isSaving}
        contradictable={currentClaims.filter((claim) => claim._id !== corrects)}
      />
      <ClaimEvidenceList
        state={state}
        dispatch={dispatch}
        files={files}
        isCorrection={corrects !== undefined}
        disabled={isSaving}
      />
    </DialogForm>
  );
}
