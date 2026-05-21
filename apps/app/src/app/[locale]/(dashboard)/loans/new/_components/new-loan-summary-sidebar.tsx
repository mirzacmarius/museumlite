"use client";

import type { Doc } from "@v1/backend/convex/_generated/dataModel";
import { Avatar, AvatarFallback } from "@v1/ui/avatar";
import { cn } from "@v1/ui/utils";
import { formatDate } from "@/lib/format-date";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import type { NewLoanFormData } from "./types";

interface NewLoanSummarySidebarProps {
  formData: NewLoanFormData;
  selectedCollectionIds: string[];
  selectedCollectionsList: Array<
    Pick<Doc<"collections">, "_id" | "accessionNumber" | "title">
  >;
}

export function NewLoanSummarySidebar({
  formData,
  selectedCollectionIds,
  selectedCollectionsList,
}: NewLoanSummarySidebarProps) {
  const locale = useCurrentLocale();
  const tActions = useScopedI18n("loans.actions");
  const t = useScopedI18n("loans");

  return (
    <div className="hidden lg:block space-y-6">
      <div className="sticky top-24">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
            Summary
          </h3>

          <div className="space-y-4">
            <div className="flex justify-between items-start border-b border-border/50 pb-4">
              <span className="text-sm text-muted-foreground">Type</span>
              <span
                className={cn(
                  "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset",
                  formData.type === "incoming"
                    ? "bg-purple-50 text-purple-700 ring-purple-600/20 dark:bg-purple-900/20 dark:text-purple-400"
                    : "bg-cyan-50 text-cyan-700 ring-cyan-600/20 dark:bg-cyan-900/20 dark:text-cyan-400",
                )}
              >
                {formData.type === "incoming"
                  ? t("filters.incoming")
                  : t("filters.outgoing")}
              </span>
            </div>

            <div className="pb-4 border-b border-border/50">
              <span className="text-xs text-muted-foreground uppercase tracking-wide block mb-1">
                {formData.type === "incoming"
                  ? tActions("lender")
                  : tActions("borrower")}
              </span>
              <p className="text-sm font-medium text-foreground">
                {formData.lenderBorrowerName || "—"}
              </p>
              {formData.lenderBorrowerContact && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formData.lenderBorrowerContact}
                </p>
              )}
            </div>

            <div className="pb-4 border-b border-border/50">
              <span className="text-xs text-muted-foreground uppercase tracking-wide block mb-1">
                Dates
              </span>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-foreground">
                  {formatDate(formData.startDate, locale)}
                </span>
                <span className="text-muted-foreground">→</span>
                <span className="text-foreground">
                  {formData.endDate
                    ? formatDate(formData.endDate, locale)
                    : tActions("indefinite")}
                </span>
              </div>
            </div>

            <div>
              <span className="text-xs text-muted-foreground uppercase tracking-wide block mb-2">
                Objects ({selectedCollectionIds.length})
              </span>
              {selectedCollectionsList.length > 0 ? (
                <div className="flex overflow-hidden">
                  {selectedCollectionsList.slice(0, 5).map((c) => (
                    <Avatar
                      key={c._id}
                      className="-ml-2 inline-block size-8 rounded-full ring-2 ring-background first:ml-0"
                    >
                      <AvatarFallback className="bg-secondary text-[8px]">
                        {c.accessionNumber.slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  {selectedCollectionsList.length > 5 && (
                    <div className="-ml-2 flex size-8 items-center justify-center rounded-full bg-secondary text-[10px] font-medium text-muted-foreground ring-2 ring-background">
                      +{selectedCollectionsList.length - 5}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  No objects selected
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
