// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { getFunctionName } from "convex/server";
import type { ReactNode } from "react";
import { beforeEach, expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { TreatmentEvidencePanel } from "./treatment-evidence-panel";

const access = vi.hoisted(() => ({ permissions: new Set<string>() }));

vi.mock("convex/react", () => ({
  useQuery: (query: never) =>
    getFunctionName(query) === "conservationTreatments:getTreatmentEvidence"
      ? {
          treatmentId: "treatment-1",
          collectionId: "object-1",
          status: "proposed",
          baseline: null,
          outcome: null,
          comparison: { baselineCondition: null, outcomeCondition: null },
          followUp: { status: "none" },
          attachmentCount: 0,
        }
      : { page: [], isDone: true, continueCursor: "" },
  useMutation: () => vi.fn(),
}));
vi.mock("@/components/permission-gate", () => ({
  usePermissions: () => ({
    isLoading: false,
    hasPermission: (permission: string) => access.permissions.has(permission),
  }),
  PermissionGate: ({
    permission,
    children,
  }: {
    permission: string;
    children: ReactNode;
  }) => (access.permissions.has(permission) ? children : null),
}));

beforeEach(() => {
  access.permissions = new Set(["collections.update"]);
});

async function renderPanel() {
  await renderOnPage(
    <TreatmentEvidencePanel
      treatmentId={"treatment-1" as Id<"conservationTreatments">}
      collectionId={"object-1" as Id<"collections">}
      status="proposed"
    />,
    "/en/conservation/treatment-1",
  );
}

test("staff who record assessments are sent to the object's edit form", async () => {
  await renderPanel();

  expect(
    screen
      .getByRole("link", {
        name: "Record an assessment with Set condition in the object's edit form (Physical Description tab)",
      })
      .getAttribute("href"),
  ).toBe("/objects/object-1/edit");
  expect(
    screen.queryByRole("link", {
      name: "Accept or reject submitted assessments under Condition assessments",
    }),
  ).toBeNull();
});

test("reviewers are also sent to the condition assessments awaiting approval", async () => {
  access.permissions.add("collections.accept_condition");
  await renderPanel();

  expect(
    screen
      .getByRole("link", {
        name: "Accept or reject submitted assessments under Condition assessments",
      })
      .getAttribute("href"),
  ).toBe("/condition-assessments?status=pending");
});
