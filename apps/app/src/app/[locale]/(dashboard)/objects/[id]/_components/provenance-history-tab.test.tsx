// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { getFunctionName } from "convex/server";
import { expect, test, vi } from "vitest";
import type { ProvenanceClaimView } from "@/components/provenance/provenance-claim-card";
import { renderOnPage } from "@/testing/render-on-page";
import { CollectionEditProvenanceTab } from "../../_components/collection-edit-form/tabs/provenance-tab";
import { EMPTY_EDIT_FORM } from "../../_components/collection-form-shared/utils";
import { ProvenanceHistoryTab } from "./provenance-history-tab";
import type { CollectionData } from "./types";

const claim: ProvenanceClaimView = {
  _id: "claim-1" as Id<"provenanceClaims">,
  statement: "Bought from the artist's studio in 1921",
  role: "owner",
  partyKind: "named",
  partyText: "Ada Lindqvist",
  method: "purchase",
  confidence: "probable",
  contradictedByClaimIds: [],
  createdAt: Date.UTC(2026, 8, 1),
  reviewStatus: "unreviewed",
  isCurrent: true,
  retractNeedsReview: false,
  party: null,
  evidence: [
    {
      _id: "evidence-1" as Id<"provenanceEvidence">,
      kind: "citation",
      citation: "Studio ledger, 1921",
      linkedAt: Date.UTC(2026, 8, 1),
      isActive: true,
    },
  ],
  reviews: [],
};

// Whether part of the object's provenance is still arriving from a transfer.
let arriving = false;

vi.mock("convex/react", () => ({
  useQuery: (reference: unknown, args: unknown) => {
    if (args === "skip") return undefined;
    const name = getFunctionName(reference as never);
    if (name === "media:list") return [];
    if (name === "provenance:listForObject") {
      return {
        viewer: {
          canRecord: !arriving,
          canReview: !arriving,
          canLinkParties: !arriving,
        },
        objectWithdrawn: false,
        provenanceArriving: arriving,
        claims: [claim],
        truncated: false,
      };
    }
    return undefined;
  },
  useMutation: () => vi.fn(),
}));
vi.mock("@/components/permission-gate", () => ({
  usePermissions: () => ({ hasPermission: () => true }),
}));

const object = {
  _id: "object-1" as Id<"collections">,
  organizationId: "org-1" as Id<"organizations">,
  provenance: "Sold by the artist to a Stockholm dealer",
};

const authoringButtons = [
  "Record claim",
  "Record as claim",
  "Review",
  "Correct",
  "Add evidence",
  "Retract",
];

function visibleButtons() {
  return authoringButtons.filter(
    (name) => screen.queryAllByRole("button", { name }).length > 0,
  );
}

test("viewing an object lists its claims without claim authoring", async () => {
  await renderOnPage(
    <ProvenanceHistoryTab collection={object as CollectionData} />,
    "/en/objects/object-1?tab=provenance",
  );

  expect(
    screen.getByText("Bought from the artist's studio in 1921"),
  ).not.toBeNull();
  expect(
    screen.getByText("Sold by the artist to a Stockholm dealer"),
  ).not.toBeNull();
  expect(visibleButtons()).toEqual([]);
});

function renderEditTab() {
  return renderOnPage(
    <CollectionEditProvenanceTab
      collection={object}
      formData={EMPTY_EDIT_FORM}
      updateField={vi.fn()}
      placeholders={(key) => key}
      currentOrganizationId={object.organizationId}
      isLocationTrackingEnabled
      editingOwnershipEntryId={null}
      setEditingOwnershipEntryId={vi.fn()}
      createOwnershipEntry={(entry) => ({ ...entry, localId: "entry-1" })}
    />,
    "/en/objects/object-1/edit",
    { id: "object-1" },
  );
}

test("editing an object records, reviews, corrects and retracts claims", async () => {
  await renderEditTab();

  expect(
    screen.getByText("Bought from the artist's studio in 1921"),
  ).not.toBeNull();
  expect(visibleButtons()).toEqual(authoringButtons);
});

test("while part of its provenance is still arriving from a transfer, the object says so and waits", async () => {
  arriving = true;
  try {
    await renderEditTab();

    expect(
      screen.getByText(
        "Part of this object's provenance is still arriving from an organization that held it before. You can record or review provenance once it is here.",
      ),
    ).not.toBeNull();
    expect(
      screen.getByText("Bought from the artist's studio in 1921"),
    ).not.toBeNull();
    expect(visibleButtons()).toEqual([]);
  } finally {
    arriving = false;
  }
});
