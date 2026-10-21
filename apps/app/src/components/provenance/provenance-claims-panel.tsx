"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useMutation, useQuery } from "convex/react";
import { Plus, ScrollText } from "lucide-react";
import { useState } from "react";
import { usePermissions } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";
import type { ClaimDefaults } from "./claim-form-state";
import {
  type ClaimAction,
  ProvenanceClaimCard,
  type ProvenanceClaimView,
} from "./provenance-claim-card";
import { ProvenanceClaimDialog } from "./provenance-claim-dialog";
import {
  AddEvidenceDialog,
  IdentifyHolderDialog,
  ReasonDialog,
  ReviewClaimDialog,
} from "./provenance-claim-dialogs";
import {
  type LegacyOwnershipEntry,
  ProvenanceLegacyText,
} from "./provenance-legacy-text";

type OpenDialog = ClaimAction | { kind: "record"; defaults?: ClaimDefaults };

function correctionDefaults(
  claim: ProvenanceClaimView,
  current: ProvenanceClaimView[],
): ClaimDefaults {
  return {
    statement: claim.statement,
    role: claim.role,
    partyKind: claim.partyKind,
    partyText: claim.partyText,
    partyId: claim.party?.accountId,
    method: claim.method,
    place: claim.place,
    startDate: claim.startDate,
    endDate: claim.endDate,
    confidence: claim.confidence,
    // Re-target the current version of the contradicted claim, if any.
    contradictsClaimId: current.some(
      (other) => other._id === claim.contradicts?.claimId,
    )
      ? claim.contradicts?.claimId
      : undefined,
  };
}

const READ_ONLY_VIEWER = {
  canRecord: false,
  canReview: false,
  canLinkParties: false,
};

interface ProvenanceClaimsPanelProps {
  mode: "view" | "edit";
  objectId: Id<"collections">;
  organizationId: Id<"organizations">;
  legacyProvenance?: string;
  legacyOwnership?: LegacyOwnershipEntry[];
}

/**
 * An Object's provenance claims: capture, evidence, review, correction and
 * retraction, with superseded claims kept below the current ones.
 */
