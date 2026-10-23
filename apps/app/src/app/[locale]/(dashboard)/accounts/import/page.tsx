"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@v1/ui/table";
import { useMutation } from "convex/react";
import {
  AlertCircle,
  ArrowLeft,
  Download,
  FileSpreadsheet,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  type ChangeEvent,
  type RefObject,
  useCallback,
  useRef,
  useState,
} from "react";
import { ResumableImportNotice } from "@/components/import/resumable-import-notice";
import { TrackedImportOutcome } from "@/components/import/tracked-import-outcome";
import { TrackedImportProgress } from "@/components/import/tracked-import-progress";
import { ImportJobUnavailable } from "@/components/import-job-unavailable";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { useCsvFileProblemMessage } from "@/hooks/use-csv-file-problem-message";
import { useTrackedImportFlow } from "@/hooks/use-tracked-import-flow";
import { sha256Hex } from "@/lib/csv-parser";
import { useScopedI18n } from "@/locales/client";
import {
  type AccountImportMessages,
  type ParsedRow,
  parseAccountCsv,
} from "./import-csv";

interface ImportState {
  /** File steps before the import runs; the run itself is tracked separately. */
  step: "upload" | "preview";
  file: File | null;
  /** SHA-256 of the source text; identifies a re-uploaded file. */
  fingerprint: string | null;
  rows: ParsedRow[];
  fileErrors: string[];
  rowErrors: string[];
}

const INITIAL_STATE: ImportState = {
  step: "upload",
  file: null,
  fingerprint: null,
  rows: [],
  fileErrors: [],
  rowErrors: [],
};

function ImportAccountsHeader({
  backLabel,
  downloadTemplateLabel,
  onDownloadTemplate,
}: {
  backLabel: string;
  downloadTemplateLabel: string;
  onDownloadTemplate: () => void;
}) {
  return (
    <div className="flex w-full items-center justify-between rounded-lg border-b border-border p-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/accounts">
          <ArrowLeft className="mr-2 size-4" />
          {backLabel}
        </Link>
      </Button>
      <Button variant="outline" size="sm" onClick={onDownloadTemplate}>
        <Download className="mr-2 size-4" />
        {downloadTemplateLabel}
      </Button>
    </div>
  );
}

