"use client";

import Link from "next/link";
import * as React from "react";
import { cn } from "../utils";

export interface DataTableColumn<T> {
  key: string;
  /** Announced with each cell of the column, so every column needs one. */
  label: string;
  /** Keeps the header for assistive technology only, e.g. a checkbox column. */
  hideLabel?: boolean;
  /** Names each row: the cell is the row header and holds the row link. */
  rowHeader?: boolean;
  /** The cell has its own controls, which stay usable above the row link. */
  interactive?: boolean;
  /** How the header and cells line up; numbers and controls often `end`/`center`. */
  align?: "start" | "center" | "end";
  /** Classes for the column's header and cells, e.g. a width. */
  className?: string;
  render?: (row: T) => React.ReactNode;
}

export interface DataTableProps<T = Record<string, unknown>> {
  /** The table element; it can take focus, e.g. after a selection bar closes. */
  ref?: React.Ref<HTMLTableElement>;
  /** Names the table for assistive technology. */
  label: string;
  columns: DataTableColumn<T>[];
  data: T[];
  loading?: boolean;
  emptyState?: React.ReactNode;
  /** Opens a row: its row header links here, and the whole row is the target. */
  rowHref?: (row: T) => string;
  rowAriaLabel?: (row: T) => string;
  className?: string;
}

const cellClassName = "overflow-hidden px-4 py-3 align-middle text-xs";

const alignClassNames = {
  start: { cell: "text-left", content: "justify-start" },
  center: { cell: "text-center", content: "justify-center" },
  end: { cell: "text-right", content: "justify-end" },
} as const;

/** Whether the element's content is wider than its box. */
function useOverflowsHorizontally(ref: React.RefObject<HTMLElement | null>) {
  const [overflows, setOverflows] = React.useState(false);
  React.useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () =>
      setOverflows(element.scrollWidth > element.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return overflows;
}

export function DataTable<T extends Record<string, unknown>>({
  ref,
  label,
  columns,
  data,
  loading,
  emptyState,
  rowHref,
  rowAriaLabel,
  className,
}: DataTableProps<T>) {
  const rowHeaderIndex = Math.max(
    0,
    columns.findIndex((column) => column.rowHeader),
  );
  const scrollRef = React.useRef<HTMLElement>(null);
  // On narrow screens the columns scroll instead of being cut off; the
  // scroll area then takes focus so it can be scrolled from the keyboard.
  const overflows = useOverflowsHorizontally(scrollRef);

  return (
    <section
      ref={scrollRef}
      aria-label={overflows ? label : undefined}
      tabIndex={overflows ? 0 : undefined}
      className={cn(
        "overflow-x-auto rounded-xl border border-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <table
        ref={ref}
        aria-label={label}
        aria-busy={loading || undefined}
        tabIndex={-1}
        className="w-full min-w-[44rem] table-fixed text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <thead className="border-b border-border/60 bg-card/40">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  cellClassName,
                  "font-medium text-muted-foreground",
                  alignClassNames[column.align ?? "start"].cell,
                  column.className,
                )}
              >
                {column.hideLabel ? (
                  <span className="sr-only">{column.label}</span>
                ) : (
                  column.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            ["sk-1", "sk-2", "sk-3", "sk-4", "sk-5"].map((key) => (
              <tr key={key} className="border-b border-border/50">
                <td colSpan={columns.length} className="px-4 py-3">
                  <div
                    aria-hidden="true"
                    className="h-10 w-full animate-pulse rounded bg-card/40"
                  />
                </td>
              </tr>
            ))
          ) : data.length === 0 && emptyState ? (
            <tr>
              <td colSpan={columns.length} className="p-8">
                <div className="flex items-center justify-center">
                  {emptyState}
                </div>
              </td>
            </tr>
          ) : (
            data.map((row, rowIndex) => {
              const href = rowHref?.(row);
              const rowKey =
                (row as { _id?: string; id?: string })?._id ??
                (row as { _id?: string; id?: string })?.id ??
                `row-${rowIndex}`;

              return (
                <tr
                  key={rowKey}
                  className={cn(
                    "border-b border-border/50 transition-colors",
                    href && "relative cursor-pointer hover:bg-muted/50",
                  )}
                >
                  {columns.map((column, columnIndex) => {
                    const content = column.render
                      ? column.render(row)
                      : String(row[column.key] ?? "");
                    const isRowHeader = columnIndex === rowHeaderIndex;
                    const align = alignClassNames[column.align ?? "start"];
                    const Cell = isRowHeader ? "th" : "td";
                    return (
                      <Cell
                        key={`${rowKey}-${column.key}`}
                        scope={isRowHeader ? "row" : undefined}
                        className={cn(
                          cellClassName,
                          "font-normal text-foreground/80",
                          align.cell,
                          column.interactive && "relative z-10",
                          column.className,
                        )}
                      >
                        <div
                          className={cn(
                            "flex min-w-0 items-center",
                            align.content,
                          )}
                        >
                          {isRowHeader && href ? (
                            <Link
                              href={href}
                              aria-label={rowAriaLabel?.(row)}
                              className="min-w-0 outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring"
                            >
                              {content}
                            </Link>
                          ) : (
                            content
                          )}
                        </div>
                      </Cell>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </section>
  );
}

DataTable.displayName = "DataTable";
