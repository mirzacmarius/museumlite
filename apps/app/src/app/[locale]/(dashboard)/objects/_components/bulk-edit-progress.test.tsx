// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";
import type { ReactNode } from "react";
import { beforeEach, expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { BulkEditStatus } from "./bulk-edit-progress";

const state = vi.hoisted(() => ({
  cancel: vi.fn(),
  resume: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useQuery: () => undefined,
  useMutation: (mutation: never) =>
    getFunctionName(mutation) === "bulkFieldEdits:resume"
      ? state.resume
      : state.cancel,
}));
vi.mock("@/components/permission-gate", () => ({
  PermissionGate: ({ children }: { children: ReactNode }) => children,
}));

beforeEach(() => {
  state.cancel = vi.fn();
  state.resume = vi.fn();
});

const MINUTE = 60 * 1000;

function job(
  status: string,
  updatedAgoMs: number,
  counts = { checked: 40, changed: 12, skipped: 0 },
) {
  const updatedAt = Date.now() - updatedAgoMs;
  return {
    _id: "job-1",
    status,
    edit: { field: "culture", operation: "set", value: "Norse" },
    scope: { kind: "filters" },
    ...counts,
    startedAt: updatedAt - MINUTE,
    updatedAt,
  } as never;
}

test("a running edit that reports progress can be stopped, not resumed", async () => {
  await renderOnPage(<BulkEditStatus job={job("running", MINUTE)} />, "/en");

  expect(
    screen.getByText("Editing Culture: 40 checked, 12 changed"),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Stop" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Resume" })).toBeNull();
});

test("a running edit that stopped reporting can be resumed", async () => {
  state.resume.mockResolvedValue(null);
  await renderOnPage(
    <BulkEditStatus job={job("running", 10 * MINUTE)} />,
    "/en",
  );

  expect(
    screen.getByText(
      "This edit has stopped reporting progress. Resume it to continue from where it stopped.",
    ),
  ).toBeTruthy();
  await userEvent.setup().click(screen.getByRole("button", { name: "Resume" }));

  expect(state.resume).toHaveBeenCalledWith({ jobId: "job-1" });
});

test("a failed edit can be stopped as well as resumed, which clears its notice", async () => {
  state.cancel.mockResolvedValue(null);
  await renderOnPage(<BulkEditStatus job={job("failed", MINUTE)} />, "/en");

  expect(screen.getByRole("button", { name: "Resume" })).toBeTruthy();
  await userEvent.setup().click(screen.getByRole("button", { name: "Stop" }));

  expect(state.cancel).toHaveBeenCalledWith({ jobId: "job-1" });
});

test("a failed resume says the action failed, not that the edit could not start", async () => {
  state.resume.mockRejectedValue(new Error("Server error"));
  await renderOnPage(<BulkEditStatus job={job("failed", MINUTE)} />, "/en");

  await userEvent.setup().click(screen.getByRole("button", { name: "Resume" }));

  expect((await screen.findByRole("alert")).textContent).toBe(
    "The action could not be completed. Try again.",
  );
});

test("counts are written in the app language's number format", async () => {
  await renderOnPage(
    <BulkEditStatus
      job={job("completed", MINUTE, {
        checked: 12500,
        changed: 1200,
        skipped: 1000,
      })}
    />,
    "/en",
  );

  expect(
    screen.getByText("Edit finished: 12,500 checked, 1,200 changed"),
  ).toBeTruthy();
  expect(
    screen.getByText("Left unchanged because the title would be empty: 1,000"),
  ).toBeTruthy();
});
