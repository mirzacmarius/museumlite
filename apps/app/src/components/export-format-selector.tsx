"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";

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

interface ExportFormatSelectorProps {
  value: ExportFormat;
  onValueChange: (value: ExportFormat) => void;
  disabled?: boolean;
  className?: string;
}

export function ExportFormatSelector({
  value,
  onValueChange,
  disabled,
  className,
}: ExportFormatSelectorProps) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={className}>
        <SelectValue placeholder="Select format" />
      </SelectTrigger>
      <SelectContent>
        {EXPORT_FORMATS.map((format) => (
          <SelectItem key={format.value} value={format.value}>
            <div className="flex flex-col">
              <span className="font-medium">{format.label}</span>
              <span className="text-xs text-muted-foreground">
                {format.description}
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
