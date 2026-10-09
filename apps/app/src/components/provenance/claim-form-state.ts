import type { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import type {
  ProvenanceAssertion,
  ProvenanceConfidence,
  ProvenanceEvidenceInput,
  ProvenanceMethod,
  ProvenancePartyKind,
  ProvenanceRole,
} from "@v1/backend/convex/utils/provenanceValidators";
import type { FunctionArgs } from "convex/server";
import {
  EMPTY_EVIDENCE,
  type EvidenceDraft,
  evidenceInputFromDraft,
} from "./evidence-fields";
import {
  draftFromHistoricalDate,
  historicalDateFromDraft,
  type PartialDateDraft,
} from "./historical-date";

/** What a new or corrected claim starts from. */
export type ClaimDefaults = Partial<ProvenanceAssertion> & {
  partyId?: Id<"accounts">;
  contradictsClaimId?: Id<"provenanceClaims">;
  /** Sources to start from, such as a legacy verification source. */
  evidence?: EvidenceDraft[];
};

export interface ClaimFormState {
  statement: string;
  /** "none" when the source does not state the holder's role. */
  role: ProvenanceRole | "none";
  partyKind: ProvenancePartyKind;
  partyText: string;
  partyId: Id<"accounts"> | undefined;
  method: ProvenanceMethod | "none";
  place: string;
  startDate: PartialDateDraft;
  endDate: PartialDateDraft;
  confidence: ProvenanceConfidence;
  contradictsClaimId: Id<"provenanceClaims"> | "none";
  evidence: Array<{ key: number; draft: EvidenceDraft }>;
  nextEvidenceKey: number;
  reason: string;
}

export type ClaimFormAction =
  | { type: "update"; patch: Partial<ClaimFormState> }
  | { type: "addEvidence" }
  | { type: "updateEvidence"; key: number; draft: EvidenceDraft }
  | { type: "removeEvidence"; key: number };

export function claimFormReducer(
  state: ClaimFormState,
  action: ClaimFormAction,
): ClaimFormState {
  switch (action.type) {
    case "update":
      return { ...state, ...action.patch };
    case "addEvidence":
      return {
        ...state,
        evidence: [
          ...state.evidence,
          { key: state.nextEvidenceKey, draft: EMPTY_EVIDENCE },
        ],
        nextEvidenceKey: state.nextEvidenceKey + 1,
      };
    case "updateEvidence":
      return {
        ...state,
        evidence: state.evidence.map((entry) =>
          entry.key === action.key ? { ...entry, draft: action.draft } : entry,
        ),
      };
    case "removeEvidence":
      return {
        ...state,
        evidence: state.evidence.filter((entry) => entry.key !== action.key),
      };
  }
}

export function initialClaimFormState(
  defaults: ClaimDefaults | undefined,
): ClaimFormState {
  return {
    statement: defaults?.statement ?? "",
    role: defaults?.role ?? "none",
    partyKind: defaults?.partyKind ?? "named",
    partyText: defaults?.partyText ?? "",
    partyId: defaults?.partyId,
    method: defaults?.method ?? "none",
    place: defaults?.place ?? "",
    startDate: draftFromHistoricalDate(defaults?.startDate),
    endDate: draftFromHistoricalDate(defaults?.endDate),
    confidence: defaults?.confidence ?? "unassessed",
    contradictsClaimId: defaults?.contradictsClaimId ?? "none",
    evidence: (defaults?.evidence ?? []).map((draft, key) => ({ key, draft })),
    nextEvidenceKey: defaults?.evidence?.length ?? 0,
    reason: "",
  };
}

function isBlankEvidence(draft: EvidenceDraft) {
  return (
    !draft.citation.trim() &&
    !draft.url.trim() &&
    !draft.mediaId &&
    !draft.excerpt.trim() &&
    !draft.locator.trim()
  );
}

/** The claim fields both capture and correction send. */
export type ClaimInput = Omit<
  FunctionArgs<typeof api.provenance.recordClaim>,
  "objectId" | "partyAccountId"
> & {
  /** null clears an identification; undefined leaves it to the server. */
  partyAccountId?: Id<"accounts"> | null;
};

/**
 * The claim the form states, or why it cannot be sent. Fields that do not
 * apply to the holder kind are dropped; blank evidence rows are ignored.
 */
export function claimInputFromForm(
  state: ClaimFormState,
  options: { canLinkParties: boolean; isCorrection: boolean },
): { claim: ClaimInput } | { problem: "requiredFields" | "invalidDate" } {
  const named = state.partyKind === "named";
  const role = state.role === "none" ? undefined : state.role;
  if (
    !state.statement.trim() ||
    (named && !state.partyText.trim()) ||
    (options.isCorrection && !state.reason.trim())
  ) {
    return { problem: "requiredFields" };
  }
  const startDate = historicalDateFromDraft(state.startDate);
  const endDate = historicalDateFromDraft(state.endDate);
  if (startDate === null || endDate === null) {
    return { problem: "invalidDate" };
  }
  const evidence: ProvenanceEvidenceInput[] = [];
  for (const { draft } of state.evidence) {
    if (isBlankEvidence(draft)) continue;
    const input = evidenceInputFromDraft(draft);
    if (!input) return { problem: "requiredFields" };
    evidence.push(input);
  }
  return {
    claim: {
      statement: state.statement.trim(),
      role,
      partyKind: state.partyKind,
      partyText:
        state.partyKind === "unknown"
          ? undefined
          : state.partyText.trim() || undefined,
      // Without party access the server keeps a correction's identification.
      partyAccountId: options.canLinkParties
        ? named && role
          ? (state.partyId ?? null)
          : null
        : undefined,
      method: state.method === "none" ? undefined : state.method,
      place: state.place.trim() || undefined,
      startDate,
      endDate,
      confidence: state.confidence,
      contradictsClaimId:
        state.contradictsClaimId === "none"
          ? undefined
          : state.contradictsClaimId,
      evidence,
    },
  };
}
