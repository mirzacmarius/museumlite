"use client";

import { cn } from "@v1/ui/utils";
import * as React from "react";

export interface RackItem {
  id: string;
  row: number;
  column: number;
  status: "occupied" | "empty" | "reserved";
  label?: string;
}

export interface RackVisualizationProps {
  rows: number;
  columns: number;
  items: RackItem[];
  onItemClick?: (item: RackItem) => void;
  className?: string;
}

export function RackVisualization({
  rows,
  columns,
  items,
  onItemClick,
  className,
}: RackVisualizationProps) {
  // Create a map of items by position
  const itemMap = React.useMemo(() => {
    const map = new Map<string, RackItem>();
    for (const item of items) {
      map.set(`${item.row}-${item.column}`, item);
    }
    return map;
  }, [items]);

  // Generate grid cells
  const cells = React.useMemo(() => {
    const result: Array<{ row: number; column: number; item?: RackItem }> = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < columns; c++) {
        const item = itemMap.get(`${r}-${c}`);
        result.push({ row: r, column: c, item });
      }
    }
    return result;
  }, [rows, columns, itemMap]);

  const getStatusClasses = (status: RackItem["status"]) => {
    switch (status) {
      case "occupied":
        return "bg-emerald-500/10 border-emerald-500/20 text-emerald-400";
      case "reserved":
        return "bg-amber-500/10 border-amber-500/20 text-amber-400";
      default:
        return "bg-muted/30 border-border text-muted-foreground";
    }
  };

  return (
    <div
      className={cn("grid gap-2", className)}
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      }}
    >
      {cells.map(({ row, column, item }) => {
        const status = item?.status ?? "empty";
        const isInteractive = item && onItemClick;

        const cellClassName = cn(
          "border rounded-md p-2 transition-all duration-200 flex items-center justify-center min-h-[60px]",
          getStatusClasses(status),
          isInteractive &&
            "cursor-pointer hover:border-primary/50 hover:shadow-sm",
        );

        if (isInteractive) {
          return (
            <button
              key={`${row}-${column}`}
              type="button"
              onClick={() => item && onItemClick?.(item)}
              className={cellClassName}
              title={item?.label}
            >
              {item?.label && (
                <span className="text-xs font-medium truncate">
                  {item.label}
                </span>
              )}
              {!item && (
                <span className="text-xs opacity-50">
                  {row + 1}-{column + 1}
                </span>
              )}
            </button>
          );
        }

        return (
          <div
            key={`${row}-${column}`}
            className={cellClassName}
            title={item?.label}
          >
            {item?.label && (
              <span className="text-xs font-medium truncate">{item.label}</span>
            )}
            {!item && (
              <span className="text-xs opacity-50">
                {row + 1}-{column + 1}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
