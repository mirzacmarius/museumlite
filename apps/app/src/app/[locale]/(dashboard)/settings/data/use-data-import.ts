"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { useCallback, useRef, useState } from "react";
import { type ImportType, downloadCsv, parseCSV } from "./data-csv-utils";

interface ImportTemplate {
  headers: string[];
  exampleRow: string[];
  description: string;
  requiredFields: string[];
}

export function useDataImport(
  organizationId: Id<"organizations">,
  importType: ImportType,
  template: ImportTemplate | null | undefined,
) {
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createImportJob = useMutation(api.imports.createImportJob);
  const importObjectsBatch = useMutation(api.imports.importObjectsBatch);
  const importAccessionsBatch = useMutation(api.imports.importAccessionsBatch);
  const importLocationsBatch = useMutation(api.imports.importLocationsBatch);
  const importAccountsBatch = useMutation(api.imports.importAccountsBatch);
  const importLoansBatch = useMutation(api.imports.importLoansBatch);

  const downloadTemplate = useCallback(() => {
    if (!template) return;
    const csv = [
      template.headers.join(","),
      template.exampleRow.join(","),
    ].join("\n");
    downloadCsv(`${importType}_template.csv`, csv);
  }, [template, importType]);

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || !template) return;

      setImporting(true);

      try {
        const text = await file.text();
        const rows = parseCSV(text);
        const headers = rows[0];
        const dataRows = rows
          .slice(1)
          .filter((row) => row.some((cell) => cell));

        if (dataRows.length === 0) {
          throw new Error("No data rows found in CSV");
        }

        const jobId = await createImportJob({
          organizationId,
          type: "csv",
          totalItems: dataRows.length,
        });

        const batchSize = 50;
        const importTasks = [];
        for (let i = 0; i < dataRows.length; i += batchSize) {
          const batch = dataRows.slice(i, i + batchSize);
          const batchData = batch.map((row) => {
            const obj: Record<string, string | undefined> = {};
            headers?.forEach((header, idx) => {
              if (header && row[idx] !== undefined) {
                obj[header] = row[idx] || undefined;
              }
            });
            return obj;
          });

          const batchIndex = Math.floor(i / batchSize);

          switch (importType) {
            case "objects":
              importTasks.push(
                importObjectsBatch({
                  organizationId,
                  jobId,
                  rows: batchData as Parameters<
                    typeof importObjectsBatch
                  >[0]["rows"],
                  batchIndex,
                }),
              );
              break;
            case "accessions":
              importTasks.push(
                importAccessionsBatch({
                  organizationId,
                  jobId,
                  rows: batchData as Parameters<
                    typeof importAccessionsBatch
                  >[0]["rows"],
                  batchIndex,
                }),
              );
              break;
            case "locations":
              importTasks.push(
                importLocationsBatch({
                  organizationId,
                  jobId,
                  rows: batchData as Parameters<
                    typeof importLocationsBatch
                  >[0]["rows"],
                  batchIndex,
                }),
              );
              break;
            case "accounts":
              importTasks.push(
                importAccountsBatch({
                  organizationId,
                  jobId,
                  rows: batchData as Parameters<
                    typeof importAccountsBatch
                  >[0]["rows"],
                  batchIndex,
                }),
              );
              break;
            case "loans":
              importTasks.push(
                importLoansBatch({
                  organizationId,
                  jobId,
                  rows: batchData as Parameters<
                    typeof importLoansBatch
                  >[0]["rows"],
                  batchIndex,
                }),
              );
              break;
          }
        }
        await Promise.all(importTasks);
      } catch (error) {
        console.error("Import error:", error);
      } finally {
        setImporting(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [
      organizationId,
      template,
      importType,
      createImportJob,
      importObjectsBatch,
      importAccessionsBatch,
      importLocationsBatch,
      importAccountsBatch,
      importLoansBatch,
    ],
  );

  return {
    importing,
    fileInputRef,
    downloadTemplate,
    handleFileSelect,
  };
}
