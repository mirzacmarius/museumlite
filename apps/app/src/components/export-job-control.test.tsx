// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { getFunctionName } from "convex/server";
import { beforeEach, expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { ExportJobControl } from "./export-job-control";

type ExportJob = FunctionReturnType<typeof api.exports.list>[number];

const state = vi.hoisted(() => ({
  jobs: [] as unknown[],
  create: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useQuery: (query: never, args: unknown) => {
    if (args === "skip") return undefined;
    return getFunctionName(query) === "exports:list" ? state.jobs : undefined;
  },
  useMutation: (mutation: never) =>
    getFunctionName(mutation) === "exports:create" ? state.create : vi.fn(),
}));
vi.mock("@convex-dev/auth/react", () => ({ useAuthToken: () => "token" }));
vi.mock("@/env.mjs", () => ({
  env: { NEXT_PUBLIC_CONVEX_URL: "https://museumlite.convex.cloud" },
}));
vi.mock("@/hooks/use-feature-access", () => ({
  useFeatureAccess: () => ({ hasFeature: () => true }),
}));

const organizationId = "org-1" as Id<"organizations">;
const FILTERED_PANEL = "Export full filtered results";

function exportJob(
  jobId: string,
  source: ExportJob["source"],
  rows: number,
  asOf: number,
  overrides: Partial<ExportJob> = {},
): ExportJob {
  return {
    jobId: jobId as Id<"exportJobs">,
    source,
    format: "csv",
    schemaVersion: 1,
    asOf,
    captureStartedAt: asOf,
    captureCompletedAt: asOf + 500,
    completedAt: asOf + 1000,
    status: "completed",
    rows,
    scanned: rows,
    selected: 0,
    selectedCount: undefined,
    bytes: rows * 100,
    checkpoint: 1,
    sourceDone: true,
    attempts: 1,
    failedAttempts: 0,
    expiresAt: asOf + 7 * 24 * 60 * 60 * 1000,
    sha256: undefined,
    error: undefined,
    leaseUntil: undefined,
    totals: undefined,
    ...overrides,
  };
}

const paintings = {
  kind: "objects",
  mode: "filtered",
  filters: { objectType: "Painting" },
} as const;
const at = (minute: number, second = 0) =>
  Date.UTC(2026, 9, 24, 11, minute, second);

function panel(source: ExportJob["source"], label = FILTERED_PANEL) {
  return (
    <ExportJobControl
      organizationId={organizationId}
      source={source}
      label={label}
    />
  );
}

async function openPanel(source: ExportJob["source"], label = FILTERED_PANEL) {
  const view = await renderOnPage(panel(source, label), "/en/objects");
  await userEvent.click(screen.getByText(label));
  return view;
}

beforeEach(() => {
  state.jobs = [];
  state.create = vi.fn().mockResolvedValue("job-new");
});

test("creating the same export again leaves one row, the newest", async () => {
  // Newest first, as exports.list returns them. The same source written in
  // another key order is still the same results.
  state.jobs = [
    exportJob("job-2", paintings, 98, at(25, 42)),
    exportJob(
      "job-1",
      {
        filters: { objectType: "Painting" },
        kind: "objects",
        mode: "filtered",
      },
      97,
      at(25, 35),
    ),
  ];

  await openPanel(paintings);

  expect(screen.getAllByText(/^Filtered catalog/)).toHaveLength(1);
  expect(screen.getByRole("button", { name: "Download 98 rows" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Download 97 rows" })).toBeNull();
});

test("the earlier download stays listed until the new export completes", async () => {
  state.jobs = [exportJob("job-1", paintings, 97, at(25, 35))];
  const { rerender } = await openPanel(paintings);

  await userEvent.click(screen.getByRole("button", { name: "Create export" }));
  expect(state.create).toHaveBeenCalledWith(
    expect.objectContaining({
      organizationId,
      source: paintings,
      format: "csv",
    }),
  );

  const running = exportJob("job-new", paintings, 0, at(25, 42), {
    status: "queued",
    completedAt: undefined,
    sourceDone: false,
  });
  state.jobs = [running, ...state.jobs];
  rerender(panel(paintings));
  expect(screen.getByText(/Queued/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Download 97 rows" })).toBeTruthy();

  state.jobs = [
    exportJob("job-new", paintings, 98, at(25, 42)),
    ...state.jobs.slice(1),
  ];
  rerender(panel(paintings));
  expect(screen.getAllByText(/^Filtered catalog/)).toHaveLength(1);
  expect(screen.getByRole("button", { name: "Download 98 rows" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Download 97 rows" })).toBeNull();
});

test("exports of other filters, the other format and each selected export stay listed", async () => {
  state.jobs = [
    exportJob("job-5", paintings, 60, at(29), { format: "jsonl" }),
    exportJob(
      "job-4",
      { kind: "objects", mode: "filtered", filters: { objectType: "Coin" } },
      12,
      at(28),
    ),
    exportJob(
      "job-3",
      { kind: "objects", mode: "selected", filters: {} },
      3,
      at(27),
      { selected: 3, selectedCount: 3 },
    ),
    exportJob(
      "job-2",
      { kind: "objects", mode: "selected", filters: {} },
      5,
      at(26),
      { selected: 5, selectedCount: 5 },
    ),
    exportJob("job-1", paintings, 97, at(25)),
  ];

  await openPanel(paintings);

  for (const rows of [60, 12, 3, 5, 97]) {
    expect(
      screen.getByRole("button", { name: `Download ${rows} rows` }),
    ).toBeTruthy();
  }
});

test("while a repeat export runs, only the newest completed one stays beside it", async () => {
  state.jobs = [
    exportJob("job-3", paintings, 0, at(30), {
      status: "queued",
      completedAt: undefined,
      sourceDone: false,
    }),
    exportJob("job-2", paintings, 98, at(28)),
    exportJob("job-1", paintings, 97, at(25)),
  ];

  await openPanel(paintings);

  expect(screen.getByText(/Queued/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Download 98 rows" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Download 97 rows" })).toBeNull();
});

test("repeats collapse before the five-row limit, so other exports keep their place", async () => {
  state.jobs = [
    ...[96, 95, 94, 93, 92].map((rows, index) =>
      exportJob(`job-${rows}`, paintings, rows, at(30 - index)),
    ),
    exportJob(
      "job-coin",
      { kind: "objects", mode: "filtered", filters: { objectType: "Coin" } },
      12,
      at(20),
    ),
  ];

  await openPanel(paintings);

  expect(screen.getByRole("button", { name: "Download 96 rows" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Download 12 rows" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Download 95 rows" })).toBeNull();
});

test("an earlier export still running stays listed so it can be cancelled", async () => {
  const inProgress = {
    completedAt: undefined,
    sourceDone: false,
  } satisfies Partial<ExportJob>;
  state.jobs = [
    exportJob("job-2", paintings, 0, at(30), {
      ...inProgress,
      status: "queued",
    }),
    exportJob("job-1", paintings, 40, at(29), {
      ...inProgress,
      status: "running",
    }),
  ];

  await openPanel(paintings);

  expect(screen.getAllByRole("button", { name: "Cancel" })).toHaveLength(2);
});

test("a cancelled export hides no earlier download", async () => {
  state.jobs = [
    exportJob("job-2", paintings, 0, at(30), { status: "cancelled" }),
    exportJob("job-1", paintings, 97, at(25)),
  ];

  await openPanel(paintings);

  expect(screen.getByRole("button", { name: "Resume" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Download 97 rows" })).toBeTruthy();
});

test("a register panel lists one row per set of criteria for its profile", async () => {
  const valuation = (currency: string) =>
    ({
      kind: "register",
      profile: "valuation",
      criteria: { currency },
    }) as const;
  state.jobs = [
    exportJob("job-4", valuation("NOK"), 10, at(30)),
    exportJob("job-3", valuation("NOK"), 9, at(29)),
    exportJob("job-2", valuation("EUR"), 7, at(28)),
    exportJob(
      "job-1",
      { kind: "register", profile: "insurance", criteria: {} },
      4,
      at(27),
    ),
  ];

  await openPanel(
    { kind: "register", profile: "valuation", criteria: {} },
    "Export valuation report",
  );

  expect(screen.getByRole("button", { name: "Download 10 rows" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Download 7 rows" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Download 9 rows" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Download 4 rows" })).toBeNull();
});
