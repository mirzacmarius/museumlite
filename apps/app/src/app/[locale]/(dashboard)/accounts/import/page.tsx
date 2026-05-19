"use client";

import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";
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
import { useMutation, useQuery } from "convex/react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";

interface ParsedRow {
  accountNumber?: string;
  accountType: string;
  businessName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  zipCode?: string;
  country?: string;
  contactPerson?: string;
  contactEmail?: string;
  notes?: string;
}

interface ImportState {
  step: "upload" | "preview" | "importing" | "complete";
  file: File | null;
  rows: ParsedRow[];
  errors: string[];
  jobId: Id<"importJobs"> | null;
}

const REQUIRED_COLUMNS = ["accountType"];
const OPTIONAL_COLUMNS = [
  "accountNumber",
  "businessName",
  "firstName",
  "lastName",
  "email",
  "phone",
  "address",
  "city",
  "zipCode",
  "country",
  "contactPerson",
  "contactEmail",
  "notes",
];
const ALL_COLUMNS = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS];

const VALID_ACCOUNT_TYPES = [
  "lender",
  "borrower",
  "both",
  "institution",
  "patron",
];

function parseCSV(text: string): { rows: ParsedRow[]; errors: string[] } {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) {
    return {
      rows: [],
      errors: ["CSV must have a header row and at least one data row"],
    };
  }

  const headerLine = lines[0];
  if (!headerLine) {
    return { rows: [], errors: ["Missing header row"] };
  }

  const headers = headerLine
    .split(",")
    .map((h) => h.trim().replace(/^"|"$/g, ""));

  const missingRequired = REQUIRED_COLUMNS.filter(
    (col) => !headers.some((h) => h.toLowerCase() === col.toLowerCase()),
  );

  if (missingRequired.length > 0) {
    return {
      rows: [],
      errors: [`Missing required columns: ${missingRequired.join(", ")}`],
    };
  }

  const columnMap = new Map<string, number>();
  for (const col of ALL_COLUMNS) {
    const idx = headers.findIndex((h) => h.toLowerCase() === col.toLowerCase());
    if (idx !== -1) {
      columnMap.set(col, idx);
    }
  }

  const rows: ParsedRow[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;

    const values = parseCSVLine(line);

    const getValue = (col: string): string => {
      const idx = columnMap.get(col);
      if (idx === undefined) return "";
      return (values[idx] || "").trim();
    };

    const accountType = getValue("accountType").toLowerCase();

    if (!accountType || !VALID_ACCOUNT_TYPES.includes(accountType)) {
      errors.push(
        `Row ${i + 1}: Invalid accountType "${getValue("accountType")}". Use: lender, borrower, both, institution, or patron`,
      );
      continue;
    }

    rows.push({
      accountNumber: getValue("accountNumber") || undefined,
      accountType,
      businessName: getValue("businessName") || undefined,
      firstName: getValue("firstName") || undefined,
      lastName: getValue("lastName") || undefined,
      email: getValue("email") || undefined,
      phone: getValue("phone") || undefined,
      address: getValue("address") || undefined,
      city: getValue("city") || undefined,
      zipCode: getValue("zipCode") || undefined,
      country: getValue("country") || undefined,
      contactPerson: getValue("contactPerson") || undefined,
      contactEmail: getValue("contactEmail") || undefined,
      notes: getValue("notes") || undefined,
    });
  }

  return { rows, errors };
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

