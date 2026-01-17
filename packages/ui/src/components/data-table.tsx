import type * as React from "react";
import { cn } from "../utils";

export interface DataTableProps<T = any> {
  columns: {
    key: string;
    label: string;
    className?: string;
    render?: (row: T) => React.ReactNode;
  }[];
  data: T[];
  loading?: boolean;
  emptyState?: React.ReactNode;
  onRowClick?: (row: T) => void;
  className?: string;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  loading,
  emptyState,
  onRowClick,
  className,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div
        className={cn(
          "border border-border/60 rounded-xl overflow-hidden",
          className,
        )}
      >
        <div className="bg-card/40 border-b border-border/60 flex">
          {columns.map((col) => (
            <div
              key={col.key}
              className={cn(
                "text-xs text-muted-foreground font-medium px-4 py-3 flex-1",
                col.className,
              )}
            >
              {col.label}
            </div>
          ))}
        </div>
        <div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="border-b border-border/50 px-4 py-3">
              <div className="h-10 bg-card/40 animate-pulse rounded w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0 && emptyState) {
    return (
      <div
        className={cn(
          "border border-border/60 rounded-xl overflow-hidden",
          className,
        )}
      >
        <div className="bg-card/40 border-b border-border/60 flex">
          {columns.map((col) => (
            <div
              key={col.key}
              className={cn(
                "text-xs text-muted-foreground font-medium px-4 py-3 flex-1",
                col.className,
              )}
            >
              {col.label}
            </div>
          ))}
        </div>
        <div className="p-8 flex justify-center items-center">{emptyState}</div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "border border-border/60 rounded-xl overflow-hidden",
        className,
      )}
    >
      <div className="bg-card/40 border-b border-border/60 flex">
        {columns.map((col) => (
          <div
            key={col.key}
            className={cn(
              "text-xs text-muted-foreground font-medium px-4 py-3 flex-1",
              col.className,
            )}
          >
            {col.label}
          </div>
        ))}
      </div>
      <div>
        {data.map((row, rowIndex) => (
          <div
            key={rowIndex}
            onClick={() => onRowClick?.(row)}
            className={cn(
              "border-b border-border/50 flex transition-colors",
              onRowClick ? "cursor-pointer hover:bg-card/20" : "",
            )}
          >
            {columns.map((col) => (
              <div
                key={`${rowIndex}-${col.key}`}
                className={cn(
                  "text-xs text-foreground/80 px-4 py-3 flex-1 flex items-center",
                  col.className,
                )}
              >
                {col.render ? col.render(row) : row[col.key]}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

DataTable.displayName = "DataTable";
