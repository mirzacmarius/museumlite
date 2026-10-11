// @vitest-environment jsdom

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { beforeEach, expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { ScanPanel } from "./scan-panel";
import type { SessionView } from "./session-types";

const recordObservation = vi.fn();
vi.mock("convex/react", () => ({
  useMutation: () => recordObservation,
}));
vi.mock("@/components/barcode-scanner", () => ({
  BarcodeScanner: () => null,
}));

const store = "loc-store" as Id<"locations">;
const shelfA = "loc-shelf-a" as Id<"locations">;
const shelfB = "loc-shelf-b" as Id<"locations">;

const session: SessionView = {
  _id: "session-1" as Id<"inventorySessions">,
  organizationId: "org-1" as Id<"organizations">,
  name: "Store spot check",
  status: "scanning",
  scopeLocationId: store,
  includeSublocations: true,
  scopeLocations: [
    { _id: store, name: "Store" },
    { _id: shelfA, name: "Shelf A", parentLocationId: store },
    { _id: shelfB, name: "Shelf B", parentLocationId: store },
  ],
  progress: { expected: 3, observed: 0, remaining: 3 },
  observationCount: 0,
  exceptionCount: 0,
  openExceptionCount: 0,
  startedAt: 1,
  startedByName: "Fran Field",
  canWork: true,
};

beforeEach(() => {
  recordObservation.mockReset();
});

async function typeScan(value: string) {
  const user = userEvent.setup();
  await user.type(
    screen.getByRole("textbox", { name: "Label or accession number" }),
    `${value}{Enter}`,
  );
  return user;
}

test("a scan that did not save says so, and retrying sends the same scan", async () => {
  recordObservation.mockRejectedValueOnce(new Error("Network down"));
  recordObservation.mockResolvedValueOnce({
    observationId: "obs-1",
    outcome: "misplaced",
    object: {
      collectionId: "obj-1",
      accessionNumber: "A-2",
      title: "Object A-2",
      recordedLocationName: "Shelf A",
    },
    alreadyRecorded: false,
  });
  await renderOnPage(<ScanPanel session={session} />);

  const user = await typeScan("A-2");

  const scans = await screen.findByRole("list");
  expect(await within(scans).findByText("Not saved")).toBeTruthy();
  await user.click(within(scans).getByRole("button", { name: "Retry" }));

  expect(
    await within(scans).findByText("Store · Recorded in Shelf A"),
  ).toBeTruthy();
  expect(within(scans).queryByText("Not saved")).toBeNull();
  const [first, retry] = recordObservation.mock.calls.map(([args]) => args);
  expect(retry).toEqual(first);
  expect(first).toMatchObject({
    sessionId: "session-1",
    scannedValue: "A-2",
    method: "manual",
    observedLocationId: store,
  });
});

test("a location label switches where staff are scanning and records nothing", async () => {
  await renderOnPage(<ScanPanel session={session} />);

  await typeScan(`https://app.example.test/en/locations/${shelfB}`);

  expect(
    screen.getByRole("combobox", { name: "Where you are scanning" })
      .textContent,
  ).toContain("Shelf B");
  expect(recordObservation).not.toHaveBeenCalled();

  await typeScan("https://app.example.test/en/locations/somewhere-else");

  expect((await screen.findByRole("alert")).textContent).toBe(
    "That location label is not part of this session.",
  );
  expect(recordObservation).not.toHaveBeenCalled();
});
