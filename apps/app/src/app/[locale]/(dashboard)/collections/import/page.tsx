"use client";

import {
  type FieldMapping,
  ImportFieldMapper,
} from "@/components/import-field-mapper";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { parseCSV } from "@/lib/csv-parser";
import { useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@v1/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
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
import { useCallback, useMemo, useRef, useState } from "react";

interface ParsedRow {
  accessionNumber?: string;
  title: string;
  alternativeTitle?: string;
  creator?: string;
  objectType?: string;
  objectName?: string;
  culture?: string;
  period?: string;
  dateCreated?: string;
  materials?: string;
  technique?: string;
  dimensions?: string;
  description?: string;
  condition?: string;
  provenance?: string;
  location?: string;
  collectionGroup?: string;
}

interface ImportState {
  step:
    | "upload"
    | "mapping"
    | "validation"
    | "preview"
    | "importing"
    | "complete";
  file: File | null;
  rawData: Record<string, string>[];
  sourceFields: string[];
  fieldMappings: FieldMapping[];
  selectedTemplate: string | null;
  rows: ParsedRow[];
  validationErrors: string[];
  errors: string[];
  jobId: Id<"importJobs"> | null;
}

const REQUIRED_COLUMNS = ["title"];
const OPTIONAL_COLUMNS = [
  "accessionNumber",
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
];
const ALL_COLUMNS = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS];

const TARGET_FIELDS = [
  {
    id: "title",
    label: "Title",
    required: true,
    description: "Object title or name",
  },
  {
    id: "accessionNumber",
    label: "Accession Number",
    required: false,
    description: "Unique identifier (auto-generated if empty)",
  },
  {
    id: "alternativeTitle",
    label: "Alternative Title",
    required: false,
    description: "Secondary or alternative name",
  },
  {
    id: "creator",
    label: "Creator",
    required: false,
    description: "Artist, maker, or creator",
  },
  {
    id: "objectType",
    label: "Object Type",
    required: false,
    description: "Type or category of object",
  },
  {
    id: "objectName",
    label: "Object Name",
    required: false,
    description: "Specific name of the object",
  },
  {
    id: "culture",
    label: "Culture",
    required: false,
    description: "Cultural origin",
  },
  {
    id: "period",
    label: "Period",
    required: false,
    description: "Historical period",
  },
  {
    id: "dateCreated",
    label: "Date Created",
    required: false,
    description: "Creation date or period",
  },
  {
    id: "materials",
    label: "Materials",
    required: false,
    description: "Materials used",
  },
  {
    id: "technique",
    label: "Technique",
    required: false,
    description: "Production technique",
  },
  {
    id: "dimensions",
    label: "Dimensions",
    required: false,
    description: "Physical dimensions",
  },
  {
    id: "description",
    label: "Description",
    required: false,
    description: "Detailed description",
  },
  {
    id: "condition",
    label: "Condition",
    required: false,
    description: "Current condition",
  },
  {
    id: "provenance",
    label: "Provenance",
    required: false,
    description: "Ownership history",
  },
  {
    id: "location",
    label: "Location",
    required: false,
    description: "Current location",
  },
  {
    id: "collectionGroup",
    label: "Collection Group",
    required: false,
    description: "Collection or group name",
  },
];

interface ImportTemplate {
  id: string;
  name: string;
  description: string;
  mappings: Record<string, string>;
}

const IMPORT_TEMPLATES: ImportTemplate[] = [
  {
    id: "pastperfect",
    name: "PastPerfect",
    description: "Import from PastPerfect Museum Software",
    mappings: {
      "Object Name": "title",
      "Cat. No": "accessionNumber",
      "Alternate Name": "alternativeTitle",
      Artist: "creator",
      "Object Type": "objectType",
      Culture: "culture",
      "Date Made": "dateCreated",
      Period: "period",
      Medium: "materials",
      Technique: "technique",
      Measurements: "dimensions",
      Description: "description",
      Condition: "condition",
      Provenance: "provenance",
      Location: "location",
      Collection: "collectionGroup",
    },
  },
  {
    id: "tms",
    name: "TMS (The Museum System)",
    description: "Import from The Museum System (TMS)",
    mappings: {
      Title: "title",
      ObjectNumber: "accessionNumber",
      AlternateTitle: "alternativeTitle",
      DisplayName: "creator",
      Classification: "objectType",
      ObjectName: "objectName",
      Culture: "culture",
      Period: "period",
      Dated: "dateCreated",
      Medium: "materials",
      Dimensions: "dimensions",
      Description: "description",
      ConditionNotes: "condition",
      Provenance: "provenance",
      CurrentLocation: "location",
      Department: "collectionGroup",
    },
  },
];

