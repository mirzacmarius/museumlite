// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { getFunctionName } from "convex/server";
import { beforeEach, expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { useCollectionEditFormSubmit } from "../../_components/collection-edit-form/use-collection-edit-form-submit";
import { ValuationTab } from "./valuation-tab";

const objectId = "object-1" as Id<"collections">;
const appraisalId = "appraisal-1" as Id<"appraisals">;
const appraisal = {
  _id: appraisalId,
  collectionId: objectId,
  purpose: "insurance" as const,
  appraisalDate: Date.UTC(2026, 8, 1),
  appraiserName: "Independent Valuer",
  value: 10_000,
  currency: "EUR",
  currencyRecognized: true,
  createdAt: Date.UTC(2026, 8, 1),
  isCurrent: true,
  ageDays: 44,
  isWithinValuationAge: true,
  renewalDueAt: Date.UTC(2028, 8, 1),
};

const mutations: Record<string, ReturnType<typeof vi.fn>> = {
  "appraisals:create": vi.fn(),
  "appraisals:supersede": vi.fn(),
  "collections:update": vi.fn(),
};
vi.mock("convex/react", () => ({
  useQuery: (reference: unknown, args: unknown) =>
    args !== "skip" &&
    getFunctionName(reference as never) === "appraisals:getObjectValuation"
      ? { current: [appraisal], history: [appraisal], truncated: false }
      : undefined,
  useMutation: (reference: unknown) =>
    mutations[getFunctionName(reference as never)] ?? vi.fn(),
}));
vi.mock("@/components/permission-gate", () => ({
  usePermissions: () => ({ hasPermission: () => true }),
}));

const supersede = mutations["appraisals:supersede"] as ReturnType<typeof vi.fn>;
const saveObject = vi.fn();

beforeEach(() => {
  supersede.mockReset();
  supersede.mockResolvedValue("appraisal-2");
  saveObject.mockReset();
});

function EditFormValuationTab() {
  const { handleSubmit } = useCollectionEditFormSubmit({
    collectionId: objectId,
    typedCollectionId: objectId,
    session: { isDirty: true, save: saveObject },
    hasMediaChanges: false,
  });
  return (
    <form onSubmit={handleSubmit}>
      <ValuationTab mode="edit" collectionId={objectId} locale="en" />
      <button type="submit">Save object</button>
    </form>
  );
}

function authoringButtons() {
  return ["Record appraisal", "Correct"].filter(
    (name) => screen.queryAllByRole("button", { name }).length > 0,
  );
}

test("viewing an object shows its valuations without Record appraisal", async () => {
  await renderOnPage(
    <ValuationTab mode="view" collectionId={objectId} locale="en" />,
    "/en/objects/object-1?tab=valuation",
  );

  expect(screen.getAllByText("€10,000.00")).toHaveLength(2);
  expect(authoringButtons()).toEqual([]);
});

test("editing an object records and corrects appraisals", async () => {
  await renderOnPage(<EditFormValuationTab />, "/en/objects/object-1/edit", {
    id: "object-1",
  });

  expect(authoringButtons()).toEqual(["Record appraisal", "Correct"]);
});

test("a correction saved from the edit form does not save the object", async () => {
  await renderOnPage(<EditFormValuationTab />, "/en/objects/object-1/edit", {
    id: "object-1",
  });
  const user = userEvent.setup();

  await user.click(screen.getByRole("button", { name: "Record appraisal" }));
  expect(
    screen.getByRole("heading", { name: "Record appraisal" }),
  ).not.toBeNull();
  await user.keyboard("{Escape}");
  await user.click(screen.getByRole("button", { name: "Correct" }));
  await user.type(
    screen.getByRole("textbox", { name: "Reason for correction *" }),
    "Valuer revised the figure",
  );
  await user.click(screen.getByRole("button", { name: "Save appraisal" }));

  expect(supersede.mock.calls).toEqual([
    [
      {
        appraisalId,
        reason: "Valuer revised the figure",
        appraisalType: "insurance",
        appraisalDate: Date.UTC(2026, 8, 1),
        appraiserName: "Independent Valuer",
        appraiserCompany: undefined,
        appraiserCredentials: undefined,
        value: 10_000,
        currency: "EUR",
        validUntil: undefined,
        notes: undefined,
      },
    ],
  ]);
  expect(saveObject).not.toHaveBeenCalled();

  await user.click(screen.getByRole("button", { name: "Save object" }));
  expect(saveObject).toHaveBeenCalledTimes(1);
});
