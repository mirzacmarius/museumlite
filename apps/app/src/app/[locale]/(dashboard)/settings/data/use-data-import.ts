"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useConvex, useMutation } from "convex/react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { useActionErrorMessage } from "@/hooks/use-action-error-message";
import { readCsvTable, sha256Hex } from "@/lib/csv-parser";
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
 * Norwegian names a column may carry in exports from other collection
 * systems, tried after the template's own name. The first names are the
 * app's own Norwegian field labels. Location ("Plassering") and collection
 * ("Samling") columns are left out: a source system's names rarely match this
 * museum's Locations and groups, and the server fails every row whose name it
 * cannot find.
 */
const COLUMN_ALIASES: Record<string, string[]> = {
  accessionNumber: [
    "aksesjonsnummer",
    "inventarnummer",
    "inventarnr",
    "inventarnr.",
    "museumsnummer",
    "museumsnr",
    "museumsnr.",
    "tilvekstnummer",
    "tilvekstnr.",
    "id",
  ],
  title: ["tittel"],
  alternativeTitle: ["alternativ tittel"],
  creator: ["skaper/kunstner", "skaper", "kunstner", "produsent"],
  objectType: ["objekttype"],
  objectName: ["objektnavn", "gjenstandsnavn"],
  culture: ["kultur"],
  period: ["periode"],
  dateCreated: ["datering", "opprettelsesdato"],
  dateCreatedEdtf: ["datering (edtf)", "edtf"],
  materials: ["materialer", "materiale"],
  technique: ["teknikk"],
  dimensions: ["dimensjoner", "mål"],
  description: ["beskrivelse"],
  condition: ["tilstand"],
  provenance: ["proveniens"],
  collectionGroup: ["samlingsgruppe"],
};

/** Why a file is refused before any of its rows is sent. */
export type TemplateRowsRefusal =
  | { code: "noDataRows" }
  | { code: "unclosedQuote"; row: number }
  | { code: "missingColumns"; missing: string[]; found: string[] };

/**
 * Keeps only the template's columns, matched case-insensitively by name or a
 * Norwegian alias; when a name repeats, its first column counts. A file
 * without a required column is refused before any row is sent, since every
 * row would fail. Empty required values still fail on the server as
 * recorded, correctable rows.
 */
export function toTemplateRows(
  text: string,
  template: ImportTemplate,
): { rows: TemplateRow[] } | { refusal: TemplateRowsRefusal } {
  const read = readCsvTable(text);
  if ("problem" in read) {
    return {
      refusal:
        read.problem.code === "empty"
          ? { code: "noDataRows" }
          : { code: "unclosedQuote", row: read.problem.line },
    };
  }
  const { table } = read;
  if (table.records.length === 0) {
    return { refusal: { code: "noDataRows" } };
  }
  const headerIndex = new Map<string, number>();
  table.headers.forEach((header, index) => {
    const name = header.trim().toLowerCase();
    if (!headerIndex.has(name)) headerIndex.set(name, index);
  });
  const columnIndex = new Map<string, number>();
  for (const field of template.headers) {
    for (const name of [
      field.toLowerCase(),
      ...(COLUMN_ALIASES[field] ?? []),
    ]) {
      const index = headerIndex.get(name);
      if (index !== undefined) {
        columnIndex.set(field, index);
        break;
      }
    }
  }
  const missing = template.requiredFields.filter(
    (field) => !columnIndex.has(field),
  );
  if (missing.length > 0) {
    return {
      refusal: {
        code: "missingColumns",
        missing,
        found: table.headers.filter(Boolean).slice(0, 8),
      },
    };
  }
  const requiredFields = new Set(template.requiredFields);
  const rows = table.records.map((record) => {
    const row: TemplateRow = { rowNumber: record.rowNumber };
    for (const field of template.headers) {
      const index = columnIndex.get(field);
      const value = index === undefined ? undefined : record.values[index];
      if (value) row[field] = value;
      else if (requiredFields.has(field)) row[field] = "";
    }
    return row;
  });
  return { rows };
}

export function useDataImport(
  organizationId: Id<"organizations">,
  importType: ImportType,
  template: ImportTemplate | null | undefined,
) {
  const t = useScopedI18n("settings.data.importJobs");
  const actionMessage = useActionErrorMessage();
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

  const refusalMessage = useCallback(
    (refusal: TemplateRowsRefusal) => {
      switch (refusal.code) {
        case "noDataRows":
          return t("noDataRows");
        case "unclosedQuote":
          return t("unclosedQuote", { row: refusal.row });
        case "missingColumns":
          return t("missingColumns", {
            missing: refusal.missing.join(", "),
            found: refusal.found.join(", "),
          });
      }
    },
    [t],
  );

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
            toast.error(t("xmlObjectsOnly"));
            return;
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

        const parsed = toTemplateRows(text, template);
        if ("refusal" in parsed) {
          toast.error(refusalMessage(parsed.refusal));
          return;
        }
        const jobId = await startOrResume({
          name: file.name,
          fingerprint,
          totalItems: parsed.rows.length,
          matchTotal: true,
        });
        reportOutcome(await sendAll(importType, jobId, parsed.rows));
      } catch (error) {
        toast.error(actionMessage(error, t("importFailed")));
      } finally {
        setImporting(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [
      actionMessage,
      importObjectsDublinCore,
      importType,
      organizationId,
      refusalMessage,
      reportOutcome,
      sendAll,
      startOrResume,
      t,
      template,
    ],
  );

  /**
   * Re-sends an edited copy of a job's file; the server skips accepted rows.
   * Resolves with the reason, in the app's language, when the file is
   * refused before any row is sent.
   */
  const uploadCorrection = useCallback(
    async (
      job: { _id: Id<"importJobs">; entityType?: ImportType },
      file: File,
    ): Promise<string | undefined> => {
      if (!job.entityType) return t("correctionUnsupported");
      const jobTemplate = await convex.query(
        api.imports.getImportTemplateByType,
        { type: job.entityType },
      );
      const parsed = toTemplateRows(await file.text(), jobTemplate);
      if ("refusal" in parsed) return refusalMessage(parsed.refusal);
      reportOutcome(await sendAll(job.entityType, job._id, parsed.rows));
    },
    [convex, refusalMessage, reportOutcome, sendAll, t],
  );

  return {
    importing,
    fileInputRef,
    downloadTemplate,
    handleFileSelect,
    uploadCorrection,
  };
}
