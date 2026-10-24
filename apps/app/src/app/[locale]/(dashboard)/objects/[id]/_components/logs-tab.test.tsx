// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  {
    _id: "log-5",
    action: "updated_collection",
    timestamp: Date.UTC(2026, 9, 1, 16),
    userName: "Ada",
    changes: {
      subjects: ["Horses", "Riders"],
      rightsStatement: "http://rightsstatements.org/vocab/InC/1.0/",
      lastModifiedBy: "user-1",
      lastModifiedAt: Date.UTC(2026, 9, 1, 16),
    },
  },
  {
    _id: "log-6",
    action: "updated_collection",
    timestamp: Date.UTC(2026, 9, 1, 17),
    userName: "Ada",
    changes: {
      lastModifiedBy: "user-1",
      dimensionMeasuredPart: "framed",
      measurementSets: [{ part: "base", width: 30, unit: "cm" }],
    },
  },
  {
    _id: "log-7",
    action: "updated_collection",
    timestamp: Date.UTC(2026, 9, 1, 18),
    userName: "Ada",
    changes: { numberOfObjects: 12000, completeness: "fragment" },
  },
  {
    _id: "log-8",
    action: "updated_collection",
    timestamp: Date.UTC(2026, 9, 1, 19),
    userName: "Ada",
    changes: { subjects: [], culture: "Roman" },
  },
  {
    _id: "log-9",
    action: "created_move_request",
    timestamp: Date.UTC(2026, 9, 2, 8),
    userName: "Ada",
    changes: {
      requestId: "request-1",
      fromLocationId: "store",
      toLocationId: "gallery",
      reason: "Conservation check",
    },
  },
  {
    _id: "log-10",
    action: "executed_move_request",
    timestamp: Date.UTC(2026, 9, 2, 10),
    userName: "Ada",
    changes: { requestId: "request-1", movementId: "move-2" },
  },
]);

const movements = vi.hoisted(() => [
  {
    _id: "move-1",
    movedAt: Date.UTC(2026, 9, 2, 9),
    fromLocationId: "store",
    fromLocationName: "Store A",
    toLocationId: "gallery",
    toLocationName: "Gallery",
    movedByName: "Grace",
    movementKind: "catalog_edit",
    reason: "Catalog location change",
  },
  {
    _id: "move-2",
    movedAt: Date.UTC(2026, 9, 2, 10),
    fromLocationId: "gallery",
    fromLocationName: "Gallery",
    toLocationId: "lab",
    toLocationName: "Conservation lab",
    movedByName: "Grace",
    movementKind: "request",
    authorizedBy: "user-2",
    authorizedByName: "Ada",
  },
  {
    _id: "move-3",
    movedAt: Date.UTC(2026, 9, 2, 11),
    fromLocationId: "lab",
    fromLocationName: "Conservation lab",
    movedByName: "Grace",
    movementKind: "loan_dispatch",
  },
]);

vi.mock("convex/react", () => ({
  useQuery: (reference: unknown, args: { limit?: number }) => {
    const name = getFunctionName(reference as never);
    // Newest first and at most `limit`, as the audit log query returns them.
    if (name === "auditLog:getByEntity") {
      return entries
        .toSorted((a, b) => b.timestamp - a.timestamp)
        .slice(0, args.limit);
    }
    if (name === "locations:getCollectionLocationHistory") return movements;
    return undefined;
  },
}));

/** Adds rows to the mocked queries for one test. */
async function withRows(
  extra: { entries?: typeof entries; movements?: typeof movements },
  run: () => Promise<void>,
) {
  entries.push(...(extra.entries ?? []));
  movements.push(...(extra.movements ?? []));
  try {
    await run();
  } finally {
    entries.splice(entries.length - (extra.entries?.length ?? 0));
    movements.splice(movements.length - (extra.movements?.length ?? 0));
  }
}

function olderEntries(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    _id: `log-older-${index}`,
    action: "updated_collection",
    timestamp: Date.UTC(2026, 8, 1, 0, index),
    userName: "Ada",
  }));
}

