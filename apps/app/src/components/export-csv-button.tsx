"use client";

import { Button } from "@v1/ui/button";
import { Download, Loader2 } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

interface ExportCSVButtonProps {
  data?: Record<string, unknown>[];
  onExport?: () => Promise<Record<string, unknown>[] | undefined>;
  filename: string;
  disabled?: boolean;
}

export function convertToCSV(data: Record<string, unknown>[]): string {
  if (data.length === 0) return "";

  const headers = Object.keys(data[0] ?? {});
  const csvRows: string[] = [];

  csvRows.push(headers.join(","));

  for (const row of data) {
    const values = headers.map((header) => {
      const value = row[header];
      if (value === null || value === undefined) return "";
      if (typeof value === "number") {
        if (
          header.toLowerCase().includes("date") ||
          header.toLowerCase().includes("at")
        ) {
          return new Date(value).toISOString();
        }
        return String(value);
      }
      const stringValue = String(value);
      if (
        stringValue.includes(",") ||
        stringValue.includes('"') ||
        stringValue.includes("\n")
      ) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    });
    csvRows.push(values.join(","));
  }

  return csvRows.join("\n");
}

export function ExportCSVButton({
  data,
  onExport,
  filename,
  disabled = false,
}: ExportCSVButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = useCallback(async () => {
    if (isExporting) return;

    setIsExporting(true);

    try {
      const exportData = onExport ? await onExport() : data;
      if (!exportData || exportData.length === 0) {
        return;
      }

      const csv = convertToCSV(exportData);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${filename}-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error("Failed to export data");
    } finally {
      setIsExporting(false);
    }
  }, [data, filename, isExporting, onExport]);

  const isDisabled =
    disabled || isExporting || (data ? data.length === 0 : false);

  return (
    <Button variant="outline" onClick={handleExport} disabled={isDisabled}>
      {isExporting ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Download className="mr-2 h-4 w-4" />
      )}
      Export CSV
    </Button>
  );
}
