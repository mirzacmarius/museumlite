"use client";

import { useI18n } from "@/locales/client";
import { Button, type ButtonProps } from "@v1/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@v1/ui/dropdown-menu";
import { ChevronDown, Download, Loader2 } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

export type ExportFormat = "csv" | "json" | "xml" | "dublin-core" | "spectrum";

interface ExportFormatOption {
  value: ExportFormat;
  label: string;
  description: string;
}

const EXPORT_FORMATS: ExportFormatOption[] = [
  {
    value: "csv",
    label: "CSV",
    description: "Comma-separated values for spreadsheets",
  },
  {
    value: "json",
    label: "JSON",
    description: "JavaScript Object Notation for APIs",
  },
  {
    value: "xml",
    label: "XML",
    description: "Extensible Markup Language",
  },
  {
    value: "dublin-core",
    label: "Dublin Core",
    description: "Standardized metadata format",
  },
  {
    value: "spectrum",
    label: "SPECTRUM",
    description: "UK museum standard",
  },
];

interface ExportButtonWithFormatProps {
  onExport: (format: ExportFormat) => Promise<string | undefined>;
  filename: string;
  disabled?: boolean;
  supportedFormats?: ExportFormat[];
  buttonSize?: ButtonProps["size"];
  buttonClassName?: string;
}

export function ExportButtonWithFormat({
  onExport,
  filename,
  disabled,
  supportedFormats = ["csv", "json", "xml", "dublin-core", "spectrum"],
  buttonSize,
  buttonClassName,
}: ExportButtonWithFormatProps) {
  const t = useI18n();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      if (isExporting) return;

      setIsExporting(true);

      try {
        const content = await onExport(format);
        if (!content) {
          toast.error(t("common.toast.exportFailed"));
          return;
        }

        // Determine file extension and MIME type
        let extension = format;
        let mimeType = "text/plain";

        switch (format) {
          case "csv":
            extension = "csv";
            mimeType = "text/csv;charset=utf-8;";
            break;
          case "json":
            extension = "json";
            mimeType = "application/json;charset=utf-8;";
            break;
          case "xml":
          case "dublin-core":
          case "spectrum":
            extension = "xml";
            mimeType = "application/xml;charset=utf-8;";
            break;
        }

        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${filename}-${new Date().toISOString().split("T")[0]}.${extension}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast.success(t("common.toast.exportSuccess"));
      } catch (error) {
        toast.error(t("common.toast.exportFailed"));
      } finally {
        setIsExporting(false);
      }
    },
    [filename, isExporting, onExport, t],
  );

  const availableFormats = EXPORT_FORMATS.filter((format) =>
    supportedFormats.includes(format.value),
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className={buttonClassName}
          disabled={disabled || isExporting}
          size={buttonSize}
          variant="outline"
        >
          {isExporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Export
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {availableFormats.map((format) => (
          <DropdownMenuItem
            key={format.value}
            onClick={() => handleExport(format.value)}
            disabled={isExporting}
          >
            <div className="flex flex-col">
              <span className="font-medium">{format.label}</span>
              <span className="text-xs text-muted-foreground">
                {format.description}
              </span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
