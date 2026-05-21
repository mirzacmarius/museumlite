"use client";

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
import { useMutation } from "convex/react";
import { Download, Loader2 } from "lucide-react";
import { useCallback, useState } from "react";
import { useScopedI18n } from "@/locales/client";
import { convertToCSV, downloadCsv, type ImportType } from "./data-csv-utils";

interface DataExportTabProps {
  organizationId: Id<"organizations">;
}

const EXPORT_HEADERS: Record<ImportType, string[]> = {
  objects: [
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
  ],
  accessions: [
    "accessionNumber",
    "dateReceived",
    "source",
    "method",
    "cost",
    "notes",
    "status",
    "createdAt",
  ],
  locations: [
    "name",
    "type",
    "parentLocation",
    "address",
    "capacity",
    "isActive",
    "notes",
  ],
  accounts: [
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
  ],
  loans: [
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
  ],
};

export function DataExportTab({ organizationId }: DataExportTabProps) {
  const t = useScopedI18n("settings.data");
  const [exportType, setExportType] = useState<ImportType>("objects");
  const [exporting, setExporting] = useState(false);

  const exportObjects = useMutation(api.imports.exportObjects);
  const exportAccessions = useMutation(api.imports.exportAccessions);
  const exportLocations = useMutation(api.imports.exportLocations);
  const exportAccounts = useMutation(api.imports.exportAccounts);
  const exportLoans = useMutation(api.imports.exportLoans);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      let data: Record<string, unknown>[] = [];

      switch (exportType) {
        case "objects":
          data = await exportObjects({ organizationId });
          break;
        case "accessions":
          data = await exportAccessions({ organizationId });
          break;
        case "locations":
          data = await exportLocations({ organizationId });
          break;
        case "accounts":
          data = await exportAccounts({ organizationId });
          break;
        case "loans":
          data = await exportLoans({ organizationId });
          break;
      }

      const headers = EXPORT_HEADERS[exportType];
      const csv = convertToCSV(headers, data);
      downloadCsv(
        `${exportType}_export_${new Date().toISOString().split("T")[0]}.csv`,
        csv,
      );
    } catch (error) {
      console.error("Export error:", error);
    } finally {
      setExporting(false);
    }
  }, [
    organizationId,
    exportType,
    exportObjects,
    exportAccessions,
    exportLocations,
    exportAccounts,
    exportLoans,
  ]);

  return (
    <div className="space-y-6 pt-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="size-5" />
            CSV Export
          </CardTitle>
          <CardDescription>
            Export your data to a CSV file for backup, analysis, or migration.
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
                <SelectItem value="accessions">{t("accessions")}</SelectItem>
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
                  <Download className="mr-2 size-4" />
                  {t("exportToCsv")}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
