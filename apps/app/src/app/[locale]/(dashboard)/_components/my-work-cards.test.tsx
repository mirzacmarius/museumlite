// @vitest-environment jsdom
import { act, fireEvent, screen, within } from "@testing-library/react";
import type { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { TooltipProvider } from "@v1/ui/tooltip";
import { type FunctionReturnType, getFunctionName } from "convex/server";
import { beforeEach, expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { MyWorkSummary } from "./my-work-cards";
import { MyWorkBoard } from "./work-board";

type Board = FunctionReturnType<typeof api.workBoard.get>;
type Column<Key extends Board[number]["key"]> = Extract<
  Board[number],
  { key: Key }
>;
type Card<Key extends Board[number]["key"]> = Column<Key>["cards"][number];

const NOW = Date.UTC(2026, 9, 15, 9);
const DAY = 24 * 60 * 60 * 1000;
const NO_APPROVALS = {
  accession: 0,
  deaccession: 0,
  loan: 0,
  exhibition: 0,
  conservation: 0,
  imageDeletion: 0,
};

const work = vi.hoisted(() => ({
  /** What workBoard:get answers for the limits it is asked with. */
  answer: (_limits: unknown): unknown => undefined,
  asked: [] as unknown[],
}));

vi.mock("convex/react", () => ({
  useQuery: (query: never, args: { limits?: unknown }) => {
    if (getFunctionName(query) !== "workBoard:get") return undefined;
    work.asked.push(args);
    return work.answer(args.limits);
  },
}));

function showBoard(board: Board | undefined) {
  work.answer = () => board;
}

/** The columns every member gets, all empty, with the given ones replaced. */
function board(...columns: Board): Board {
  const replaced = new Set(columns.map((column) => column.key));
  return [
    ...columns,
    ...(
      [
        { key: "tasks", cards: [], hasMore: false },
        {
          key: "approvals",
          cards: [],
          hasMore: false,
          byType: NO_APPROVALS,
          moreImageDeletions: false,
        },
        { key: "reviews", cards: [], hasMore: false },
        { key: "assigned", cards: [], hasMore: false },
      ] satisfies Board
    ).filter((column) => !replaced.has(column.key)),
  ];
}

function task(index: number): Card<"tasks"> {
  return {
    _id: `task-${index}` as Id<"caseTasks">,
    caseType: "loan",
    caseId: "loan-1",
    caseLabel: "L-001",
    title: `Task ${index}`,
    status: "todo",
    ownerId: "user-1" as Id<"users">,
    viewerIsReviewer: false,
    viewerCanWork: true,
    dependsOn: [],
    openDependencyCount: 0,
    evidence: [],
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function tasks(count: number, hasMore = false): Column<"tasks"> {
  return {
    key: "tasks",
    cards: Array.from({ length: count }, (_, index) => task(index)),
    hasMore,
  };
}

function approvals(
  byType: Partial<typeof NO_APPROVALS>,
  cards: Card<"approvals">[] = [],
): Column<"approvals"> {
  return {
    key: "approvals",
    cards,
    hasMore: false,
    byType: { ...NO_APPROVALS, ...byType },
    moreImageDeletions: false,
  };
}

function conditionApprovals(count: number, hasMore = false) {
  return {
    key: "conditionApprovals",
    cards: Array.from({ length: count }, (_, index) => ({
      _id: `assessment-${index}` as Id<"conditionAssessments">,
      _creationTime: NOW,
      collectionId: `object-${index}` as Id<"collections">,
      objectTitle: `Vase ${index}`,
      accessionNumber: `A-${index}`,
      status: "submitted" as const,
      condition: "fair",
      summary: "Hairline crack",
      observationCount: 0,
      photoCount: 0,
      assessedAt: NOW,
      assessorName: "Ada",
      submittedAt: NOW,
      decidedAt: null,
      decidedByName: null,
      rejectionReason: null,
    })),
    hasMore,
  } satisfies Column<"conditionApprovals">;
}

function transfers(count: number, hasMore = false): Column<"transfers"> {
  return {
    key: "transfers",
    cards: Array.from({ length: count }, (_, index) => ({
      _id: `transfer-${index}` as Id<"organizationMoveRequests">,
      collectionTitle: `Object ${index}`,
      sourceAccessionNumber: `SRC-${index}`,
      direction: index === 0 ? "incoming" : "outgoing",
    })),
    hasMore,
  };
}

function claim(index: number, disputed: boolean): Card<"provenance"> {
  return {
    claimId: `claim-${index}` as Id<"provenanceClaims">,
    objectId: "object-1" as Id<"collections">,
    objectLabel: `Portrait ${index}`,
    statement: "Sold to the Rosenberg gallery",
    role: "owner",
    partyKind: "named",
    partyText: "Paul Rosenberg",
    confidence: "documented",
    disputed,
    createdAt: NOW,
  };
}

beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(NOW);
  work.asked = [];
  showBoard(board());
});

async function renderSummary() {
  await renderOnPage(
    <MyWorkSummary organizationId={"org" as Id<"organizations">} />,
  );
}

async function renderBoard() {
  await renderOnPage(
    <TooltipProvider>
      <MyWorkBoard organizationId={"org" as Id<"organizations">} />
    </TooltipProvider>,
  );
}

function hrefOf(name: string) {
  return screen.getByRole("link", { name }).getAttribute("href");
}

function linkTexts() {
  return screen.queryAllByRole("link").map((link) => link.textContent);
}

/** The links inside the board column whose heading matches `name`. */
function columnLinks(name: RegExp) {
  const column = within(
    screen.getByRole("heading", { name }).parentElement as HTMLElement,
  );
  return column
    .queryAllByRole("link")
    .map((link) => [link.textContent, link.getAttribute("href")]);
}

test("asks the board once with the viewer's clock and the first page of every column", async () => {
  await renderSummary();

  expect(work.asked.at(-1)).toEqual({
    organizationId: "org",
    now: NOW,
    limits: {},
  });
});

test("shows a card per kind of work waiting, each opening that kind's page", async () => {
  showBoard(
    board(
      tasks(20, true),
      approvals({
        accession: 3,
        deaccession: 2,
        exhibition: 1,
        conservation: 1,
        imageDeletion: 2,
      }),
    ),
  );

  await renderSummary();

  expect(linkTexts()).toEqual([
    "My tasks 20+",
    "Pending accession approval 3",
    "Pending removal approval 2",
    "Pending exhibition approval 1",
    "Pending conservation approval 1",
    "Pending image deletion approval 2",
  ]);
  expect(hrefOf("My tasks 20+")).toBe("/assignments");
  expect(hrefOf("Pending accession approval 3")).toBe("/accessions");
  expect(hrefOf("Pending removal approval 2")).toBe(
    "/deaccessions?status=pending",
  );
  expect(hrefOf("Pending exhibition approval 1")).toBe(
    `/exhibitions?lifecycle=proposed&asOf=${NOW}`,
  );
  expect(hrefOf("Pending conservation approval 1")).toBe(
    "/conservation?status=proposed",
  );
  expect(hrefOf("Pending image deletion approval 2")).toBe("/image-deletions");
});

test("condition assessments awaiting approval follow the other approval cards and open the approval page", async () => {
  showBoard(
    board(approvals({ conservation: 1 }), conditionApprovals(20, true)),
  );

  await renderSummary();

  expect(linkTexts()).toEqual([
    "View All",
    "Pending conservation approval 1",
    "Pending condition approval 20+",
  ]);
  expect(hrefOf("Pending condition approval 20+")).toBe(
    "/condition-assessments?status=pending",
  );
});

test("pending transfers follow the approval cards and open Transfers", async () => {
  showBoard(board(approvals({ conservation: 1 }), transfers(2)));

  await renderSummary();

  expect(linkTexts()).toEqual([
    "View All",
    "Pending conservation approval 1",
    "Pending transfers 2",
  ]);
  expect(hrefOf("Pending transfers 2")).toBe("/accessions/transfers");
});

test("unreviewed and disputed provenance claims count together", async () => {
  showBoard(
    board({
      key: "provenance",
      cards: [claim(1, false), claim(2, false), claim(3, true)],
      hasMore: false,
    }),
  );

  await renderSummary();

  expect(linkTexts()).toEqual(["Provenance claims to review 3"]);
  expect(hrefOf("Provenance claims to review 3")).toBe("/assignments");
});

test("image deletions beyond the ones counted read as more", async () => {
  showBoard(
    board({ ...approvals({ imageDeletion: 100 }), moreImageDeletions: true }),
  );

  await renderSummary();

  expect(linkTexts()).toEqual([
    "View All",
    "Pending image deletion approval 100+",
  ]);
});

test("links to My work when no card already opens it", async () => {
  showBoard(board(approvals({ loan: 4 })));

  await renderSummary();

  expect(linkTexts()).toEqual(["View All", "Pending loan approval 4"]);
  expect(hrefOf("Pending loan approval 4")).toBe("/loans?status=pending");
  expect(hrefOf("View All")).toBe("/assignments");
});

test("while the board loads, neither cards nor the empty line show", async () => {
  showBoard(undefined);

  await renderSummary();

  expect(screen.getByRole("heading", { name: "My work" })).toBeTruthy();
  expect(linkTexts()).toEqual([]);
  expect(screen.queryByText("No work waiting for you.")).toBeNull();
});

test("with nothing waiting, one quiet line replaces the cards", async () => {
  await renderSummary();

  expect(screen.getByRole("heading", { name: "My work" })).toBeTruthy();
  expect(screen.getByText("No work waiting for you.")).toBeTruthy();
  expect(linkTexts()).toEqual([]);
});

test("the board lists each waiting transfer and links to the rest", async () => {
  showBoard(board(transfers(2, true)));

  await renderBoard();

  expect(columnLinks(/^Pending transfers\s*2\+$/)).toEqual([
    [
      "Object 0SRC-0 · Awaiting acceptance",
      "/objects/move-requests/transfer-0",
    ],
    [
      "Object 1SRC-1 · Pending transfer approval",
      "/objects/move-requests/transfer-1",
    ],
    ["View All", "/accessions/transfers"],
  ]);
});

test("an approval card names its case, opens it, and marks an urgent wait", async () => {
  showBoard(
    board(
      approvals({ accession: 1, imageDeletion: 1 }, [
        {
          _id: "accession-1",
          type: "accession",
          label: "ACC-1",
          detail: "Donor",
          workflowStep: 2,
          waitingSince: NOW - 2 * DAY,
          urgent: true,
        },
        {
          _id: "deletion-1",
          type: "imageDeletion",
          label: "front.jpg",
          detail: "Vase",
          waitingSince: NOW - 3 * DAY,
          urgent: false,
        },
      ]),
    ),
  );

  await renderBoard();

  expect(columnLinks(/^Pending Your Approval\s*2$/)).toEqual([
    ["Accession ACC-1Donor2 days ago · Step 2", "/accessions/accession-1"],
    ["front.jpgVase3 days ago", "/image-deletions"],
  ]);
  expect(screen.getAllByRole("img", { name: "Urgent" })).toHaveLength(1);
});

test("loading more asks for the next page of that column and keeps the board on screen meanwhile", async () => {
  const firstPage = board(tasks(20, true));
  work.answer = (limits) =>
    limits && Object.keys(limits).length > 0 ? undefined : firstPage;

  await renderBoard();
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
  });

  expect(work.asked.at(-1)).toMatchObject({ limits: { tasks: 40 } });
  expect(
    screen.getByRole("heading", { name: /^My tasks\s*20\+$/ }),
  ).toBeTruthy();
  expect(screen.getAllByText(/^Task \d+$/)).toHaveLength(20);
});

test("a column at its last page offers no more to load", async () => {
  showBoard(board(tasks(3)));

  await renderBoard();

  expect(screen.getByRole("heading", { name: /^My tasks\s*3$/ })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
});
