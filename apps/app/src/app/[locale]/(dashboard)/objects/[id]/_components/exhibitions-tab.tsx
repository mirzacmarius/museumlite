"use client";

import { formatDate } from "@/lib/format-date";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { cn } from "@v1/ui/utils";
import { useQuery } from "convex/react";
import { Presentation } from "lucide-react";

interface ExhibitionsTabProps {
  collectionId: string;
  organizationId: Id<"organizations">;
  locale: string;
}

export function ExhibitionsTab({
  collectionId,
  organizationId,
  locale,
}: ExhibitionsTabProps) {
  const exhibitions = useQuery(
    api.exhibitions?.list,
    collectionId ? { collectionId: collectionId as Id<"collections"> } : "skip",
  );

  const collection = useQuery(
    api.collections.get,
    collectionId ? { collectionId: collectionId as Id<"collections"> } : "skip",
  );

  return (
    <div className="space-y-6">
      <h3 className="flex items-center gap-2 text-xs font-medium text-foreground">
        <Presentation className="h-4 w-4 text-amber-500" />
        Exhibition History
      </h3>

      <div className="grid grid-cols-1 gap-4">
        {exhibitions === undefined ? (
          <p className="text-muted-foreground">Loading exhibitions...</p>
        ) : exhibitions && exhibitions.length > 0 ? (
          exhibitions.map((exhibition) => (
            <div
              key={exhibition._id}
              className={cn(
                "flex gap-4 rounded-xl border p-4",
                exhibition.isCurrent
                  ? "border-accent/30 bg-accent/5"
                  : "border-border/60 bg-secondary/20 opacity-75 hover:opacity-100",
              )}
            >
              <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg border border-border/60 bg-secondary text-center">
                <span className="text-[10px] font-bold uppercase text-muted-foreground">
                  {exhibition.isCurrent
                    ? "Now"
                    : new Date(exhibition.startDate).getFullYear()}
                </span>
                <span
                  className={cn(
                    "text-xs font-bold",
                    exhibition.isCurrent
                      ? "text-accent"
                      : "text-muted-foreground",
                  )}
                >
                  {exhibition.isCurrent ? "Open" : "Past"}
                </span>
              </div>
              <div>
                <h4 className="text-sm font-medium text-foreground">
                  {exhibition.title}
                </h4>
                {exhibition.location && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {exhibition.location}
                  </p>
                )}
                <div className="mt-2 flex gap-2">
                  <span className="rounded border border-border/60 bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {formatDate(new Date(exhibition.startDate), locale)}
                    {exhibition.endDate &&
                      ` - ${formatDate(new Date(exhibition.endDate), locale)}`}
                  </span>
                  {exhibition.isLoan && exhibition.loanVenue && (
                    <span className="rounded border border-border/60 bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      Loan: {exhibition.loanVenue}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : collection?.exhibitionHistory ? (
          <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {collection.exhibitionHistory}
            </p>
          </div>
        ) : (
          <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-border">
            <p className="text-sm text-muted-foreground">
              No exhibition history recorded
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