export default function ImportAccountsPage() {
  const t = useScopedI18n("accounts.csvImport");
  const tAccounts = useScopedI18n("accounts");
  const tCommon = useScopedI18n("common");
  const { currentOrganizationId } = useOrganization();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<ImportState>({
    step: "upload",
    file: null,
    rows: [],
    errors: [],
    jobId: null,
  });

  const createImportJob = useMutation(api.imports.createImportJob);
  const importBatch = useMutation(api.imports.importAccountsBatch);

  const importJob = useQuery(
    api.imports.getImportJob,
    state.jobId ? { jobId: state.jobId } : "skip",
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const { rows, errors } = parseCSV(text);

        setState({
          step: "preview",
          file,
          rows,
          errors,
          jobId: null,
        });
      };
      reader.readAsText(file);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [],
  );

  const handleStartImport = useCallback(async () => {
    if (!currentOrganizationId || state.rows.length === 0) return;

    try {
      const jobId = await createImportJob({
        organizationId: currentOrganizationId as Id<"organizations">,
        type: "csv",
        totalItems: state.rows.length,
      });

      setState((prev) => ({ ...prev, step: "importing", jobId }));

      const BATCH_SIZE = 50;
      const batches = [];
      for (let i = 0; i < state.rows.length; i += BATCH_SIZE) {
        batches.push(state.rows.slice(i, i + BATCH_SIZE));
      }

      const results = await Promise.all(
        batches.map((batch, batchIndex) =>
          importBatch({
            organizationId: currentOrganizationId as Id<"organizations">,
            jobId,
            rows: batch,
            batchIndex,
          }),
        ),
      );
      const allErrors = results.flatMap((result) => result.errors);

      setState((prev) => ({
        ...prev,
        step: "complete",
        errors: [...prev.errors, ...allErrors],
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        errors: [
          ...prev.errors,
          err instanceof Error ? err.message : t("errors.importFailed"),
        ],
      }));
    }
  }, [currentOrganizationId, state.rows, createImportJob, importBatch]);

  const handleReset = useCallback(() => {
    setState({
      step: "upload",
      file: null,
      rows: [],
      errors: [],
      jobId: null,
    });
  }, []);

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
          <div className="flex w-full items-center justify-between rounded-lg border-b border-border p-6">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/accounts">
                <ArrowLeft className="mr-2 size-4" />
                {t("backToAccounts")}
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="mr-2 size-4" />
              {t("downloadTemplate")}
            </Button>
          </div>

          <div className="flex-1 overflow-auto p-6">
            {state.step === "upload" && (
              <div className="mx-auto max-w-2xl">
                <div className="mb-8 text-center">
                  <FileSpreadsheet className="mx-auto mb-4 size-12 text-muted-foreground" />
                  <h2 className="text-xl font-semibold">{t("title")}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t("description")}
                  </p>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) =>
                    e.key === "Enter" && fileInputRef.current?.click()
                  }
                  role="button"
                  tabIndex={0}
                  className="flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-8 transition-all hover:border-primary/50 hover:bg-muted/30"
                >
                  <Upload className="mb-4 size-10 text-muted-foreground" />
                  <p className="font-medium">{t("dropZone")}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("maxRows")}
                  </p>
                </div>

                <div className="mt-8 rounded-lg border border-border bg-muted/30 p-4">
                  <h3 className="mb-2 font-medium">
                    {t("formatRequirements")}
                  </h3>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>
                      <strong>{t("required")}</strong> accountType
                    </li>
                    <li>
                      <strong>{t("accountTypes")}</strong>{" "}
                      {t("accountTypesValues")}
                    </li>
                    <li>
                      <strong>{t("forInstitutions")}</strong>{" "}
                      {t("forInstitutionsValues")}
                    </li>
                    <li>
                      <strong>{t("forIndividuals")}</strong>{" "}
                      {t("forIndividualsValues")}
                    </li>
                    <li>
                      <strong>{t("optional")}</strong> {t("optionalValues")}
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {state.step === "preview" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">
                      {t("previewTitle")}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {t("rowsReady", {
                        count: state.rows.length.toString(),
                        filename: state.file?.name || "",
                      })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleReset}>
                      <X className="mr-2 size-4" />
                      {t("cancel")}
                    </Button>
                    <PermissionGate permission="accounts.write">
                      <Button
                        onClick={handleStartImport}
                        disabled={state.rows.length === 0}
                        className="bg-primary hover:bg-primary/90"
                      >
                        <Upload className="mr-2 size-4" />
                        {t("importButton", {
                          count: state.rows.length.toString(),
                        })}
                      </Button>
                    </PermissionGate>
                  </div>
                </div>

                {state.errors.length > 0 && (
                  <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
                    <div className="flex items-center gap-2 text-destructive">
                      <AlertCircle className="size-4" />
                      <span className="font-medium">
                        {t("validationErrors", {
                          count: state.errors.length.toString(),
                        })}
                      </span>
                    </div>
                    <ul className="mt-2 space-y-1 text-sm text-destructive">
                      {state.errors.slice(0, 5).map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                      {state.errors.length > 5 && (
                        <li>... and {state.errors.length - 5} more</li>
                      )}
                    </ul>
                  </div>
                )}

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
                      {state.rows.slice(0, 20).map((row, rowIndex) => (
                        <TableRow key={`${row.accountType}-${rowIndex}`}>
                          <TableCell className="text-muted-foreground">
                            {rowIndex + 1}
                          </TableCell>
                          <TableCell className="capitalize">
                            {row.accountType}
                          </TableCell>
                          <TableCell>
                            {row.businessName ||
                              [row.firstName, row.lastName]
                                .filter(Boolean)
                                .join(" ") ||
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
                  {state.rows.length > 20 && (
                    <div className="border-t border-border p-3 text-center text-sm text-muted-foreground">
                      Showing 20 of {state.rows.length} rows
                    </div>
                  )}
                </div>
              </div>
            )}

            {state.step === "importing" && (
              <div className="mx-auto max-w-md text-center">
                <Loader2 className="mx-auto mb-4 size-12 animate-spin text-primary" />
                <h2 className="text-xl font-semibold">Importing Accounts...</h2>
                <p className="mt-2 text-muted-foreground">
                  {importJob?.processedItems || 0} of{" "}
                  {importJob?.totalItems || state.rows.length} processed
                </p>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${importJob?.progress || 0}%` }}
                  />
                </div>
              </div>
            )}

            {state.step === "complete" && (
              <div className="mx-auto max-w-md text-center">
                <CheckCircle2 className="mx-auto mb-4 size-12 text-green-500" />
                <h2 className="text-xl font-semibold">Import Complete</h2>
                <p className="mt-2 text-muted-foreground">
                  Successfully imported{" "}
                  {importJob?.processedItems || state.rows.length} accounts
                </p>

                {state.errors.length > 0 && (
                  <div className="mt-6 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-left">
                    <div className="flex items-center gap-2 text-amber-600">
                      <AlertCircle className="size-4" />
                      <span className="font-medium">
                        {state.errors.length} rows had issues
                      </span>
                    </div>
                    <ul className="mt-2 space-y-1 text-sm text-amber-600">
                      {state.errors.slice(0, 5).map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                      {state.errors.length > 5 && (
                        <li>... and {state.errors.length - 5} more</li>
                      )}
                    </ul>
                  </div>
                )}

                <div className="mt-6 flex justify-center gap-4">
                  <Button variant="outline" onClick={handleReset}>
                    Import More
                  </Button>
                  <Button asChild className="bg-primary hover:bg-primary/90">
                    <Link href="/accounts">View Accounts</Link>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
