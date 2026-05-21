import { formatDate } from "@/lib/format-date";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
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

export function getLoanTypeIcon(type: string) {
  return type === "incoming" ? (
    <div className="flex size-6 items-center justify-center rounded bg-muted text-foreground/80">
      <ArrowDownLeft className="size-3" strokeWidth={3} />
    </div>
  ) : (
    <div className="flex size-6 items-center justify-center rounded bg-muted text-foreground/80">
      <ArrowUpRight className="size-3" strokeWidth={3} />
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

export function buildSelectedLoansCsv(
  loans: LoanListRow[],
  headers: string[],
): string {
  const headerRow = headers.join(",");
  const rows = loans.map((loan) =>
    [
      loan.loanNumber,
      loan.type,
      `"${loan.lenderBorrowerName}"`,
      new Date(loan.startDate).toISOString().split("T")[0],
      loan.endDate ? new Date(loan.endDate).toISOString().split("T")[0] : "",
      loan.status,
      loan.itemCount,
    ].join(","),
  );
  return [headerRow, ...rows].join("\n");
}
