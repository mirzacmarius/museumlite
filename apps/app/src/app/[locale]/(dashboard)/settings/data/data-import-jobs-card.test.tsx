// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import { beforeEach, expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import { DataImportJobsCard } from "./data-import-jobs-card";

type ImportJob = FunctionReturnType<typeof api.imports.listImportJobs>[number];

const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
const cancelImportJob = vi.hoisted(() => vi.fn());

vi.mock("sonner", () => ({ toast: toasts }));
vi.mock("convex/react", () => ({
  useMutation: () => cancelImportJob,
  useConvex: () => ({ query: vi.fn() }),
}));

beforeEach(() => {
  toasts.error.mockReset();
  cancelImportJob.mockReset();
});

function job(overrides: Partial<ImportJob> = {}): ImportJob {
  return {
    _id: "job-1" as Id<"importJobs">,
    _creationTime: 0,
    organizationId: "org-1" as Id<"organizations">,
    type: "csv",
    entityType: "objects",
    sourceName: "Fredrikstad.csv",
    status: "completed_with_errors",
    totalItems: 3,
    processedItems: 3,
    attemptedItems: 3,
    acceptedItems: 1,
    failedItems: 2,
    progress: 100,
    createdBy: "user-1" as Id<"users">,
    ...overrides,
  } as ImportJob;
}

async function uploadCorrection(
  onUploadCorrection: (
    job: ImportJob,
    file: File,
  ) => Promise<string | undefined>,
) {
  const { container } = await renderOnPage(
    <DataImportJobsCard
      importJobs={[job()]}
      onUploadCorrection={onUploadCorrection}
    />,
    "/en/settings/data",
  );
  const user = userEvent.setup();
  await user.click(
    screen.getByRole("button", { name: "Upload corrected file" }),
  );
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("No file input");
  await user.upload(
    input,
    new File(["title\nVase\n"], "corrected.csv", { type: "text/csv" }),
  );
}

test("a refused corrected file says why", async () => {
  const onUploadCorrection = vi.fn(async () => "The file has no data rows.");
  await uploadCorrection(onUploadCorrection);

  expect(onUploadCorrection).toHaveBeenCalledOnce();
  expect(toasts.error).toHaveBeenCalledWith("The file has no data rows.");
});

test("a failed correction never shows the server's own text", async () => {
  await uploadCorrection(async () => {
    throw new Error("Server Error");
  });

  expect(toasts.error).toHaveBeenCalledWith(
    "Could not import the corrected file.",
  );
});

test("a cancel refused for a missing permission says so in the app's words", async () => {
  cancelImportJob.mockRejectedValue(
    new ConvexError({
      code: "CAPABILITY_UNAVAILABLE",
      reason: "permission_missing",
      message: "Permission denied: collections.create",
    }),
  );
  await renderOnPage(
    <DataImportJobsCard
      importJobs={[job({ status: "processing", failedItems: 0 })]}
      onUploadCorrection={vi.fn()}
    />,
    "/en/settings/data",
  );

  await userEvent.setup().click(screen.getByRole("button", { name: "Cancel" }));

  expect(toasts.error).toHaveBeenCalledWith(
    "Your role does not include access to this. Ask an administrator to update your role.",
  );
});
