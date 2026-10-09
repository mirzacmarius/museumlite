import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { describe, expect, test } from "vitest";
import {
  claimFormReducer,
  claimInputFromForm,
  initialClaimFormState,
} from "./claim-form-state";
import { EMPTY_EVIDENCE } from "./evidence-fields";

const partyId = "party1" as Id<"accounts">;

describe("claim form", () => {
  test("sends only what was stated for the holder kind", () => {
    const state = initialClaimFormState({
      statement: " Private collection, Geneva ",
      partyKind: "anonymous",
      partyText: "Private collection",
      partyId,
    });
    const result = claimInputFromForm(state, {
      canLinkParties: true,
      isCorrection: false,
    });
    expect(result).toEqual({
      claim: expect.objectContaining({
        statement: "Private collection, Geneva",
        partyKind: "anonymous",
        partyText: "Private collection",
        partyAccountId: null,
        role: undefined,
        method: undefined,
        startDate: undefined,
        endDate: undefined,
        confidence: "unassessed",
        evidence: [],
      }),
    });
    const unknown = claimInputFromForm(
      { ...state, partyKind: "unknown" },
      { canLinkParties: true, isCorrection: false },
    );
    expect("claim" in unknown && unknown.claim.partyText).toBeUndefined();
  });

  test("requires a named holder's name, a correction reason and complete evidence", () => {
    const named = initialClaimFormState({ statement: "A claim" });
    expect(
      claimInputFromForm(named, { canLinkParties: false, isCorrection: false }),
    ).toEqual({ problem: "requiredFields" });
    const withName = { ...named, partyText: "Rosenberg" };
    expect(
      claimInputFromForm(withName, {
        canLinkParties: false,
        isCorrection: true,
      }),
    ).toEqual({ problem: "requiredFields" });

    let withEvidence = claimFormReducer(withName, { type: "addEvidence" });
    withEvidence = claimFormReducer(withEvidence, { type: "addEvidence" });
    withEvidence = claimFormReducer(withEvidence, {
      type: "updateEvidence",
      key: 1,
      draft: { ...EMPTY_EVIDENCE, excerpt: "quoted, but no source" },
    });
    expect(
      claimInputFromForm(withEvidence, {
        canLinkParties: false,
        isCorrection: false,
      }),
    ).toEqual({ problem: "requiredFields" });
    // The untouched first row is ignored once the incomplete one is removed.
    const cleaned = claimFormReducer(withEvidence, {
      type: "removeEvidence",
      key: 1,
    });
    expect(
      claimInputFromForm(cleaned, {
        canLinkParties: false,
        isCorrection: false,
      }),
    ).toMatchObject({ claim: { evidence: [] } });
  });

  test("refuses an incomplete date instead of guessing it", () => {
    const state = {
      ...initialClaimFormState({ statement: "A claim", partyText: "X" }),
      startDate: {
        precision: "month" as const,
        year: "1925",
        month: "",
        day: "",
        qualifier: "exact" as const,
        uncertain: false,
      },
    };
    expect(
      claimInputFromForm(state, { canLinkParties: false, isCorrection: false }),
    ).toEqual({ problem: "invalidDate" });
  });
});
