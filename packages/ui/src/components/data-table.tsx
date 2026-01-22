import Link from "next/link";
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
  /** @deprecated Use rowHref for accessible navigation */
  onRowClick?: (row: T) => void;
  rowHref?: (row: T) => string;
  rowAriaLabel?: (row: T) => string;
  className?: string;
}

export function DataTable<T extends Record<string, any>>({
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
      <div role="list">
        {data.map((row, rowIndex) => {
          const href = rowHref?.(row);
          const ariaLabel = rowAriaLabel?.(row);
          const isClickable = href || onRowClick;

          const rowContent = (
            <>
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
            </>
          );

          if (href) {
            return (
              <Link
                key={rowIndex}
                href={href}
                aria-label={ariaLabel}
                className={cn(
                  "border-b border-border/50 flex transition-colors",
                  "cursor-pointer hover:bg-card/20 focus-visible:bg-card/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                )}
                role="listitem"
              >
                {rowContent}
              </Link>
            );
          }

          return (
            <div
              key={rowIndex}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={
                onRowClick
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onRowClick(row);
                      }
                    }
                  : undefined
              }
              tabIndex={onRowClick ? 0 : undefined}
              role={onRowClick ? "button" : "listitem"}
              aria-label={ariaLabel}
              className={cn(
                "border-b border-border/50 flex transition-colors",
                isClickable
                  ? "cursor-pointer hover:bg-card/20 focus-visible:bg-card/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                  : "",
              )}
            >
              {rowContent}
            </div>
          );
        })}
      </div>
    </div>
  );
}

DataTable.displayName = "DataTable";
