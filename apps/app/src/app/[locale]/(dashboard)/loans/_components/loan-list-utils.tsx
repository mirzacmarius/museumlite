import { csvTextCell } from "@v1/backend/convex/utils/spreadsheetText";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { formatDate } from "@/lib/format-date";
import type { LoanListRow } from "./types";

export function getLoanStatusLabel(
  status: string,
  labels: {
    pendingReview: string;
    active: string;
    dispatched: string;
    returned: string;
    cancelled: string;
    draft: string;
  },
): string {
  switch (status) {
    case "pending":
      return labels.pendingReview;
    case "active":
      return labels.active;
    case "dispatched":
      return labels.dispatched;
    case "returned":
      return labels.returned;
    case "cancelled":
      return labels.cancelled;
    default:
      return labels.draft;
  }
}

/** The loan's direction as an icon, with its name for assistive technology. */
export function getLoanTypeIcon(type: string, label: string) {
  const Icon = type === "incoming" ? ArrowDownLeft : ArrowUpRight;
  return (
    <div className="flex size-6 items-center justify-center rounded bg-muted text-foreground/80">
      <Icon className="size-3" strokeWidth={3} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function formatLoanDateRange(
  startDate: number,
  endDate: number | undefined,
  locale: string,
) {
  const start = new Date(startDate);
  const startStr = formatDate(start, locale, {
    month: "short",
    day: "numeric",
  });

  if (!endDate) return startStr;

  const end = new Date(endDate);
  const endStr = formatDate(end, locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return `${startStr} — ${endStr}`;
}

export function getPartnerInitial(name: string) {
  return name.charAt(0).toUpperCase();
}

function isoDay(timestamp: number) {
  return new Date(timestamp).toISOString().split("T")[0] ?? "";
}

/** Text cells are quoted with formulas disarmed, like the server exports. */
export function buildSelectedLoansCsv(
  loans: LoanListRow[],
  headers: string[],
): string {
  const headerRow = headers.map(csvTextCell).join(",");
  const rows = loans.map((loan) =>
    [
      csvTextCell(loan.loanNumber),
      csvTextCell(loan.type),
      csvTextCell(loan.lenderBorrowerName),
      isoDay(loan.startDate),
      loan.endDate ? isoDay(loan.endDate) : "",
      csvTextCell(loan.status),
      loan.itemCount ?? "",
    ].join(","),
  );
  return [headerRow, ...rows].join("\n");
}
