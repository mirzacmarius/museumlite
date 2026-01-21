"use client";

import { formatDate } from "@/lib/format-date";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { cn } from "@v1/ui/utils";
import { useQuery } from "convex/react";
import { Send } from "lucide-react";
import Link from "next/link";
import type { LoanForCollection } from "./types";

interface LoansTabProps {
  collectionId: string;
  locale: string;
}

export function LoansTab({ collectionId, locale }: LoansTabProps) {
  const loans = useQuery(api.loans.getLoansForCollection, {
    collectionId: collectionId as Id<"collections">,
  });

  return (
    <div className="space-y-6">
      <h3 className="flex items-center gap-2 text-xs font-medium text-foreground">
        <Send className="h-4 w-4 text-blue-500" />
        Loan History
      </h3>

      {loans === undefined ? (
        <p className="text-muted-foreground">Loading loans...</p>
      ) : loans.length > 0 ? (
        <div className="space-y-4">
          {loans.map((loan: LoanForCollection) => (
            <Link
              key={loan._id}
              href={`/loans/${loan._id}`}
              className="block rounded-xl border border-border/60 bg-secondary/20 p-4 transition-colors hover:border-accent/30 hover:bg-accent/5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-accent">
                      {loan.loanNumber}
                    </span>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
                        loan.type === "incoming"
                          ? "border border-green-500/20 bg-green-500/10 text-green-400"
                          : "border border-blue-500/20 bg-blue-500/10 text-blue-400",
                      )}
                    >
                      {loan.type}
                    </span>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
                        loan.status === "active"
                          ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                          : loan.status === "dispatched"
                            ? "border border-amber-500/20 bg-amber-500/10 text-amber-400"
                            : loan.status === "returned"
                              ? "border border-zinc-500/20 bg-zinc-500/10 text-zinc-400"
                              : "border border-zinc-500/20 bg-zinc-500/10 text-zinc-400",
                      )}
                    >
                      {loan.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-foreground">
                    {loan.lenderBorrowerName}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-xs text-muted-foreground">
                    {formatDate(new Date(loan.startDate), locale)}
                    {loan.endDate &&
                      ` - ${formatDate(new Date(loan.endDate), locale)}`}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-border">
          <p className="text-sm text-muted-foreground">
            No loan history for this object
          </p>
        </div>
      )}
    </div>
  );
}
