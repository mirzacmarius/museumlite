"use client";

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
import { useQuery } from "convex/react";
import { Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { useState } from "react";
import type { ImportType } from "./data-csv-utils";
import { DataImportJobsCard } from "./data-import-jobs-card";
import { useDataImport } from "./use-data-import";

interface DataImportTabProps {
  organizationId: Id<"organizations">;
}

export function DataImportTab({ organizationId }: DataImportTabProps) {
  const t = useScopedI18n("settings.data");
  const [importType, setImportType] = useState<ImportType>("objects");

  const template = useQuery(api.imports.getImportTemplateByType, {
    type: importType,
  });

  const importJobs = useQuery(api.imports.listImportJobs, {
    organizationId,
  });

  const { importing, fileInputRef, downloadTemplate, handleFileSelect } =
    useDataImport(organizationId, importType, template);

  return (
    <div className="space-y-6 pt-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-5" />
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
                <SelectItem value="accessions">{t("accessions")}</SelectItem>
                <SelectItem value="locations">{t("locations")}</SelectItem>
                <SelectItem value="accounts">{t("accounts")}</SelectItem>
                <SelectItem value="loans">{t("loans")}</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="mr-2 size-4" />
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
                  Importing…
                </>
              ) : (
                <>
                  <Upload className="mr-2 size-4" />
                  Upload CSV
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {importJobs && <DataImportJobsCard importJobs={importJobs} />}
    </div>
  );
}
