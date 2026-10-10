"use client";

import { Box } from "lucide-react";
import Link from "next/link";
import { withReturnPath } from "@/lib/return-path";
import { useCurrentLocale, useI18n, useScopedI18n } from "@/locales/client";
import { isLoanItemReturned } from "./loan-approval-workflow/loan-item-utils";
import type { Loan } from "./types";

interface ObjectsTabProps {
  loan: Loan;
}

export function ObjectsTab({ loan }: ObjectsTabProps) {
  const tRoot = useI18n();
  const tActions = useScopedI18n("loans.actions");
  const locale = useCurrentLocale();

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {loan.items.length > 0 ? (
        loan.items.map((item) => (
          <div
            key={item._id}
            className="overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-foreground/20"
          >
            <div className="relative flex h-32 items-center justify-center overflow-hidden bg-secondary">
              <Box className="size-10 text-muted-foreground/30" />
              <div className="absolute right-2 top-2 max-w-[calc(100%-1rem)] break-all rounded bg-zinc-950/50 px-2 py-1 font-mono text-[10px] text-white backdrop-blur-md">
                {item.accessionNumber}
              </div>
            </div>
            <div className="p-4">
              <h3 className="break-words font-semibold text-foreground">
                {/* The object page's back link returns to this loan. */}
                <Link
                  href={withReturnPath(
                    `/${locale}/objects/${item.collectionId}`,
                    `/loans/${loan._id}?tab=objects`,
                  )}
                  className="hover:underline"
                >
                  {item.title}
                </Link>
              </h3>

              <div className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4">
                <div>
                  <p className="text-[10px] font-medium uppercase text-muted-foreground">
                    {tRoot("loans.actions.conditionOut")}
                  </p>
                  <p className="flex items-center gap-1 break-words text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" />{" "}
                    {item.conditionOut || tActions("stable")}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase text-muted-foreground">
                    {tRoot("loans.table.status")}
                  </p>
                  {isLoanItemReturned(item) ? (
                    <p className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400">
                      <span className="size-1.5 rounded-full bg-blue-500" />{" "}
                      {tRoot("loans.status.returned")}
                    </p>
                  ) : (
                    <p className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-500">
                      <span className="size-1.5 rounded-full bg-amber-500" />{" "}
                      {tRoot("loans.actions.onLoan")}
                    </p>
                  )}
                </div>
              </div>
              {item.conditionIn && (
                <div className="mt-2 border-t border-border pt-2">
                  <p className="text-[10px] font-medium uppercase text-muted-foreground">
                    {tRoot("loans.actions.conditionIn")}
                  </p>
                  <p className="break-words text-xs text-muted-foreground">
                    {item.conditionIn}
                  </p>
                </div>
              )}
            </div>
          </div>
        ))
      ) : (
        <div className="col-span-full py-12 text-center text-sm text-muted-foreground">
          {tRoot("loans.actions.noObjectsInLoan")}
        </div>
      )}
    </div>
  );
}
