"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import {
  PROVENANCE_CONFIDENCES,
  PROVENANCE_METHODS,
  PROVENANCE_ROLES,
  type ProvenanceConfidence,
  type ProvenancePartyKind,
} from "@v1/backend/convex/utils/provenanceValidators";
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
import { Plus, Trash2 } from "lucide-react";
import type { Dispatch } from "react";
import { PartyPicker } from "@/components/party-picker";
import { useScopedI18n } from "@/locales/client";
import type { ClaimFormAction, ClaimFormState } from "./claim-form-state";
import { EvidenceFields, type EvidenceFile } from "./evidence-fields";
import { PartialDateFields } from "./partial-date-fields";

const PARTY_KINDS: ProvenancePartyKind[] = ["named", "anonymous", "unknown"];

interface SectionProps {
  state: ClaimFormState;
  update: (patch: Partial<ClaimFormState>) => void;
  disabled: boolean;
}

/** Who held the Object: named, anonymous or unknown, and in what role. */
export function ClaimHolderFields({
  state,
  update,
  disabled,
  organizationId,
  canLinkParties,
}: SectionProps & {
  organizationId: Id<"organizations">;
  canLinkParties: boolean;
}) {
  const t = useScopedI18n("provenance");
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="claim-party-kind">{t("form.partyKind")}</Label>
          <Select
            value={state.partyKind}
            disabled={disabled}
            onValueChange={(partyKind) =>
              update({ partyKind: partyKind as ProvenancePartyKind })
            }
          >
            <SelectTrigger id="claim-party-kind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PARTY_KINDS.map((kind) => (
                <SelectItem key={kind} value={kind}>
                  {t(`partyKinds.${kind}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="claim-role">{t("form.role")}</Label>
          <Select
            value={state.role}
            disabled={disabled}
            onValueChange={(role) =>
              update({ role: role as ClaimFormState["role"] })
            }
          >
            <SelectTrigger id="claim-role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("form.roleNotStated")}</SelectItem>
              {PROVENANCE_ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {t(`roles.${role}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {state.partyKind === "unknown" ? null : (
        <div className="space-y-1.5">
          <Label htmlFor="claim-party-text">
            {state.partyKind === "named"
              ? t("form.partyText")
              : t("form.partyDescription")}
          </Label>
          <Input
            id="claim-party-text"
            value={state.partyText}
            placeholder={
              state.partyKind === "anonymous"
                ? t("form.partyDescriptionPlaceholder")
                : undefined
            }
            disabled={disabled}
            onChange={(event) => update({ partyText: event.target.value })}
          />
        </div>
      )}
      {state.partyKind === "named" &&
      canLinkParties &&
      state.role === "none" ? (
        <p className="text-xs text-muted-foreground">
          {t("form.identifyNeedsRole")}
        </p>
      ) : null}
      {state.partyKind === "named" &&
      canLinkParties &&
      state.role !== "none" ? (
        <div className="space-y-1.5">
          <Label htmlFor="claim-party">{t("form.identifyParty")}</Label>
          <PartyPicker
            id="claim-party"
            organizationId={organizationId}
            value={state.partyId}
            disabled={disabled}
            onChange={(party) => update({ partyId: party?._id })}
          />
        </div>
      ) : null}
    </>
  );
}

/** How and when: method, place, partial dates, confidence, contradiction. */
export function ClaimDetailFields({
  state,
  update,
  disabled,
  contradictable,
}: SectionProps & {
  contradictable: Array<{ _id: Id<"provenanceClaims">; statement: string }>;
}) {
  const t = useScopedI18n("provenance");
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="claim-method">{t("form.method")}</Label>
          <Select
            value={state.method}
            disabled={disabled}
            onValueChange={(method) =>
              update({ method: method as ClaimFormState["method"] })
            }
          >
            <SelectTrigger id="claim-method">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("form.methodNotStated")}</SelectItem>
              {PROVENANCE_METHODS.map((method) => (
                <SelectItem key={method} value={method}>
                  {t(`methods.${method}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="claim-place">{t("form.place")}</Label>
          <Input
            id="claim-place"
            value={state.place}
            disabled={disabled}
            onChange={(event) => update({ place: event.target.value })}
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <PartialDateFields
          id="claim-start"
          label={t("form.startDate")}
          value={state.startDate}
          disabled={disabled}
          onChange={(startDate) => update({ startDate })}
        />
        <PartialDateFields
          id="claim-end"
          label={t("form.endDate")}
          value={state.endDate}
          disabled={disabled}
          onChange={(endDate) => update({ endDate })}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="claim-confidence">{t("form.confidence")}</Label>
          <Select
            value={state.confidence}
            disabled={disabled}
            onValueChange={(confidence) =>
              update({ confidence: confidence as ProvenanceConfidence })
            }
          >
            <SelectTrigger id="claim-confidence">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROVENANCE_CONFIDENCES.map((confidence) => (
                <SelectItem key={confidence} value={confidence}>
                  {t(`confidence.${confidence}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {t("form.confidenceHint")}
          </p>
        </div>
        {contradictable.length > 0 ? (
          <div className="space-y-1.5">
            <Label htmlFor="claim-contradicts">{t("form.contradicts")}</Label>
            <Select
              value={state.contradictsClaimId}
              disabled={disabled}
              onValueChange={(value) =>
                update({
                  contradictsClaimId:
                    value as ClaimFormState["contradictsClaimId"],
                })
              }
            >
              <SelectTrigger id="claim-contradicts">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  {t("form.contradictsNone")}
                </SelectItem>
                {contradictable.map((claim) => (
                  <SelectItem key={claim._id} value={claim._id}>
                    <span className="line-clamp-1 max-w-[260px]">
                      {claim.statement}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>
    </>
  );
}

/** New sources entered with the claim; corrections carry the old ones. */
export function ClaimEvidenceList({
  state,
  dispatch,
  files,
  isCorrection,
  disabled,
}: {
  state: ClaimFormState;
  disabled: boolean;
  dispatch: Dispatch<ClaimFormAction>;
  files: EvidenceFile[] | undefined;
  isCorrection: boolean;
}) {
  const t = useScopedI18n("provenance");
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{t("form.evidence")}</p>
      {isCorrection ? (
        <p className="text-xs text-muted-foreground">
          {t("form.evidenceCarried")}
        </p>
      ) : null}
      {state.evidence.map(({ key, draft }) => (
        <div
          key={key}
          className="space-y-2 rounded-lg border border-border/60 p-3"
        >
          <EvidenceFields
            id={`claim-evidence-${key}`}
            value={draft}
            files={files}
            disabled={disabled}
            onChange={(next) =>
              dispatch({ type: "updateEvidence", key, draft: next })
            }
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={disabled}
            onClick={() => dispatch({ type: "removeEvidence", key })}
          >
            <Trash2 className="size-4" />
            {t("evidence.remove")}
          </Button>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled}
        onClick={() => dispatch({ type: "addEvidence" })}
      >
        <Plus className="size-4" />
        {t("evidence.add")}
      </Button>
    </div>
  );
}
