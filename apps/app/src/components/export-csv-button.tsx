"use client";

import { Button, type ButtonProps } from "@v1/ui/button";
import { Download, Loader2 } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { convertToCSV } from "@/lib/format-converters";
import { useI18n } from "@/locales/client";

interface ExportCSVButtonProps extends ButtonProps {
  data?: Record<string, unknown>[];
  onExport?: () => Promise<Record<string, unknown>[] | undefined>;
  filename: string;
}

export function ExportCSVButton({
  data,
  onExport,
  filename,
  disabled,
  className,
  variant = "outline",
  size,
  children,
  ...props
}: ExportCSVButtonProps) {
  const t = useI18n();
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
    } catch (_error) {
      toast.error(t("common.toast.exportFailed"));
    } finally {
      setIsExporting(false);
    }
  }, [data, filename, isExporting, onExport]);

  const isDisabled =
    disabled || isExporting || (data ? data.length === 0 : false);

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleExport}
      disabled={isDisabled}
      {...props}
    >
      {isExporting ? (
        <Loader2 className="animate-spin" strokeWidth={1.75} />
      ) : (
        <Download strokeWidth={1.75} />
      )}
      {children || "Export CSV"}
    </Button>
  );
}
