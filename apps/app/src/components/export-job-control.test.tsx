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

function completedExport(
  jobId: string,
  source: ExportJob["source"],
  rows: number,
  asOf: number,
): ExportJob {
  return {
    jobId: jobId as Id<"exportJobs">,
    source,
    format: "csv",
    schemaVersion: 1,
    asOf,
    captureStartedAt: asOf,
    completedAt: asOf + 1000,
    status: "completed",
    rows,
    scanned: rows,
    selected: 0,
    bytes: rows * 100,
    checkpoint: 1,
    sourceDone: true,
    attempts: 1,
    failedAttempts: 0,
    expiresAt: asOf + 7 * 24 * 60 * 60 * 1000,
  };
}

const paintings = {
  kind: "objects",
  mode: "filtered",
  filters: { objectType: "Painting" },
} as const;

async function openPanel(source: ExportJob["source"], label: string) {
  const view = await renderOnPage(
    <ExportJobControl
      organizationId={organizationId}
      source={source}
      label={label}
    />,
    "/en/objects",
  );
  await userEvent.click(screen.getByText(label));
  return view;
}

beforeEach(() => {
  state.jobs = [];
  state.create = vi.fn().mockResolvedValue("job-new");
});

test("only the newest export of the current filters shows, so a new export replaces the old one", async () => {
  // Newest first, as exports.list returns them.
  state.jobs = [
    completedExport("job-3", paintings, 98, Date.UTC(2026, 9, 24, 11, 25, 42)),
    completedExport("job-2", paintings, 97, Date.UTC(2026, 9, 24, 11, 25, 35)),
    completedExport(
      "job-1",
      { kind: "objects", mode: "filtered", filters: { objectType: "Coin" } },
      12,
      Date.UTC(2026, 9, 24, 11, 20),
    ),
    completedExport(
      "job-0",
      { kind: "objects", mode: "selected", filters: {} },
      3,
      Date.UTC(2026, 9, 24, 11, 10),
    ),
  ];

  await openPanel(
    {
      kind: "objects",
      mode: "filtered",
      // The catalog leaves unset filters undefined; they still match.
      filters: { objectType: "Painting", search: undefined },
    },
    "Export full filtered results",
  );

  expect(screen.getAllByText(/^Filtered catalog/)).toHaveLength(1);
  expect(screen.getByRole("button", { name: "Download 98 rows" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Download 97 rows" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Download 12 rows" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Download 3 rows" })).toBeNull();
});

test("the complete catalog export ignores exports made with filters", async () => {
  state.jobs = [
    completedExport("job-2", paintings, 97, Date.UTC(2026, 9, 24, 11, 25)),
    completedExport(
      "job-1",
      { kind: "objects", mode: "filtered", filters: {} },
      1200,
      Date.UTC(2026, 9, 23, 9, 0),
    ),
  ];

  await openPanel(
    { kind: "objects", mode: "filtered", filters: {} },
    "Export complete catalog",
  );

  expect(
    screen.getByRole("button", { name: "Download 1200 rows" }),
  ).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Download 97 rows" })).toBeNull();
});

test("Create export replaces the export shown with the new one", async () => {
  state.jobs = [
    completedExport("job-1", paintings, 97, Date.UTC(2026, 9, 24, 11, 25, 35)),
  ];
  const { rerender } = await openPanel(
    paintings,
    "Export full filtered results",
  );
  expect(screen.getByRole("button", { name: "Download 97 rows" })).toBeTruthy();

  await userEvent.click(screen.getByRole("button", { name: "Create export" }));
  expect(state.create).toHaveBeenCalledWith(
    expect.objectContaining({
      organizationId,
      source: paintings,
      format: "csv",
    }),
  );

  // The new export arrives at the top of the list, still queued.
  state.jobs = [
    {
      ...completedExport(
        "job-new",
        paintings,
        0,
        Date.UTC(2026, 9, 24, 11, 25, 42),
      ),
      status: "queued",
      completedAt: undefined,
      sourceDone: false,
    },
    ...state.jobs,
  ];
  rerender(
    <ExportJobControl
      organizationId={organizationId}
      source={paintings}
      label="Export full filtered results"
    />,
  );

  expect(screen.getAllByText(/^Filtered catalog/)).toHaveLength(1);
  expect(screen.getByText(/Queued/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Download 97 rows" })).toBeNull();
});
