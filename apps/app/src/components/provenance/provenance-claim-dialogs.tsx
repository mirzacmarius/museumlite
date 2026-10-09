"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import type {
  ProvenanceReviewDecision,
  ProvenanceRole,
} from "@v1/backend/convex/utils/provenanceValidators";
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
import { RadioGroup, RadioGroupItem } from "@v1/ui/radio-group";
import { Textarea } from "@v1/ui/textarea";
import { cn } from "@v1/ui/utils";
import { useMutation } from "convex/react";
import { type FormEvent, type ReactNode, useState } from "react";
import { toast } from "sonner";
import { PartyPicker } from "@/components/party-picker";
import { useProvenanceErrorMessage } from "@/hooks/use-provenance-error-message";
import { useScopedI18n } from "@/locales/client";
import {
  EMPTY_EVIDENCE,
  EvidenceFields,
  type EvidenceFile,
  evidenceInputFromDraft,
} from "./evidence-fields";

interface DialogFormProps {
  title: string;
  /** Wider dialog for the claim form. */
  wide?: boolean;
  description: string;
  submitLabel: string;
  submitVariant?: "default" | "destructive";
  submitDisabled?: boolean;
  isSaving: boolean;
  onSubmit: () => void;
  onClose: () => void;
  children: ReactNode;
}

