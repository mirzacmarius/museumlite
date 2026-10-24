// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { getFunctionName } from "convex/server";
import { expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { LogsTab } from "./logs-tab";

const entries = vi.hoisted(() => [
  {
    _id: "log-1",
    action: "updated_collection",
    timestamp: Date.UTC(2026, 9, 1, 12),
    userName: "Ada",
    changes: {
      field: "culture",
      previous: "Greek",
      new: "Roman",
      bulkFieldEditId: "job-1",
    },
  },
  {
    _id: "log-2",
    action: "updated_collection",
    timestamp: Date.UTC(2026, 9, 1, 13),
    userName: "Ada",
    changes: {
      field: "materials",
      previous: '["Bronze","Iron"]',
      new: '["Bronze"]',
      bulkFieldEditId: "job-2",
    },
  },
  {
    _id: "log-3",
    action: "updated_collection",
    timestamp: Date.UTC(2026, 9, 1, 14),
    userName: "Ada",
    changes: {
      field: "dateCreated",
      previous: "1850",
      new: "c. 1850",
      clearedEdtf: "1860",
      bulkFieldEditId: "job-3",
    },
  },
  {
    _id: "log-4",
    action: "updated_collection",
    timestamp: Date.UTC(2026, 9, 1, 15),
    userName: "Ada",
    changes: {
      field: "dateCreated",
      clearedEdtf: "185X",
      bulkFieldEditId: "job-4",
    },
  },
]);

vi.mock("convex/react", () => ({
  useQuery: (reference: unknown) =>
    getFunctionName(reference as never) === "auditLog:getByEntity"
      ? entries
      : undefined,
}));

function renderLogs(locale: string) {
  return renderOnPage(
    <LogsTab
      collectionId="object-1"
      organizationId={"org-1" as Id<"organizations">}
      locale={locale}
    />,
    `/${locale}/objects/object-1`,
  );
}

test("a bulk field edit names the field and shows values as staff entered them", async () => {
  await renderLogs("en");

  expect(
    screen.getByText("Changed “Culture” from “Greek” to “Roman”"),
  ).toBeTruthy();
  expect(
    screen.getByText("Changed “Materials” from “Bronze, Iron” to “Bronze”"),
  ).toBeTruthy();
});

test("the field name is translated", async () => {
  await renderLogs("no");

  expect(screen.getByText(/«Kultur»/)).toBeTruthy();
});

test("a bulk Date made edit says which structured date it removed", async () => {
  await renderLogs("en");

  expect(
    screen.getByText("Changed “Date made” from “1850” to “c. 1850”"),
  ).toBeTruthy();
  expect(screen.getByText("Structured date “1860” removed")).toBeTruthy();
  expect(screen.getByText("Changed “Date made”")).toBeTruthy();
  expect(screen.getByText("Structured date “1850s” removed")).toBeTruthy();
});
