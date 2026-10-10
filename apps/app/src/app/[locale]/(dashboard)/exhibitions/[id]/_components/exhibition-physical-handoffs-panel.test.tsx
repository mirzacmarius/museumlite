// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { custodyConflict } from "@v1/backend/convex/utils/custodyErrors";
import { getFunctionName } from "convex/server";
import { beforeEach, expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { ExhibitionPhysicalHandoffsPanel } from "./exhibition-physical-handoffs-panel";

const LOCATIONS = [
  { _id: "store", name: "Store room B", type: "room", status: "active" },
  { _id: "gallery", name: "Gallery 2", type: "room", status: "active" },
].map((location) => ({
  ...location,
  path: [{ name: location.name, type: location.type }],
}));

const deinstalled = {
  exhibitionObjectId: "participant-1",
  collectionId: "object-1",
  collectionTitle: "Brass binnacle compass",
  collectionAccessionNumber: "QA-652-7",
  status: "deinstalled",
  role: "participant",
  order: 0,
  hasReturnException: false,
  originalLocationId: "store",
  currentLocationId: "gallery",
};

const returnObject = vi.fn();
vi.mock("convex/react", () => ({
  useQuery: (reference: unknown, args: unknown) => {
    if (args === "skip") return undefined;
    switch (getFunctionName(reference as never)) {
      case "exhibitions:getPhysicalHandoffSummary":
        return {
          participantCount: 1,
          outstandingCount: 1,
          canClose: false,
          participants: [deinstalled],
          outstanding: [deinstalled],
          timeline: [],
        };
      case "exhibitions:checkScheduleConflictsForParticipants":
        return { hasConflicts: false, conflicts: [] };
      case "locations:listAllWithPaths":
        return LOCATIONS;
      default:
        return undefined;
    }
  },
  usePaginatedQuery: () => ({
    results: [
      {
        _id: "assessment-1",
        status: "accepted",
        assessedAt: Date.UTC(2026, 9, 9),
        condition: "Good",
        summary: "Checked after deinstallation",
      },
    ],
    status: "Exhausted",
    loadMore: () => {},
  }),
  useMutation: (reference: unknown) =>
    getFunctionName(reference as never) ===
    "exhibitions:returnObjectToOriginalLocation"
      ? returnObject
      : vi.fn(),
}));
vi.mock("@/components/permission-gate", () => ({
  usePermissions: () => ({ hasPermission: () => true }),
}));

beforeEach(() => {
  returnObject.mockReset();
});

async function renderPanel() {
  await renderOnPage(
    <ExhibitionPhysicalHandoffsPanel
      exhibitionId="exhibition-1"
      organizationId={"org" as Id<"organizations">}
      startDate={Date.UTC(2026, 9, 1)}
    />,
    "/en/exhibitions/exhibition-1",
    { id: "exhibition-1" },
  );
  const row = screen.getByRole("listitem", {
    name: "Brass binnacle compass",
  });
  return { row, user: userEvent.setup() };
}

test("confirming a return observes the object where it is recorded and returns it to its origin", async () => {
  returnObject.mockResolvedValue(null);
  const { row, user } = await renderPanel();

  await user.selectOptions(
    within(row).getByRole("combobox", { name: "Condition assessment" }),
    "assessment-1",
  );
  await user.click(
    within(row).getByRole("button", { name: "Confirm physical return" }),
  );

  expect(returnObject).toHaveBeenCalledWith({
    exhibitionObjectId: "participant-1",
    observedFromLocationId: "gallery",
    overrideLocationId: "store",
    returnConditionAssessmentId: "assessment-1",
  });
});

test("a refused return is explained in that object's row, which takes focus", async () => {
  returnObject.mockRejectedValue(
    custodyConflict("SOURCE_CHANGED", "Object moved", {
      currentLocationName: "Quarantine bay",
    }),
  );
  const { row, user } = await renderPanel();
  await user.selectOptions(
    within(row).getByRole("combobox", { name: "Condition assessment" }),
    "assessment-1",
  );

  await user.click(
    within(row).getByRole("button", { name: "Confirm physical return" }),
  );

  const refusal = await within(row).findByRole("alert");
  expect(refusal.textContent).toBe(
    "This object is now at Quarantine bay. Refresh, confirm where it is, and record the handoff again.",
  );
  expect(document.activeElement).toBe(refusal);
});

test("confirming without an assessment says so at the assessment and focuses it", async () => {
  const { row, user } = await renderPanel();

  await user.click(
    within(row).getByRole("button", { name: "Confirm physical return" }),
  );

  const assessment = within(row).getByRole("combobox", {
    name: "Condition assessment",
  });
  expect(assessment.getAttribute("aria-invalid")).toBe("true");
  const described = assessment.getAttribute("aria-describedby") ?? "";
  expect(
    described
      .split(" ")
      .map((id) => document.getElementById(id)?.textContent)
      .join(" "),
  ).toContain("Choose an accepted condition assessment.");
  expect(document.activeElement).toBe(assessment);
  expect(returnObject).not.toHaveBeenCalled();
});
