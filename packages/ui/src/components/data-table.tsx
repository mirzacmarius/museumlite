import Link from "next/link";
import type * as React from "react";
import { cn } from "../utils";

export interface DataTableProps<T = Record<string, unknown>> {
  columns: {
    key: string;
    label: string;
    className?: string;
    render?: (row: T) => React.ReactNode;
  }[];
  data: T[];
  loading?: boolean;
  emptyState?: React.ReactNode;
  /** @deprecated Use rowHref for accessible navigation */
  onRowClick?: (row: T) => void;
  rowHref?: (row: T) => string;
  rowAriaLabel?: (row: T) => string;
  className?: string;
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  loading,
  emptyState,
  onRowClick,
  rowHref,
  rowAriaLabel,
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
                "text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 flex-1",
                col.className,
              )}
            >
              {col.label}
            </div>
          ))}
        </div>
        <div>
          {["sk-1", "sk-2", "sk-3", "sk-4", "sk-5"].map((key) => (
            <div key={key} className="border-b border-border/50 px-4 py-3">
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
                "text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 flex-1",
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
      <ul className="m-0 list-none p-0">
        {data.map((row, rowIndex) => {
          const href = rowHref?.(row);
          const ariaLabel = rowAriaLabel?.(row);
          const rowKey =
            (row as { _id?: string; id?: string })?._id ??
            (row as { _id?: string; id?: string })?.id ??
            `row-${rowIndex}`;

          const rowContent = (
            <>
              {columns.map((col) => (
                <div
                  key={`${rowKey}-${col.key}`}
                  className={cn(
                    "text-xs text-foreground/80 px-4 py-3 flex-1 flex items-center",
                    col.className,
                  )}
                >
                  {col.render ? col.render(row) : String(row[col.key] ?? "")}
                </div>
              ))}
            </>
          );

          if (href) {
            return (
              <li key={rowKey}>
                <Link
                  href={href}
                  aria-label={ariaLabel}
                  className={cn(
                    "border-b border-border/50 flex transition-colors",
                    "cursor-pointer hover:bg-muted/50 focus-visible:bg-card/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                  )}
                >
                  {rowContent}
                </Link>
              </li>
            );
          }

          if (onRowClick) {
            return (
              <li key={rowKey}>
                <button
                  type="button"
                  onClick={() => onRowClick(row)}
                  aria-label={ariaLabel}
                  className={cn(
                    "flex w-full border-b border-border/50 bg-transparent text-left transition-colors",
                    "cursor-pointer hover:bg-card/20 focus-visible:bg-card/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                  )}
                >
                  {rowContent}
                </button>
              </li>
            );
          }

          return (
            <li
              key={rowKey}
              className="flex border-b border-border/50 transition-colors"
            >
              {rowContent}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

DataTable.displayName = "DataTable";