function AccountImportUploadStep({
  fileInputRef,
  labels,
  onFileSelect,
}: {
  fileInputRef: RefObject<HTMLInputElement | null>;
  labels: {
    title: string;
    description: string;
    dropZone: string;
    maxRows: string;
    formatRequirements: string;
    required: string;
    accountTypes: string;
    accountTypesValues: string;
    forInstitutions: string;
    forInstitutionsValues: string;
    forIndividuals: string;
    forIndividualsValues: string;
    optional: string;
    optionalValues: string;
  };
  onFileSelect: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 text-center">
        <FileSpreadsheet className="mx-auto mb-4 size-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">{labels.title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {labels.description}
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={onFileSelect}
        className="hidden"
      />

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="flex min-h-[200px] w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-8 transition-all hover:border-primary/50 hover:bg-muted/30"
      >
        <Upload className="mb-4 size-10 text-muted-foreground" />
        <p className="font-medium">{labels.dropZone}</p>
        <p className="mt-1 text-sm text-muted-foreground">{labels.maxRows}</p>
      </button>

      <div className="mt-8 rounded-lg border border-border bg-muted/30 p-4">
        <h3 className="mb-2 font-medium">{labels.formatRequirements}</h3>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>
            <strong>{labels.required}</strong> accountType
          </li>
          <li>
            <strong>{labels.accountTypes}</strong> {labels.accountTypesValues}
          </li>
          <li>
            <strong>{labels.forInstitutions}</strong>{" "}
            {labels.forInstitutionsValues}
          </li>
          <li>
            <strong>{labels.forIndividuals}</strong>{" "}
            {labels.forIndividualsValues}
          </li>
          <li>
            <strong>{labels.optional}</strong> {labels.optionalValues}
          </li>
        </ul>
      </div>
    </div>
  );
}

function AccountImportErrors({
  errors,
  title,
  tone = "destructive",
}: {
  errors: string[];
  title: string;
  tone?: "destructive" | "warning";
}) {
  if (errors.length === 0) {
    return null;
  }

  const colorClasses =
    tone === "warning"
      ? "border-amber-500/50 bg-amber-500/10 text-amber-600"
      : "border-destructive bg-destructive/10 text-destructive";

  return (
    <div className={`rounded-lg border p-4 ${colorClasses}`}>
      <div className="flex items-center gap-2">
        <AlertCircle className="size-4" />
        <span className="font-medium">{title}</span>
      </div>
      <ul className="mt-2 space-y-1 text-sm">
        {errors.slice(0, 5).map((error) => (
          <li key={error}>{error}</li>
        ))}
        {errors.length > 5 ? <li>... and {errors.length - 5} more</li> : null}
      </ul>
    </div>
  );
}

function AccountImportPreviewStep({
  labels,
  onCancel,
  onStartImport,
  organizationId,
  runErrors,
  state,
}: {
  labels: {
    previewTitle: string;
    rowsReady: string;
    cancel: string;
    importButton: string;
    validationErrors: string;
  };
  onCancel: () => void;
  onStartImport: (resumeJobId?: Id<"importJobs">) => void;
  organizationId: string;
  /** Errors from a start attempt that never reached the server. */
  runErrors: string[];
  state: ImportState;
}) {
  const tracked = useScopedI18n("trackedImport");
  const errors = [...state.fileErrors, ...runErrors];
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{labels.previewTitle}</h2>
          <p className="text-sm text-muted-foreground">{labels.rowsReady}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            <X className="mr-2 size-4" />
            {labels.cancel}
          </Button>
          <PermissionGate permission="accounts.write">
            <Button
              onClick={() => onStartImport()}
              disabled={state.rows.length === 0 || state.fileErrors.length > 0}
              className="bg-primary hover:bg-primary/90"
            >
              <Upload className="mr-2 size-4" />
              {labels.importButton}
            </Button>
          </PermissionGate>
        </div>
      </div>

      <PermissionGate permission="accounts.write">
        <ResumableImportNotice
          organizationId={organizationId}
          entityType="accounts"
          fingerprint={state.fingerprint}
          rowCount={state.rows.length}
          onResume={(jobId) => onStartImport(jobId)}
        />
      </PermissionGate>

      <AccountImportErrors errors={errors} title={labels.validationErrors} />

      {state.rowErrors.length > 0 ? (
        <AccountImportErrors
          errors={state.rowErrors}
          title={tracked("rowsWillFail", { count: state.rowErrors.length })}
          tone="warning"
        />
      ) : null}

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Name/Business</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Contact</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {state.rows.slice(0, 20).map((row) => (
              <TableRow key={row.rowNumber}>
                <TableCell className="text-muted-foreground">
                  {row.rowNumber}
                </TableCell>
                <TableCell className="capitalize">{row.accountType}</TableCell>
                <TableCell>
                  {row.businessName ||
                    [row.firstName, row.lastName].filter(Boolean).join(" ") ||
                    "-"}
                </TableCell>
                <TableCell>{row.email || "-"}</TableCell>
                <TableCell>{row.phone || "-"}</TableCell>
                <TableCell>{row.city || "-"}</TableCell>
                <TableCell>{row.contactPerson || "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {state.rows.length > 20 ? (
          <div className="border-t border-border p-3 text-center text-sm text-muted-foreground">
            Showing 20 of {state.rows.length} rows
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function ImportAccountsPage() {
  const t = useScopedI18n("accounts.csvImport");
  const tImport = useScopedI18n("untranslatedDashboard.accountsImport");
  const csvMessage = useCsvFileProblemMessage();
  const tAccounts = useScopedI18n("accounts");
  const _tCommon = useScopedI18n("common");
  const { currentOrganizationId } = useOrganization();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<ImportState>(INITIAL_STATE);

  const importMessages: AccountImportMessages = {
    csvMissingHeaderAndRows: () => tImport("csvMissingHeaderAndRows"),
    csvMissingRequiredColumns: (columns) =>
      tImport("csvMissingRequiredColumns", { columns }),
    invalidAccountType: (row, value) =>
      tImport("invalidAccountType", { row, value }),
    emptyValue: () => tImport("emptyValue"),
    unreadableFile: (problem) =>
      csvMessage(problem) ?? tImport("csvMissingHeaderAndRows"),
  };

  const importBatch = useMutation(api.imports.importAccountsBatch);
  const run = useTrackedImportFlow<ParsedRow>({
    organizationId: currentOrganizationId,
    entityType: "accounts",
    sendBatch: importBatch,
    parseCorrection: (text) => {
      const { rows, fileErrors } = parseAccountCsv(text, importMessages);
      if (fileErrors.length > 0) return fileErrors.join(" ");
      return rows;
    },
  });

  const handleFileSelect = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      void (async () => {
        const text = await file.text();
        const { rows, fileErrors, rowErrors } = parseAccountCsv(
          text,
          importMessages,
        );
        setState({
          step: "preview",
          file,
          fingerprint: await sha256Hex(text),
          rows: fileErrors.length > 0 ? [] : rows,
          fileErrors,
          rowErrors,
        });
      })();

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [importMessages],
  );

  const handleStartImport = useCallback(
    (resumeJobId?: Id<"importJobs">) => {
      if (state.rows.length === 0) return;
      void run.start(state.rows, {
        sourceName: state.file?.name,
        fingerprint: state.fingerprint,
        resumeJobId,
      });
    },
    [run, state.file, state.fingerprint, state.rows],
  );

  const handleReset = useCallback(() => {
    run.reset();
    setState(INITIAL_STATE);
  }, [run]);

  const downloadTemplate = useCallback(() => {
    const headers =
      "accountType,businessName,firstName,lastName,email,phone,address,city,zipCode,country,contactPerson,contactEmail,notes";
    const example =
      '"institution","City Art Museum","","","info@cityartmuseum.org","555-0100","100 Museum Plaza","New York","10001","USA","John Smith","jsmith@cityartmuseum.org","Major lending partner"';
    const csv = `${headers}\n${example}`;

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "account-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  if (!currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">
          {tAccounts("selectOrganizationImport")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex size-full bg-background px-6">
      <div className="z-10 mx-auto flex size-full max-w-screen-xl gap-12">
        <div className="flex w-full flex-col rounded-lg border border-border bg-card">
          <ImportAccountsHeader
            backLabel={t("backToAccounts")}
            downloadTemplateLabel={t("downloadTemplate")}
            onDownloadTemplate={downloadTemplate}
          />

          <div className="flex-1 overflow-auto p-6">
            {run.jobUnavailable ? (
              <ImportJobUnavailable onReset={handleReset} />
            ) : run.phase === "importing" ? (
              <TrackedImportProgress
                importJob={run.importJob}
                fallbackTotal={state.rows.length}
                onCancel={run.cancel}
              />
            ) : run.phase === "complete" ? (
              <TrackedImportOutcome
                importJob={run.importJob}
                errors={run.errors}
                fileName={state.file?.name}
                viewHref="/accounts"
                viewLabel={t("backToAccounts")}
                onReset={handleReset}
                onRetryFailed={run.retryFailed}
                onUploadCorrection={run.uploadCorrection}
              />
            ) : state.step === "upload" ? (
              <AccountImportUploadStep
                fileInputRef={fileInputRef}
                labels={{
                  title: t("title"),
                  description: t("description"),
                  dropZone: t("dropZone"),
                  maxRows: t("maxRows"),
                  formatRequirements: t("formatRequirements"),
                  required: t("required"),
                  accountTypes: t("accountTypes"),
                  accountTypesValues: t("accountTypesValues"),
                  forInstitutions: t("forInstitutions"),
                  forInstitutionsValues: t("forInstitutionsValues"),
                  forIndividuals: t("forIndividuals"),
                  forIndividualsValues: t("forIndividualsValues"),
                  optional: t("optional"),
                  optionalValues: t("optionalValues"),
                }}
                onFileSelect={handleFileSelect}
              />
            ) : (
              <AccountImportPreviewStep
                labels={{
                  previewTitle: t("previewTitle"),
                  rowsReady: t("rowsReady", {
                    count: state.rows.length.toString(),
                    filename: state.file?.name || "",
                  }),
                  cancel: t("cancel"),
                  importButton: t("importButton", {
                    count: state.rows.length.toString(),
                  }),
                  validationErrors: t("validationErrors", {
                    count: state.fileErrors.length.toString(),
                  }),
                }}
                onCancel={handleReset}
                onStartImport={handleStartImport}
                organizationId={currentOrganizationId}
                runErrors={run.errors}
                state={state}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