/** A provenance dialog: its fields, then cancel and submit. */
export function DialogForm({
  title,
  wide = false,
  description,
  submitLabel,
  submitVariant = "default",
  submitDisabled = false,
  isSaving,
  onSubmit,
  onClose,
  children,
}: DialogFormProps) {
  const t = useScopedI18n("provenance.form");
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent
        className={cn(
          "max-h-[90vh] overflow-y-auto",
          wide ? "sm:max-w-[640px]" : "sm:max-w-[520px]",
        )}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          {children}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={isSaving}
              onClick={onClose}
            >
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              variant={submitVariant}
              disabled={isSaving || submitDisabled}
            >
              {submitLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Runs a mutation, reporting success or a translated failure. */
export function useSubmit(onClose: () => void) {
  const errorMessage = useProvenanceErrorMessage();
  const [isSaving, setIsSaving] = useState(false);
  const submit = async (action: () => Promise<unknown>, success: string) => {
    setIsSaving(true);
    try {
      await action();
      toast.success(success);
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
      setIsSaving(false);
    }
  };
  return { isSaving, submit };
}

/** Asks for the reason a claim, evidence item or identification ends. */
export function ReasonDialog({
  title,
  description,
  label,
  confirmLabel,
  success,
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  label: string;
  confirmLabel: string;
  success: string;
  onConfirm: (reason: string) => Promise<unknown>;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const { isSaving, submit } = useSubmit(onClose);
  return (
    <DialogForm
      title={title}
      description={description}
      submitLabel={confirmLabel}
      submitVariant="destructive"
      submitDisabled={!reason.trim()}
      isSaving={isSaving}
      onSubmit={() => void submit(() => onConfirm(reason.trim()), success)}
      onClose={onClose}
    >
      <div className="space-y-1.5">
        <Label htmlFor="provenance-reason">{label}</Label>
        <Input
          id="provenance-reason"
          value={reason}
          disabled={isSaving}
          onChange={(event) => setReason(event.target.value)}
        />
      </div>
    </DialogForm>
  );
}

const DECISIONS: ProvenanceReviewDecision[] = [
  "accepted",
  "disputed",
  "rejected",
];

/** A reviewer accepts, disputes or rejects a claim; the claim is unchanged. */
export function ReviewClaimDialog({
  claimId,
  initialDecision,
  initialNote,
  onClose,
}: {
  claimId: Id<"provenanceClaims">;
  initialDecision?: ProvenanceReviewDecision;
  initialNote?: string;
  onClose: () => void;
}) {
  const t = useScopedI18n("provenance.review");
  const reviewClaim = useMutation(api.provenance.reviewClaim);
  const [decision, setDecision] = useState<ProvenanceReviewDecision>(
    initialDecision ?? "accepted",
  );
  const [note, setNote] = useState(initialNote ?? "");
  const { isSaving, submit } = useSubmit(onClose);
  const needsNote = decision !== "accepted";
  const record = () => {
    if (needsNote && !note.trim()) {
      toast.error(t("noteRequired"));
      return;
    }
    void submit(
      () => reviewClaim({ claimId, decision, note: note.trim() || undefined }),
      t("recorded"),
    );
  };

  return (
    <DialogForm
      title={t("title")}
      description={t("description")}
      submitLabel={t("confirm")}
      isSaving={isSaving}
      onSubmit={record}
      onClose={onClose}
    >
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t("decision")}</legend>
        <RadioGroup
          value={decision}
          onValueChange={(value) =>
            setDecision(value as ProvenanceReviewDecision)
          }
          className="flex flex-wrap gap-4"
        >
          {DECISIONS.map((option) => (
            <div key={option} className="flex items-center gap-2">
              <RadioGroupItem
                id={`review-${option}`}
                value={option}
                disabled={isSaving}
              />
              <Label htmlFor={`review-${option}`} className="font-normal">
                {t(`decisions.${option}`)}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </fieldset>
      <div className="space-y-1.5">
        <Label htmlFor="review-note">{t("note")}</Label>
        <Textarea
          id="review-note"
          value={note}
          placeholder={needsNote ? t("notePlaceholder") : undefined}
          disabled={isSaving}
          rows={3}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
    </DialogForm>
  );
}

/** Links the holder a claim names to a Party record. */
export function IdentifyHolderDialog({
  claimId,
  role,
  organizationId,
  onClose,
}: {
  claimId: Id<"provenanceClaims">;
  role: ProvenanceRole;
  organizationId: Id<"organizations">;
  onClose: () => void;
}) {
  const t = useScopedI18n("provenance.identify");
  const link = useMutation(api.partyLinks.link);
  const [partyId, setPartyId] = useState<Id<"accounts">>();
  const { isSaving, submit } = useSubmit(onClose);
  const identify = () => {
    if (!partyId) return;
    void submit(
      () =>
        link({
          target: { type: "provenanceClaim", id: claimId },
          accountId: partyId,
          role,
        }),
      t("linked"),
    );
  };
  return (
    <DialogForm
      title={t("title")}
      description={t("description")}
      submitLabel={t("confirm")}
      submitDisabled={!partyId}
      isSaving={isSaving}
      onSubmit={identify}
      onClose={onClose}
    >
      <div className="space-y-1.5">
        <Label htmlFor="identify-party">{t("party")}</Label>
        <PartyPicker
          id="identify-party"
          organizationId={organizationId}
          value={partyId}
          disabled={isSaving}
          onChange={(party) => setPartyId(party?._id)}
        />
      </div>
    </DialogForm>
  );
}

/** Cites a further source for a current claim. */
export function AddEvidenceDialog({
  claimId,
  files,
  onClose,
}: {
  claimId: Id<"provenanceClaims">;
  files: EvidenceFile[] | undefined;
  onClose: () => void;
}) {
  const t = useScopedI18n("provenance");
  const addEvidence = useMutation(api.provenance.addEvidence);
  const [draft, setDraft] = useState(EMPTY_EVIDENCE);
  const { isSaving, submit } = useSubmit(onClose);
  const add = () => {
    const input = evidenceInputFromDraft(draft);
    if (!input) {
      toast.error(t("form.requiredFields"));
      return;
    }
    void submit(() => addEvidence({ claimId, ...input }), t("evidence.added"));
  };
  return (
    <DialogForm
      title={t("evidence.addTitle")}
      description={t("evidence.addDescription")}
      submitLabel={t("evidence.save")}
      isSaving={isSaving}
      onSubmit={add}
      onClose={onClose}
    >
      <EvidenceFields
        id="add-evidence"
        value={draft}
        files={files}
        disabled={isSaving}
        onChange={setDraft}
      />
    </DialogForm>
  );
}
