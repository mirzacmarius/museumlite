import { describe, expect, it } from "vitest";
import {
  getAccessionStatusLabel,
  getCollectionStatusLabel,
  getLoanStatusLabel,
  getLoanTypeLabel,
} from "./record-enum-labels";

const keyFor = (key: string) => `translated:${key}`;

describe("record enum labels", () => {
  it.each([
    ["active", "objects.filters.active"],
    ["verified", "settings.fineArt.verified"],
    ["loaned", "objects.filters.loaned"],
    ["deaccessioned", "objects.filters.deaccessioned"],
    ["archived", "objects.filters.archived"],
    ["deleted", "objects.filters.deleted"],
  ])("translates collection status %s", (status, key) => {
    expect(getCollectionStatusLabel(status, keyFor)).toBe(`translated:${key}`);
  });

  it.each([
    ["incoming", "loans.filters.incoming"],
    ["outgoing", "loans.filters.outgoing"],
  ])("translates loan type %s", (type, key) => {
    expect(getLoanTypeLabel(type, keyFor)).toBe(`translated:${key}`);
  });

  it.each([
    ["pending", "loans.status.pendingReview"],
    ["active", "loans.status.active"],
    ["dispatched", "loans.status.dispatched"],
    ["returned", "loans.status.returned"],
    ["cancelled", "loans.status.cancelled"],
  ])("translates loan status %s", (status, key) => {
    expect(getLoanStatusLabel(status, keyFor)).toBe(`translated:${key}`);
  });

  it.each([
    ["pending", "accessions.status.pending"],
    ["approved", "accessions.status.approved"],
    ["rejected", "accessions.status.rejected"],
    ["withdrawn", "accessionReview.status.withdrawn"],
    ["draft", "untranslatedRecords.objects.status.draft"],
  ])("translates accession status %s", (status, key) => {
    expect(getAccessionStatusLabel(status, keyFor)).toBe(`translated:${key}`);
  });

  it("preserves custom and unknown enum values", () => {
    expect(getCollectionStatusLabel("awaiting conservation", keyFor)).toBe(
      "awaiting conservation",
    );
    expect(getLoanTypeLabel("legacy loan type", keyFor)).toBe(
      "legacy loan type",
    );
    expect(getLoanStatusLabel("legacy status", keyFor)).toBe("legacy status");
    expect(getAccessionStatusLabel("custom status", keyFor)).toBe(
      "custom status",
    );
  });
});
