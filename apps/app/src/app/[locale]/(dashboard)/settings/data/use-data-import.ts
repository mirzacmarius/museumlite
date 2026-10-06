"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useConvex, useMutation } from "convex/react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { parseCsvTable, sha256Hex } from "@/lib/csv-parser";
import { useScopedI18n } from "@/locales/client";
import { downloadCsv, type ImportType } from "./data-csv-utils";

interface ImportTemplate {
  headers: string[];
  exampleRow: string[];
  description: string;
  requiredFields: string[];
}

type TemplateRow = Record<string, string | number | undefined> & {
  rowNumber: number;
};

const BATCH_SIZE = 50;

/**
 * Keeps only the template's columns (matched case-insensitively). Required
 * columns are always present so missing values fail on the server as
 * recorded, correctable rows.
 */
function toTemplateRows(text: string, template: ImportTemplate) {
  const table = parseCsvTable(text);
  if (table.records.length === 0) {
    throw new Error("No data rows found in CSV");
  }
  const columnIndex = new Map(
    table.headers.map((header, index) => [header.toLowerCase(), index]),
  );
  const requiredFields = new Set(template.requiredFields);
  return table.records.map((record) => {
    const row: TemplateRow = { rowNumber: record.rowNumber };
    for (const field of template.headers) {
      const index = columnIndex.get(field.toLowerCase());
      const value = index === undefined ? undefined : record.values[index];
      if (value) row[field] = value;
      else if (requiredFields.has(field)) row[field] = "";
    }
    return row;
  });
}

export function useDataImport(
  organizationId: Id<"organizations">,
  importType: ImportType,
  template: ImportTemplate | null | undefined,
) {
  const t = useScopedI18n("settings.data.importJobs");
  const convex = useConvex();
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

  const sendBatch = useCallback(
    (
      type: ImportType,
      args: {
        jobId: Id<"importJobs">;
        rows: TemplateRow[];
        batchIndex: number;
      },
    ) => {
      // Rows carry exactly the template columns for `type`; the server
      // validates each value.
      const base = {
        organizationId,
        jobId: args.jobId,
        batchIndex: args.batchIndex,
      };
      switch (type) {
        case "objects":
          return importObjectsBatch({
            ...base,
            rows: args.rows as Parameters<typeof importObjectsBatch>[0]["rows"],
          });
        case "accessions":
          return importAccessionsBatch({
            ...base,
            rows: args.rows as Parameters<
              typeof importAccessionsBatch
            >[0]["rows"],
          });
        case "locations":
          return importLocationsBatch({
            ...base,
            rows: args.rows as Parameters<
              typeof importLocationsBatch
            >[0]["rows"],
          });
        case "accounts":
          return importAccountsBatch({
            ...base,
            rows: args.rows as Parameters<
              typeof importAccountsBatch
            >[0]["rows"],
          });
        case "loans":
          return importLoansBatch({
            ...base,
            rows: args.rows as Parameters<typeof importLoansBatch>[0]["rows"],
          });
      }
    },
    [
      organizationId,
      importObjectsBatch,
      importAccessionsBatch,
      importLocationsBatch,
      importAccountsBatch,
      importLoansBatch,
    ],
  );

  const sendAll = useCallback(
    async (type: ImportType, jobId: Id<"importJobs">, rows: TemplateRow[]) => {
      let failed = 0;
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const result = await sendBatch(type, {
          jobId,
          rows: rows.slice(i, i + BATCH_SIZE),
          batchIndex: Math.floor(i / BATCH_SIZE),
        });
        failed += result.errors.length;
      }
      return failed;
    },
    [sendBatch],
  );

  /** Reuses an unfinished job for the same file so accepted rows are skipped. */
  const startOrResume = useCallback(
    async (source: {
      name: string;
      fingerprint: string;
      totalItems: number;
      /** Dublin Core jobs learn their record count from the XML. */
      matchTotal: boolean;
    }) => {
      const resumable = await convex.query(api.imports.findResumableImportJob, {
        organizationId,
        entityType: importType,
        sourceFingerprint: source.fingerprint,
      });
      if (
        resumable &&
        (!source.matchTotal || resumable.totalItems === source.totalItems)
      ) {
        toast.info(t("resuming"));
        return resumable._id;
      }
      return await createImportJob({
        organizationId,
        type: "csv",
        entityType: importType,
        totalItems: source.totalItems,
        sourceName: source.name,
        sourceFingerprint: source.fingerprint,
      });
    },
    [convex, createImportJob, importType, organizationId, t],
  );

  const downloadTemplate = useCallback(() => {
    if (!template) return;
    const csv = [
      template.headers.join(","),
      template.exampleRow.join(","),
    ].join("\n");
    downloadCsv(`${importType}_template.csv`, csv);
  }, [template, importType]);

  const reportOutcome = useCallback(
    (failed: number) => {
      if (failed > 0) toast.warning(t("finishedWithFailures", { failed }));
      else toast.success(t("finished"));
    },
    [t],
  );

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || !template) return;

      setImporting(true);
      try {
        const text = await file.text();
        const fingerprint = await sha256Hex(text);

        if (file.name.toLowerCase().endsWith(".xml")) {
          if (importType !== "objects") {
            throw new Error(t("xmlObjectsOnly"));
          }
          // The server sets the record count from the XML on first use.
          const jobId = await startOrResume({
            name: file.name,
            fingerprint,
            totalItems: 1,
            matchTotal: false,
          });
          const result = await importObjectsDublinCore({
            organizationId,
            jobId,
            xml: text,
          });
          reportOutcome(result.errors.length);
          return;
        }

        const rows = toTemplateRows(text, template);
        const jobId = await startOrResume({
          name: file.name,
          fingerprint,
          totalItems: rows.length,
          matchTotal: true,
        });
        reportOutcome(await sendAll(importType, jobId, rows));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("importFailed"));
      } finally {
        setImporting(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [
      importObjectsDublinCore,
      importType,
      organizationId,
      reportOutcome,
      sendAll,
      startOrResume,
      t,
      template,
    ],
  );

  /** Re-sends an edited copy of a job's file; the server skips accepted rows. */
  const uploadCorrection = useCallback(
    async (
      job: { _id: Id<"importJobs">; entityType?: ImportType },
      file: File,
    ) => {
      if (!job.entityType) throw new Error(t("correctionUnsupported"));
      const jobTemplate = await convex.query(
        api.imports.getImportTemplateByType,
        { type: job.entityType },
      );
      const rows = toTemplateRows(await file.text(), jobTemplate);
      reportOutcome(await sendAll(job.entityType, job._id, rows));
    },
    [convex, reportOutcome, sendAll, t],
  );

  return {
    importing,
    fileInputRef,
    downloadTemplate,
    handleFileSelect,
    uploadCorrection,
  };
}
