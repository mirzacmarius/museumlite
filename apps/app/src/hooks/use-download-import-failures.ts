"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useConvex } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useCallback } from "react";

function csvCell(value: string) {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

type ImportRowResultsPage = FunctionReturnType<
  typeof api.imports.listImportRowResults
>;

/** Downloads every failed row of an import job as `row,errors` CSV. */
export function useDownloadImportFailures() {
  const convex = useConvex();
  return useCallback(
    async (jobId: Id<"importJobs">, filename: string) => {
      const lines = ["row,errors"];
      let cursor: string | null = null;
      for (;;) {
        const page: ImportRowResultsPage = await convex.query(
          api.imports.listImportRowResults,
          {
            jobId,
            status: "failed",
            paginationOpts: { numItems: 200, cursor },
          },
        );
        for (const row of page.page) {
          lines.push(`${row.rowNumber},${csvCell(row.errors.join("; "))}`);
        }
        if (page.isDone) break;
        cursor = page.continueCursor;
      }
      const blob = new Blob([`${lines.join("\n")}\n`], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
      return lines.length - 1;
    },
    [convex],
  );
}
