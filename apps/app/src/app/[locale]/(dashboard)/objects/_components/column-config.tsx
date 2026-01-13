"use client";

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

export interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
  required?: boolean;
}

export const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: "checkbox", label: "Select", visible: true, required: true },
  { id: "image", label: "Image", visible: true },
  { id: "title", label: "Title", visible: true, required: true },
  { id: "accessionNumber", label: "Accession #", visible: true },
  { id: "location", label: "Location", visible: true },
  { id: "objectType", label: "Object Type", visible: true },
  { id: "status", label: "Status", visible: true },
];

interface ColumnConfigDropdownProps {
  columns: ColumnConfig[];
  onColumnToggle: (columnId: string, visible: boolean) => void;
}

export function ColumnConfigDropdown({
  columns,
  onColumnToggle,
}: ColumnConfigDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Settings2 className="h-4 w-4" />
          <span className="sr-only">Configure columns</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Visible Columns</DropdownMenuLabel>
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
