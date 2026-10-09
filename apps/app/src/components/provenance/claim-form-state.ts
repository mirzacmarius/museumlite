import type { Id } from "@v1/backend/convex/_generated/dataModel";
import type {
  HistoricalDate,
  ProvenanceConfidence,
  ProvenanceEvidenceInput,
  ProvenanceMethod,
  ProvenancePartyKind,
  ProvenanceRole,
} from "@v1/backend/convex/utils/provenanceValidators";
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
export interface ClaimDefaults {
  statement?: string;
  role?: ProvenanceRole;
  partyKind?: ProvenancePartyKind;
  partyText?: string;
  partyId?: Id<"accounts">;
  method?: ProvenanceMethod;
  place?: string;
  startDate?: HistoricalDate;
  endDate?: HistoricalDate;
  confidence?: ProvenanceConfidence;
  contradictsClaimId?: Id<"provenanceClaims">;
}

export interface ClaimFormState {
  statement: string;
  role: ProvenanceRole;
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
  isSaving: boolean;
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
    role: defaults?.role ?? "owner",
    partyKind: defaults?.partyKind ?? "named",
    partyText: defaults?.partyText ?? "",
    partyId: defaults?.partyId,
    method: defaults?.method ?? "none",
    place: defaults?.place ?? "",
    startDate: draftFromHistoricalDate(defaults?.startDate),
    endDate: draftFromHistoricalDate(defaults?.endDate),
    confidence: defaults?.confidence ?? "unassessed",
    contradictsClaimId: defaults?.contradictsClaimId ?? "none",
    evidence: [],
    nextEvidenceKey: 0,
    reason: "",
    isSaving: false,
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

export interface ClaimInput {
  statement: string;
  role: ProvenanceRole;
  partyKind: ProvenancePartyKind;
  partyText?: string;
  partyAccountId?: Id<"accounts">;
  method?: ProvenanceMethod;
  place?: string;
  startDate?: HistoricalDate;
  endDate?: HistoricalDate;
  confidence: ProvenanceConfidence;
  contradictsClaimId?: Id<"provenanceClaims">;
  evidence: ProvenanceEvidenceInput[];
}

/**
 * The claim the form states, or why it cannot be sent. Fields that do not
 * apply to the holder kind are dropped; blank evidence rows are ignored.
 */
export function claimInputFromForm(
  state: ClaimFormState,
  options: { canLinkParties: boolean; isCorrection: boolean },
): { claim: ClaimInput } | { problem: "requiredFields" | "invalidDate" } {
  const named = state.partyKind === "named";
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
      role: state.role,
      partyKind: state.partyKind,
      partyText:
        state.partyKind === "unknown"
          ? undefined
          : state.partyText.trim() || undefined,
      partyAccountId:
        named && options.canLinkParties ? state.partyId : undefined,
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
