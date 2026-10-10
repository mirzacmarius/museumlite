// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { getFunctionName } from "convex/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { ConditionAssessmentPanel } from "./condition-assessment-panel";

const mutations: Record<string, ReturnType<typeof vi.fn>> = {
  "conditionAssessments:create": vi.fn(),
  "conditionAssessments:accept": vi.fn(),
};
vi.mock("convex/react", () => ({
  useQuery: (reference: unknown, args: unknown) =>
    args === "skip"
      ? undefined
      : getFunctionName(reference as never) === "media:list"
        ? []
        : {
            organizationId: "org",
            current: { condition: "Good", source: "assessment" },
            comparison: {},
            legacy: { history: [] },
          },
  usePaginatedQuery: () => ({
    results: [],
    status: "Exhausted",
    loadMore: () => {},
  }),
  useMutation: (reference: unknown) =>
    mutations[getFunctionName(reference as never)] ?? vi.fn(),
}));
vi.mock("@/components/permission-gate", () => ({
  usePermissions: () => ({ hasPermission: () => true }),
}));

const create = mutations["conditionAssessments:create"] as ReturnType<
  typeof vi.fn
>;

beforeEach(() => {
  create.mockReset();
  create.mockResolvedValue("assessment-1");
});
afterEach(() => {
  vi.useRealTimers();
});

async function renderPanel() {
  await renderOnPage(
    <ConditionAssessmentPanel collectionId={"object-1" as Id<"collections">} />,
    "/en/objects/object-1?tab=physical",
  );
  return userEvent.setup();
}

test("an assessment of today recorded in the morning is not dated in the future", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 10, 8, 30));
  const user = await renderPanel();

  await user.type(screen.getByRole("textbox", { name: "Condition" }), "Fair");
  await user.type(
    screen.getByRole("textbox", { name: "Summary" }),
    "Checked on receipt from the borrower",
  );
  await user.click(screen.getByRole("button", { name: "Save draft" }));

  expect(create).toHaveBeenCalledTimes(1);
  const { assessedAt } = create.mock.calls[0]?.[0] as { assessedAt: number };
  expect(assessedAt).toBeLessThanOrEqual(Date.now());
  expect(new Date(assessedAt).getDate()).toBe(10);
});

test("saving without a condition says so at the field and focuses it, keeping the summary", async () => {
  const user = await renderPanel();
  const summary = screen.getByRole("textbox", { name: "Summary" });
  await user.type(summary, "Checked on receipt from the borrower");

  await user.click(screen.getByRole("button", { name: "Save draft" }));

  const condition = screen.getByRole("textbox", { name: "Condition" });
  expect(condition.getAttribute("aria-invalid")).toBe("true");
  const described = condition.getAttribute("aria-describedby") ?? "";
  expect(document.getElementById(described)?.textContent).toBe(
    "Enter the condition.",
  );
  expect(document.activeElement).toBe(condition);
  expect((summary as HTMLTextAreaElement).value).toBe(
    "Checked on receipt from the borrower",
  );
  expect(create).not.toHaveBeenCalled();
});

test("a refused save is explained in words, takes focus and keeps the input", async () => {
  create.mockRejectedValue(new Error("[Request ID: 1a2b] Server Error"));
  const user = await renderPanel();
  await user.type(screen.getByRole("textbox", { name: "Condition" }), "Fair");
  await user.type(
    screen.getByRole("textbox", { name: "Summary" }),
    "Checked on receipt from the borrower",
  );

  await user.click(screen.getByRole("button", { name: "Save draft" }));

  const refusal = await screen.findByRole("alert");
  expect(refusal.textContent).toBe("Could not save the draft. Try again.");
  expect(document.activeElement).toBe(refusal);
  expect(
    (screen.getByRole("textbox", { name: "Condition" }) as HTMLInputElement)
      .value,
  ).toBe("Fair");
});
