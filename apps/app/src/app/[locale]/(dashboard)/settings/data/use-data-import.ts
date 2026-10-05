"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { parseCsvTable, sha256Hex } from "@/lib/csv-parser";
import { downloadCsv, type ImportType } from "./data-csv-utils";

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
  const importObjectsDublinCore = useMutation(
    api.imports.importObjectsDublinCore,
  );
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
        const isXml = file.name.toLowerCase().endsWith(".xml");

        if (isXml) {
          if (importType !== "objects") {
            throw new Error("XML import is only supported for objects");
          }

          const [xml, jobId] = await Promise.all([
            file.text(),
            createImportJob({
              organizationId,
              type: "csv",
              totalItems: 1,
            }),
          ]);

          await importObjectsDublinCore({
            organizationId,
            jobId,
            xml,
          });
          return;
        }

        const text = await file.text();
        const table = parseCsvTable(text);
        const headers = table.headers;
        const dataRows = table.records;

        if (dataRows.length === 0) {
          throw new Error("No data rows found in CSV");
        }

        const jobId = await createImportJob({
          organizationId,
          type: "csv",
          entityType: importType,
          totalItems: dataRows.length,
          sourceName: file.name,
          sourceFingerprint: await sha256Hex(text),
        });

        // Batches run in order so progress and replays stay deterministic.
        const batchSize = 50;
        for (let i = 0; i < dataRows.length; i += batchSize) {
          const batch = dataRows.slice(i, i + batchSize);
          const batchData = batch.map((record) => {
            const obj: Record<string, string | undefined> = {};
            headers.forEach((header, idx) => {
              if (header && record.values[idx] !== undefined) {
                obj[header] = record.values[idx] || undefined;
              }
            });
            return obj;
          });

          const batchIndex = Math.floor(i / batchSize);

          switch (importType) {
            case "objects":
              await importObjectsBatch({
                organizationId,
                jobId,
                rows: batchData as Parameters<
                  typeof importObjectsBatch
                >[0]["rows"],
                batchIndex,
              });
              break;
            case "accessions":
              await importAccessionsBatch({
                organizationId,
                jobId,
                rows: batch.map((record, index) => ({
                  ...(batchData[index] as Omit<
                    Parameters<typeof importAccessionsBatch>[0]["rows"][number],
                    "rowNumber"
                  >),
                  rowNumber: record.rowNumber,
                })),
                batchIndex,
              });
              break;
            case "locations":
              await importLocationsBatch({
                organizationId,
                jobId,
                rows: batchData as Parameters<
                  typeof importLocationsBatch
                >[0]["rows"],
                batchIndex,
              });
              break;
            case "accounts":
              await importAccountsBatch({
                organizationId,
                jobId,
                rows: batchData as Parameters<
                  typeof importAccountsBatch
                >[0]["rows"],
                batchIndex,
              });
              break;
            case "loans":
              await importLoansBatch({
                organizationId,
                jobId,
                rows: batchData as Parameters<
                  typeof importLoansBatch
                >[0]["rows"],
                batchIndex,
              });
              break;
          }
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Import failed");
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
      importObjectsDublinCore,
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