function renderLogs(locale: string) {
  return renderOnPage(
    <LogsTab
      collectionId={"object-1" as Id<"collections">}
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

test("a catalog save names description fields and shows their values as staff read them", async () => {
  await renderLogs("en");

  expect(
    screen.getByText(
      "Subject: Horses, Riders · Rights statement: In Copyright",
    ),
  ).toBeTruthy();
  expect(
    screen.getByText(
      "Measured part: Framed · Further measured parts: Base: W: 30 cm",
    ),
  ).toBeTruthy();
  expect(
    screen.getByText("Number of objects: 12,000 · Completeness: Fragment"),
  ).toBeTruthy();
  expect(screen.getByText("Subject · culture: Roman")).toBeTruthy();
  expect(screen.queryByText(/lastModified/)).toBeNull();
});

test("description values in the log are translated", async () => {
  await renderLogs("no");

  expect(
    screen.getByText("Antall objekter: 12 000 · Fullstendighet: Fragment"),
  ).toBeTruthy();
});

test("movements are listed with the other changes, newest first", async () => {
  await renderLogs("en");

  const rows = screen.getAllByRole("row").map((row) => row.textContent ?? "");
  const [left, request, moved, requested] = rows.slice(1, 5);
  expect(left).toContain("Object moved");
  expect(left).toContain("Left Conservation lab");
  expect(left).toContain("Loan dispatch");
  expect(request).toContain("From Gallery to Conservation lab");
  expect(request).toContain("Approved request · Authorized by Ada");
  expect(moved).toContain("From Store A to Gallery");
  expect(moved).toContain("Catalog edit");
  // The reason the server filled in only repeats the kind, in English.
  expect(moved).not.toContain("Catalog location change");
  expect(requested).toContain("Move requested");
  expect(requested).toContain("Conservation check");
  expect(requested).not.toContain("request-1");
});

test("a completed move request is shown once, as its movement", async () => {
  await renderLogs("en");

  expect(screen.queryByText("Move completed")).toBeNull();
  expect(screen.getByText("From Gallery to Conservation lab")).toBeTruthy();
});

test("movements are described in the viewer's language", async () => {
  await renderLogs("no");

  expect(screen.getByText("Fra Store A til Gallery")).toBeTruthy();
  expect(screen.getByText("Forlot Conservation lab")).toBeTruthy();
  expect(screen.getByText("Utsendelse av lån")).toBeTruthy();
});

test("a movement and the change saved with it keep the order they were written in", async () => {
  const savedAt = Date.UTC(2026, 9, 3, 12);
  await withRows(
    {
      entries: [
        {
          _id: "log-saved",
          _creationTime: 2,
          action: "updated_collection",
          timestamp: savedAt,
          userName: "Ada",
          changes: { culture: "Norse" },
        } as (typeof entries)[number],
      ],
      movements: [
        {
          _id: "move-saved",
          _creationTime: 1,
          movedAt: savedAt,
          fromLocationId: "gallery",
          fromLocationName: "Gallery",
          toLocationId: "store",
          toLocationName: "Store A",
          movedByName: "Ada",
          movementKind: "catalog_edit",
        } as (typeof movements)[number],
      ],
    },
    async () => {
      await renderLogs("en");

      const rows = screen.getAllByRole("row").map((row) => row.textContent);
      expect(rows[1]).toContain("culture: Norse");
      expect(rows[2]).toContain("From Gallery to Store A");
    },
  );
});

test("entries past the first page wait behind Load older", async () => {
  await withRows({ entries: olderEntries(15) }, async () => {
    await renderLogs("en");

    // The 20 newest of 25 entries, less the completed request its movement
    // stands for, and the three movements newer than them; and a header.
    expect(screen.getAllByRole("row")).toHaveLength(23);

    await userEvent.click(
      screen.getByRole("button", { name: "Load older logs…" }),
    );

    expect(screen.getAllByRole("row")).toHaveLength(28);
    expect(
      screen.queryByRole("button", { name: "Load older logs…" }),
    ).toBeNull();
  });
});

test("a completed request at the end of a page shows until its movement loads", async () => {
  const completedAt = Date.UTC(2026, 8, 10, 12);
  const newer = Array.from({ length: 9 }, (_, index) => ({
    _id: `log-newer-${index}`,
    action: "updated_collection",
    timestamp: Date.UTC(2026, 8, 20, index),
    userName: "Ada",
  }));
  await withRows(
    {
      entries: [
        ...newer,
        {
          _id: "log-completed",
          action: "executed_move_request",
          timestamp: completedAt + 5,
          userName: "Ada",
          changes: { requestId: "request-2", movementId: "move-completed" },
        },
        ...olderEntries(1),
      ],
      movements: [
        {
          _id: "move-completed",
          movedAt: completedAt,
          fromLocationId: "store",
          fromLocationName: "Store A",
          toLocationId: "lab",
          toLocationName: "Conservation lab",
          movedByName: "Grace",
          movementKind: "request",
        } as (typeof movements)[number],
      ],
    },
    async () => {
      await renderLogs("en");
      expect(screen.getByText("Move completed")).toBeTruthy();

      await userEvent.click(
        screen.getByRole("button", { name: "Load older logs…" }),
      );

      expect(screen.queryByText("Move completed")).toBeNull();
      expect(screen.getByText("From Store A to Conservation lab")).toBeTruthy();
    },
  );
});

test("a movement older than the loaded entries waits for them, and shows once no more load", async () => {
  await withRows(
    {
      entries: olderEntries(120),
      movements: [
        {
          _id: "move-first",
          movedAt: Date.UTC(2026, 6, 1),
          toLocationId: "store",
          toLocationName: "Store A",
          movedByName: "Grace",
          movementKind: "direct",
        } as (typeof movements)[number],
      ],
    },
    async () => {
      await renderLogs("en");
      const firstMove = "From No recorded location to Store A";
      expect(screen.queryByText(firstMove)).toBeNull();

      // Four more pages reach the 100 entries the audit log query returns.
      const loadOlder = () =>
        userEvent.click(
          screen.getByRole("button", { name: "Load older logs…" }),
        );
      await loadOlder();
      await loadOlder();
      await loadOlder();
      await loadOlder();

      expect(
        screen.queryByRole("button", { name: "Load older logs…" }),
      ).toBeNull();
      expect(screen.getAllByRole("row").at(-1)?.textContent).toContain(
        firstMove,
      );
    },
  );
});
