"use client";

import { Building2 } from "lucide-react";
import type { CollectionData } from "./types";

interface AccessionTabProps {
  collection: CollectionData;
}

export function AccessionTab({ collection }: AccessionTabProps) {
  return (
    <div>
      <h3 className="mb-4 flex items-center gap-2 text-xs font-medium text-foreground">
        <Building2 className="size-4 text-emerald-500" />
        Acquisition information
      </h3>
      <div className="rounded-xl border border-border/60 bg-secondary/20 p-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <span className="mb-1 block text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Acquisition Type
            </span>
            {collection.acquisitionMethod ? (
              <span className="inline-flex items-center rounded border border-emerald-500/30 bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
                {collection.acquisitionMethod}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">-</span>
            )}
          </div>

          <div>
            <span className="mb-1 block text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Donated by
            </span>
            {collection.donated_by && collection.donated_by.length > 0 ? (
              <div className="flex items-center gap-2">
                <div className="flex size-5 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-white">
                  {collection.donated_by[0]?.charAt(0) ?? "?"}
                </div>
                <span className="text-sm text-muted-foreground">
                  {collection.donated_by.join(", ")}
                </span>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">-</span>
            )}
          </div>
        </div>

        <div className="mt-4 border-t border-border/50 pt-4">
          <span className="mb-1 block text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            Donation details
          </span>
          {collection.donation_info ? (
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {collection.donation_info}
            </p>
          ) : (
            <span className="text-sm text-muted-foreground">-</span>
          )}
        </div>
      </div>
    </div>
  );
}