export default function ImportObjectsPage() {
  const t = useScopedI18n("collections");
  const common = useScopedI18n("common");
  const { currentOrganizationId } = useOrganization();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<ImportState>({
    step: "upload",
    file: null,
    rawData: [],
    sourceFields: [],
    fieldMappings: [],
    selectedTemplate: null,
    rows: [],
    validationErrors: [],
    errors: [],
    jobId: null,
  });

  const createImportJob = useMutation(api.imports.createImportJob);
  const importBatch = useMutation(api.imports.importObjectsBatch);

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
        const lines = text.split("\n").filter((line) => line.trim());

        if (lines.length === 0) {
          setState((prev) => ({
            ...prev,
            errors: ["CSV file is empty"],
          }));
          return;
        }

        const headerLine = lines[0];
        if (!headerLine) return;

        const headers = headerLine
          .split(",")
          .map((h) => h.trim().replace(/^"|"$/g, ""));

        const rawData: Record<string, string>[] = [];
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          if (!line) continue;

          const values = line
            .split(",")
            .map((v) => v.trim().replace(/^"|"$/g, ""));
          const row: Record<string, string> = {};

          for (let j = 0; j < headers.length; j++) {
            const header = headers[j];
            if (header) {
              row[header] = values[j] || "";
            }
          }
          rawData.push(row);
        }

        setState({
          step: "mapping",
          file,
          rawData,
          sourceFields: headers,
          fieldMappings: [],
          selectedTemplate: null,
          rows: [],
          validationErrors: [],
          errors: [],
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

  const handleSaveMappings = useCallback(
    (mappings: FieldMapping[]) => {
      setState((prev) => ({
        ...prev,
        fieldMappings: mappings,
        step: "validation",
      }));

      const mappingMap = new Map(
        mappings.flatMap((m) =>
          m.targetField === null ? [] : [[m.targetField, m.sourceField]],
        ),
      );

      const getValue = (field: string) => {
        const sourceField = mappingMap.get(field);
        return sourceField || field;
      };

      const parsedRows: ParsedRow[] = [];
      const validationErrors: string[] = [];

      for (let i = 0; i < state.rawData.length; i++) {
        const rowData = state.rawData[i];
        if (!rowData) continue;

        try {
          const titleSource = getValue("title");
          const title = rowData[titleSource];

          if (!title) {
            validationErrors.push(`Row ${i + 1}: Title is required`);
            continue;
          }

          const accessionNumberSource = getValue("accessionNumber");
          const alternativeTitleSource = getValue("alternativeTitle");
          const creatorSource = getValue("creator");
          const objectTypeSource = getValue("objectType");
          const objectNameSource = getValue("objectName");
          const cultureSource = getValue("culture");
          const periodSource = getValue("period");
          const dateCreatedSource = getValue("dateCreated");
          const materialsSource = getValue("materials");
          const techniqueSource = getValue("technique");
          const dimensionsSource = getValue("dimensions");
          const descriptionSource = getValue("description");
          const conditionSource = getValue("condition");
          const provenanceSource = getValue("provenance");
          const locationSource = getValue("location");
          const collectionGroupSource = getValue("collectionGroup");

          parsedRows.push({
            accessionNumber: rowData[accessionNumberSource] || undefined,
            title,
            alternativeTitle: rowData[alternativeTitleSource] || undefined,
            creator: rowData[creatorSource] || undefined,
            objectType: rowData[objectTypeSource] || undefined,
            objectName: rowData[objectNameSource] || undefined,
            culture: rowData[cultureSource] || undefined,
            period: rowData[periodSource] || undefined,
            dateCreated: rowData[dateCreatedSource] || undefined,
            materials: rowData[materialsSource] || undefined,
            technique: rowData[techniqueSource] || undefined,
            dimensions: rowData[dimensionsSource] || undefined,
            description: rowData[descriptionSource] || undefined,
            condition: rowData[conditionSource] || undefined,
            provenance: rowData[provenanceSource] || undefined,
            location: rowData[locationSource] || undefined,
            collectionGroup: rowData[collectionGroupSource] || undefined,
          });
        } catch (err) {
          validationErrors.push(
            `Row ${i + 1}: ${err instanceof Error ? err.message : "Parse error"}`,
          );
        }
      }

      setState((prev) => ({
        ...prev,
        rows: parsedRows,
        validationErrors,
        step: validationErrors.length > 0 ? "validation" : "preview",
      }));
    },
    [state.rawData],
  );

  const handleContinueAfterValidation = useCallback(() => {
    setState((prev) => ({ ...prev, step: "preview" }));
  }, []);

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
          err instanceof Error ? err.message : "Import failed",
        ],
      }));
    }
  }, [currentOrganizationId, state.rows, createImportJob, importBatch]);

  const handleTemplateSelect = useCallback((templateId: string) => {
    setState((prev) => ({
      ...prev,
      selectedTemplate: templateId === "" ? null : templateId,
    }));
  }, []);

  const getInitialMappings = useCallback((): FieldMapping[] | undefined => {
    if (!state.selectedTemplate) {
      return undefined;
    }

    const template = IMPORT_TEMPLATES.find(
      (t) => t.id === state.selectedTemplate,
    );
    if (!template) {
      return undefined;
    }

    return state.sourceFields.map((sourceField) => {
      const targetField = template.mappings[sourceField] || null;
      return {
        sourceField,
        targetField,
      };
    });
  }, [state.selectedTemplate, state.sourceFields]);

  const handleReset = useCallback(() => {
    setState({
      step: "upload",
      file: null,
      rawData: [],
      sourceFields: [],
      fieldMappings: [],
      selectedTemplate: null,
      rows: [],
      validationErrors: [],
      errors: [],
      jobId: null,
    });
  }, []);

  const downloadTemplate = useCallback(() => {
    const headers =
      "title,accessionNumber,creator,objectType,culture,period,dateCreated,materials,dimensions,condition,location,collectionGroup";
    const example =
      '"Portrait of a Lady","2024.001","Unknown Artist","painting","European","19th Century","c. 1850","Oil on canvas","24 x 18 inches","Good","Main Gallery","European Art"';
    const csv = `${headers}\n${example}`;

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "object-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  if (!currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">{t("selectOrganizationImport")}</p>
      </div>
    );
  }

  return (
    <div className="flex size-full bg-background px-6">
      <div className="z-10 mx-auto flex size-full max-w-screen-xl gap-12">
        <div className="flex w-full flex-col rounded-lg border border-border bg-card">
          <div className="flex w-full items-center justify-between rounded-lg border-b border-border p-6">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/collections">
                <ArrowLeft className="mr-2 size-4" />
                {t("backToCollections")}
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="mr-2 size-4" />
              {t("csvImport.downloadTemplate")}
            </Button>
          </div>

          <div className="flex-1 overflow-auto p-6">
            {state.step === "upload" && (
              <div className="mx-auto max-w-2xl">
                <div className="mb-8 text-center">
                  <FileSpreadsheet className="mx-auto mb-4 size-12 text-muted-foreground" />
                  <h2 className="text-xl font-semibold">
                    {t("csvImport.title")}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t("csvImport.description")}
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
                  <p className="font-medium">{t("csvImport.dropZone")}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("csvImport.maxRows")}
                  </p>
                </div>

                <div className="mt-8 rounded-lg border border-border bg-muted/30 p-4">
                  <h3 className="mb-2 font-medium">
                    {t("csvImport.formatTitle")}
                  </h3>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>
                      <strong>Required:</strong> title
                    </li>
                    <li>
                      <strong>Identification:</strong> accessionNumber, creator,
                      objectType, objectName
                    </li>
                    <li>
                      <strong>Context:</strong> culture, period, dateCreated
                    </li>
                    <li>
                      <strong>Physical:</strong> materials, technique,
                      dimensions, condition
                    </li>
                    <li>
                      <strong>Organization:</strong> location (by name),
                      collectionGroup (by name)
                    </li>
                    <li>
                      <strong>Documentation:</strong> description, provenance
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {state.step === "mapping" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">Map Fields</h2>
                    <p className="text-sm text-muted-foreground">
                      {state.rawData.length} rows from {state.file?.name}
                    </p>
                  </div>
                  <Button variant="outline" onClick={handleReset}>
                    <X className="mr-2 size-4" />
                    {common("cancel")}
                  </Button>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Legacy System Template</CardTitle>
                    <CardDescription>
                      Optionally select a template to automatically map fields
                      from legacy collection management systems
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <Select
                          value={state.selectedTemplate || ""}
                          onValueChange={handleTemplateSelect}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a template or map fields manually..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">
                              <span className="text-muted-foreground">
                                No template (manual mapping)
                              </span>
                            </SelectItem>
                            {IMPORT_TEMPLATES.map((template) => (
                              <SelectItem key={template.id} value={template.id}>
                                <div className="flex flex-col">
                                  <span className="font-medium">
                                    {template.name}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {template.description}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {state.selectedTemplate && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTemplateSelect("")}
                        >
                          <X className="mr-2 size-4" />
                          Clear Template
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <ImportFieldMapper
                  key={state.selectedTemplate || "manual"}
                  sourceFields={state.sourceFields}
                  targetFields={TARGET_FIELDS}
                  initialMappings={getInitialMappings()}
                  onSave={handleSaveMappings}
                />
              </div>
            )}

            {state.step === "validation" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">Validation Report</h2>
                    <p className="text-sm text-muted-foreground">
                      {state.rows.length} valid rows,{" "}
                      {state.validationErrors.length} errors
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() =>
                        setState((prev) => ({ ...prev, step: "mapping" }))
                      }
                    >
                      <ArrowLeft className="mr-2 size-4" />
                      Back to Mapping
                    </Button>
                    {state.rows.length > 0 && (
                      <Button
                        onClick={handleContinueAfterValidation}
                        className="bg-primary hover:bg-primary/90"
                      >
                        Continue with {state.rows.length} Valid Rows
                      </Button>
                    )}
                  </div>
                </div>

                {state.validationErrors.length > 0 && (
                  <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
                    <div className="flex items-center gap-2 text-destructive">
                      <AlertCircle className="size-4" />
                      <span className="font-medium">
                        {state.validationErrors.length} validation errors
                      </span>
                    </div>
                    <ul className="mt-2 max-h-96 space-y-1 overflow-auto text-sm text-destructive">
                      {Array.from(new Set(state.validationErrors)).map(
                        (error) => (
                          <li key={error}>{error}</li>
                        ),
                      )}
                    </ul>
                  </div>
                )}

                {state.rows.length > 0 && (
                  <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-4">
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle2 className="size-4" />
                      <span className="font-medium">
                        {state.rows.length} rows passed validation
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {state.step === "preview" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">
                      {t("csvImport.previewTitle")}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {state.rows.length} rows ready to import from{" "}
                      {state.file?.name}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() =>
                        setState((prev) => ({ ...prev, step: "validation" }))
                      }
                    >
                      <ArrowLeft className="mr-2 size-4" />
                      Back to Validation
                    </Button>
                    <PermissionGate permission="collections.create">
                      <Button
                        onClick={handleStartImport}
                        disabled={state.rows.length === 0}
                        className="bg-primary hover:bg-primary/90"
                      >
                        <Upload className="mr-2 size-4" />
                        Import {state.rows.length} Objects
                      </Button>
                    </PermissionGate>
                  </div>
                </div>

                {state.validationErrors.length > 0 && (
                  <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
                    <div className="flex items-center gap-2 text-amber-600">
                      <AlertCircle className="size-4" />
                      <span className="font-medium">
                        {state.validationErrors.length} rows were skipped due to
                        validation errors
                      </span>
                    </div>
                  </div>
                )}

                {state.errors.length > 0 && (
                  <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
                    <div className="flex items-center gap-2 text-destructive">
                      <AlertCircle className="size-4" />
                      <span className="font-medium">
                        {state.errors.length} validation errors
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
                        <TableHead>Accession #</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Creator</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead>Location</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {state.rows.slice(0, 20).map((row, rowIndex) => (
                        <TableRow key={`${row.title}-${rowIndex}`}>
                          <TableCell className="text-muted-foreground">
                            {rowIndex + 1}
                          </TableCell>
                          <TableCell>
                            {row.accessionNumber || "(auto)"}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {row.title}
                          </TableCell>
                          <TableCell>{row.creator || "-"}</TableCell>
                          <TableCell>{row.objectType || "-"}</TableCell>
                          <TableCell>{row.period || "-"}</TableCell>
                          <TableCell>{row.location || "-"}</TableCell>
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
                <h2 className="text-xl font-semibold">
                  {t("csvImport.importing")}
                </h2>
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
                <h2 className="text-xl font-semibold">
                  {t("csvImport.complete")}
                </h2>
                <p className="mt-2 text-muted-foreground">
                  Successfully imported{" "}
                  {importJob?.processedItems || state.rows.length} objects
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
                    {t("csvImport.importMore")}
                  </Button>
                  <Button asChild className="bg-primary hover:bg-primary/90">
                    <Link href="/collections">
                      {t("csvImport.viewCollections")}
                    </Link>
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
