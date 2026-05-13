"use client";

import { useOrganization } from "@/components/organization-provider";
import { useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Badge } from "@v1/ui/badge";
import { Button } from "@v1/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@v1/ui/card";
import { Progress } from "@v1/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@v1/ui/tabs";
import { useMutation, useQuery } from "convex/react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";

type ImportType = "objects" | "accessions" | "locations" | "accounts" | "loans";

function parseCSV(text: string): string[][] {
  const lines = text.split("\n");
  return lines.map((line) => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  });
}

function convertToCSV(
  headers: string[],
  rows: Record<string, unknown>[],
): string {
  const headerLine = headers.join(",");
  const dataLines = rows.map((row) =>
    headers
      .map((h) => {
        const value = row[h];
        if (value === null || value === undefined) return "";
        const str = String(value);
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      })
      .join(","),
  );
  return [headerLine, ...dataLines].join("\n");
}

export default function DataPage() {
  const { currentOrganizationId } = useOrganization();
  const t = useScopedI18n("settings.data");
  const tCommon = useScopedI18n("common");
  const [importType, setImportType] = useState<ImportType>("objects");
  const [importing, setImporting] = useState(false);
  const [exportType, setExportType] = useState<ImportType>("objects");
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const template = useQuery(api.imports.getImportTemplateByType, {
    type: importType,
  });

  const importJobs = useQuery(
    api.imports.listImportJobs,
    currentOrganizationId
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );

  const createImportJob = useMutation(api.imports.createImportJob);
  const importObjectsBatch = useMutation(api.imports.importObjectsBatch);
  const importAccessionsBatch = useMutation(api.imports.importAccessionsBatch);
  const importLocationsBatch = useMutation(api.imports.importLocationsBatch);
  const importAccountsBatch = useMutation(api.imports.importAccountsBatch);
  const importLoansBatch = useMutation(api.imports.importLoansBatch);

  const exportObjects = useMutation(api.imports.exportObjects);
  const exportAccessions = useMutation(api.imports.exportAccessions);
  const exportLocations = useMutation(api.imports.exportLocations);
  const exportAccounts = useMutation(api.imports.exportAccounts);
  const exportLoans = useMutation(api.imports.exportLoans);

  const downloadTemplate = useCallback(() => {
    if (!template) return;
    const csv = [
      template.headers.join(","),
      template.exampleRow.join(","),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${importType}_template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [template, importType]);

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || !currentOrganizationId || !template) return;

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
          organizationId: currentOrganizationId as Id<"organizations">,
          type: "csv",
          totalItems: dataRows.length,
        });

        const batchSize = 50;
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
              await importObjectsBatch({
                organizationId: currentOrganizationId as Id<"organizations">,
                jobId,
                rows: batchData as Parameters<
                  typeof importObjectsBatch
                >[0]["rows"],
                batchIndex,
              });
              break;
            case "accessions":
              await importAccessionsBatch({
                organizationId: currentOrganizationId as Id<"organizations">,
                jobId,
                rows: batchData as Parameters<
                  typeof importAccessionsBatch
                >[0]["rows"],
                batchIndex,
              });
              break;
            case "locations":
              await importLocationsBatch({
                organizationId: currentOrganizationId as Id<"organizations">,
                jobId,
                rows: batchData as Parameters<
                  typeof importLocationsBatch
                >[0]["rows"],
                batchIndex,
              });
              break;
            case "accounts":
              await importAccountsBatch({
                organizationId: currentOrganizationId as Id<"organizations">,
                jobId,
                rows: batchData as Parameters<
                  typeof importAccountsBatch
                >[0]["rows"],
                batchIndex,
              });
              break;
            case "loans":
              await importLoansBatch({
                organizationId: currentOrganizationId as Id<"organizations">,
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
        console.error("Import error:", error);
      } finally {
        setImporting(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [
      currentOrganizationId,
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

  const handleExport = useCallback(async () => {
    if (!currentOrganizationId) return;

    setExporting(true);
    try {
      let data: Record<string, unknown>[] = [];
      let headers: string[] = [];

      switch (exportType) {
        case "objects":
          data = await exportObjects({
            organizationId: currentOrganizationId as Id<"organizations">,
          });
          headers = [
            "accessionNumber",
            "title",
            "alternativeTitle",
            "creator",
            "objectType",
            "objectName",
            "culture",
            "period",
            "dateCreated",
            "materials",
            "technique",
            "dimensions",
            "description",
            "condition",
            "provenance",
            "location",
            "collectionGroup",
            "status",
            "createdAt",
          ];
          break;
        case "accessions":
          data = await exportAccessions({
            organizationId: currentOrganizationId as Id<"organizations">,
          });
          headers = [
            "accessionNumber",
            "dateReceived",
            "source",
            "method",
            "cost",
            "notes",
            "status",
            "createdAt",
          ];
          break;
        case "locations":
          data = await exportLocations({
            organizationId: currentOrganizationId as Id<"organizations">,
          });
          headers = [
            "name",
            "type",
            "parentLocation",
            "address",
            "capacity",
            "isActive",
            "notes",
          ];
          break;
        case "accounts":
          data = await exportAccounts({
            organizationId: currentOrganizationId as Id<"organizations">,
          });
          headers = [
            "accountNumber",
            "accountType",
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
            "createdAt",
          ];
          break;
        case "loans":
          data = await exportLoans({
            organizationId: currentOrganizationId as Id<"organizations">,
          });
          headers = [
            "loanNumber",
            "type",
            "status",
            "lenderBorrowerName",
            "lenderBorrowerContact",
            "startDate",
            "endDate",
            "terms",
            "insuranceValue",
            "itemCount",
            "notes",
            "createdAt",
          ];
          break;
      }

      const csv = convertToCSV(headers, data);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${exportType}_export_${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export error:", error);
    } finally {
      setExporting(false);
    }
  }, [
    currentOrganizationId,
    exportType,
    exportObjects,
    exportAccessions,
    exportLocations,
    exportAccounts,
    exportLoans,
  ]);

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">
          Please select an organization to manage data.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col gap-6">
      <div className="flex w-full flex-col gap-2">
        <h2 className="text-xl font-medium text-foreground">
          Data Import/Export
        </h2>
        <p className="text-sm text-muted-foreground">
          Import data from CSV files or export your data for backup and
          analysis.
        </p>
      </div>

      <Tabs defaultValue="import" className="w-full">
        <TabsList>
          <TabsTrigger value="import" className="gap-2">
            <Upload className="h-4 w-4" />
            Import
          </TabsTrigger>
          <TabsTrigger value="export" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </TabsTrigger>
        </TabsList>

        <TabsContent value="import" className="space-y-6 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                CSV Import
              </CardTitle>
              <CardDescription>
                Upload a CSV file to import data. Download the template first to
                ensure your file has the correct format.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Select
                  value={importType}
                  onValueChange={(v) => setImportType(v as ImportType)}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder={t("selectType")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="objects">{t("objects")}</SelectItem>
                    <SelectItem value="accessions">
                      {t("accessions")}
                    </SelectItem>
                    <SelectItem value="locations">{t("locations")}</SelectItem>
                    <SelectItem value="accounts">{t("accounts")}</SelectItem>
                    <SelectItem value="loans">{t("loans")}</SelectItem>
                  </SelectContent>
                </Select>

                <Button variant="outline" onClick={downloadTemplate}>
                  <Download className="mr-2 h-4 w-4" />
                  {t("downloadTemplate")}
                </Button>
              </div>

              {template && (
                <div className="rounded-lg border bg-muted/50 p-4">
                  <p className="text-sm text-muted-foreground">
                    {template.description}
                  </p>
                  <p className="mt-2 text-sm">
                    <span className="font-medium">Required fields:</span>{" "}
                    {template.requiredFields.join(", ")}
                  </p>
                </div>
              )}

              <div className="flex items-center gap-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="csv-upload"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                >
                  {importing ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload CSV
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {importJobs && importJobs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Import Jobs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {importJobs.map((job) => (
                    <div
                      key={job._id}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div className="flex items-center gap-4">
                        {job.status === "completed" ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : job.status === "failed" ? (
                          <AlertCircle className="h-5 w-5 text-red-500" />
                        ) : (
                          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                        )}
                        <div>
                          <p className="font-medium capitalize">
                            {job.type} Import
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {job.processedItems} / {job.totalItems} items
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Progress value={job.progress} className="w-32" />
                        <Badge
                          variant={
                            job.status === "completed"
                              ? "default"
                              : job.status === "failed"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {job.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="export" className="space-y-6 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                CSV Export
              </CardTitle>
              <CardDescription>
                Export your data to a CSV file for backup, analysis, or
                migration.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Select
                  value={exportType}
                  onValueChange={(v) => setExportType(v as ImportType)}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder={t("selectType")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="objects">{t("objects")}</SelectItem>
                    <SelectItem value="accessions">
                      {t("accessions")}
                    </SelectItem>
                    <SelectItem value="locations">{t("locations")}</SelectItem>
                    <SelectItem value="accounts">{t("accounts")}</SelectItem>
                    <SelectItem value="loans">{t("loans")}</SelectItem>
                  </SelectContent>
                </Select>

                <Button onClick={handleExport} disabled={exporting}>
                  {exporting ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      {t("exporting")}
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      {t("exportToCsv")}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
