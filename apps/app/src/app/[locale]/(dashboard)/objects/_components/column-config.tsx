"use client";

import { useScopedI18n } from "@/locales/client";
import { Button } from "@v1/ui/button";
import { Checkbox } from "@v1/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@v1/ui/dropdown-menu";
import { Settings2 } from "lucide-react";
import { useMemo } from "react";

export interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
  required?: boolean;
}

export const COLUMN_IDS = [
  "checkbox",
  "image",
  "title",
  "accessionNumber",
  "location",
  "objectType",
  "status",
] as const;

export type ColumnId = (typeof COLUMN_IDS)[number];

export const DEFAULT_COLUMN_CONFIG: Record<
  ColumnId,
  { visible: boolean; required?: boolean }
> = {
  checkbox: { visible: true, required: true },
  image: { visible: true },
  title: { visible: true, required: true },
  accessionNumber: { visible: true },
  location: { visible: true },
  objectType: { visible: true },
  status: { visible: true },
};

const COLUMN_LABEL_KEYS = {
  checkbox: "select",
  image: "image",
  title: "titleColumn",
  accessionNumber: "accessionNumber",
  location: "location",
  objectType: "objectType",
  status: "status",
} as const;

export function useDefaultColumns(): ColumnConfig[] {
  const t = useScopedI18n("objects.columnConfig");
  return useMemo(
    () =>
      COLUMN_IDS.map((id) => ({
        id,
        label: t(COLUMN_LABEL_KEYS[id]),
        visible: DEFAULT_COLUMN_CONFIG[id].visible,
        required: DEFAULT_COLUMN_CONFIG[id].required,
      })),
    [t],
  );
}

interface ColumnConfigDropdownProps {
  columns: ColumnConfig[];
  onColumnToggle: (columnId: string, visible: boolean) => void;
}

export function ColumnConfigDropdown({
  columns,
  onColumnToggle,
}: ColumnConfigDropdownProps) {
  const t = useScopedI18n("objects.columnConfig");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Settings2 className="h-4 w-4" />
          <span className="sr-only">{t("title")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>{t("visibleColumns")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="p-2 space-y-2">
          {columns.map((column) => (
            <label
              key={column.id}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Checkbox
                checked={column.visible}
                onCheckedChange={(checked) =>
                  onColumnToggle(column.id, !!checked)
                }
                disabled={column.required}
              />
              <span className="text-sm">{column.label}</span>
            </label>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