export function ProvenanceClaimsPanel({
  mode,
  objectId,
  organizationId,
  legacyProvenance,
  legacyOwnership,
}: ProvenanceClaimsPanelProps) {
  const t = useScopedI18n("provenance");
  const { hasPermission } = usePermissions();
  const provenance = useQuery(api.provenance.listForObject, { objectId });
  const viewer =
    mode === "edit" && provenance ? provenance.viewer : READ_ONLY_VIEWER;
  const media = useQuery(
    api.media.list,
    viewer.canRecord && hasPermission("media.read")
      ? { collectionId: objectId }
      : "skip",
  );
  const retractClaim = useMutation(api.provenance.retractClaim);
  const retractEvidence = useMutation(api.provenance.retractEvidence);
  const endPartyLink = useMutation(api.partyLinks.supersede);
  const [dialog, setDialog] = useState<OpenDialog | null>(null);
  const close = () => setDialog(null);

  if (provenance === undefined) {
    return <p className="text-sm text-muted-foreground">{t("loading")}</p>;
  }
  if (provenance === null) return null;

  const { claims } = provenance;
  const current = claims.filter((claim) => claim.isCurrent);
  const earlier = claims.filter((claim) => !claim.isCurrent);
  const statements = new Map(
    claims.map((claim) => [claim._id, claim.statement] as const),
  );
  const files = media?.flatMap((file) =>
    file.uploadStatus === "completed"
      ? [{ _id: file._id, fileName: file.fileName }]
      : [],
  );
  const cardProps = {
    statements,
    canRecord: viewer.canRecord,
    canReview: viewer.canReview,
    canLinkParties: viewer.canLinkParties,
    onAction: setDialog,
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="flex items-center gap-2 text-xs font-medium text-foreground">
            <ScrollText className="size-4 text-purple-500" />
            {t("title")}
          </h3>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {t("description")}
          </p>
        </div>
        {viewer.canRecord ? (
          <Button
            type="button"
            size="sm"
            onClick={() => setDialog({ kind: "record" })}
          >
            <Plus className="size-4" />
            {t("record")}
          </Button>
        ) : null}
      </div>

      {provenance.objectWithdrawn ? (
        <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-muted-foreground">
          {t("withdrawn")}
        </p>
      ) : null}

      {provenance.provenanceArriving ? (
        <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-muted-foreground">
          {t("arriving")}
        </p>
      ) : null}

      {current.length === 0 ? (
        <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-border">
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        </div>
      ) : (
        <ol className="space-y-3">
          {current.map((claim) => (
            <ProvenanceClaimCard key={claim._id} claim={claim} {...cardProps} />
          ))}
        </ol>
      )}

      {earlier.length > 0 ? (
        <details className="rounded-lg border border-border/60 p-3">
          <summary className="cursor-pointer text-sm font-medium">
            {t("history", { count: earlier.length })}
          </summary>
          <ul className="mt-3 space-y-3">
            {earlier.map((claim) => (
              <ProvenanceClaimCard
                key={claim._id}
                claim={claim}
                {...cardProps}
              />
            ))}
          </ul>
        </details>
      ) : null}

      {provenance.truncated ? (
        <p className="text-xs text-muted-foreground">
          {t("truncated", { count: claims.length })}
        </p>
      ) : null}

      <ProvenanceLegacyText
        provenance={legacyProvenance}
        ownershipHistory={legacyOwnership}
        canRecord={viewer.canRecord}
        onRecord={(defaults) => setDialog({ kind: "record", defaults })}
      />

      {dialog?.kind === "record" || dialog?.kind === "correct" ? (
        <ProvenanceClaimDialog
          onClose={close}
          objectId={objectId}
          organizationId={organizationId}
          currentClaims={current}
          canLinkParties={viewer.canLinkParties}
          files={files}
          defaults={
            dialog.kind === "correct"
              ? correctionDefaults(dialog.claim, current)
              : dialog.defaults
          }
          corrects={dialog.kind === "correct" ? dialog.claim._id : undefined}
        />
      ) : null}
      {dialog?.kind === "review" ? (
        <ReviewClaimDialog
          claimId={dialog.claim._id}
          initialDecision={
            dialog.claim.reviewStatus === "unreviewed"
              ? undefined
              : dialog.claim.reviewStatus
          }
          initialNote={dialog.claim.reviewNote}
          onClose={close}
        />
      ) : null}
      {dialog?.kind === "identify" && dialog.claim.role ? (
        <IdentifyHolderDialog
          claimId={dialog.claim._id}
          role={dialog.claim.role}
          organizationId={organizationId}
          onClose={close}
        />
      ) : null}
      {dialog?.kind === "addEvidence" ? (
        <AddEvidenceDialog
          claimId={dialog.claimId}
          files={files}
          onClose={close}
        />
      ) : null}
      {dialog?.kind === "retract" ? (
        <ReasonDialog
          title={t("retract.title")}
          description={t("retract.description")}
          label={t("retract.reason")}
          confirmLabel={t("retract.confirm")}
          success={t("retract.done")}
          onConfirm={(reason) =>
            retractClaim({ claimId: dialog.claimId, reason })
          }
          onClose={close}
        />
      ) : null}
      {dialog?.kind === "retractEvidence" ? (
        <ReasonDialog
          title={t("evidence.retractConfirm")}
          description={t("evidence.retractDescription")}
          label={t("evidence.retractReason")}
          confirmLabel={t("evidence.retractConfirm")}
          success={t("evidence.retractedToast")}
          onConfirm={(reason) =>
            retractEvidence({ evidenceId: dialog.evidenceId, reason })
          }
          onClose={close}
        />
      ) : null}
      {dialog?.kind === "unidentify" ? (
        <ReasonDialog
          title={t("identify.remove")}
          description={t("identify.description")}
          label={t("identify.removeReason")}
          confirmLabel={t("identify.removeConfirm")}
          success={t("identify.removed")}
          onConfirm={(reason) =>
            endPartyLink({ linkId: dialog.linkId, reason })
          }
          onClose={close}
        />
      ) : null}
    </section>
  );
}
