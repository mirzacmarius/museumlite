"use client";

import { Building2, FileText, Users } from "lucide-react";
import type { CollectionData } from "./types";

interface AccessionTabProps {
  collection: CollectionData;
}

export function AccessionTab({ collection }: AccessionTabProps) {
  const hasPreviousOwners =
    collection.previous_owners && collection.previous_owners.length > 0;

  return (
    <div className="space-y-8">
      <div>
        <h3 className="mb-4 flex items-center gap-2 text-xs font-medium text-foreground">
          <Building2 className="h-4 w-4 text-emerald-500" />
          Acquisition Information
        </h3>
        <div className="rounded-xl border border-border/60 bg-secondary/20 p-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div>
              <span className="mb-1 block text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Method
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
                Source / Donor
              </span>
              {collection.donated_by && collection.donated_by.length > 0 ? (
                <div className="flex items-center gap-2">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-white">
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

            <div>
              <span className="mb-1 block text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Date
              </span>
              <span className="text-sm text-muted-foreground">
                {collection.donated_date || "-"}
              </span>
            </div>
          </div>

          {collection.donation_info ? (
            <div className="mt-4 border-t border-border/50 pt-4">
              <span className="mb-1 block text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Acquisition Notes
              </span>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {collection.donation_info}
              </p>
            </div>
          ) : null}

          {collection.creditLine ? (
            <div className="mt-4 border-t border-border/50 pt-4">
              <span className="mb-1 block text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Credit Line
              </span>
              <p className="font-serif text-sm italic text-muted-foreground">
                "{collection.creditLine}"
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <div>
        <h3 className="mb-4 flex items-center gap-2 text-xs font-medium text-foreground">
          <Users className="h-4 w-4 text-sky-500" />
          Donation and Previous Ownership
        </h3>
        <div className="rounded-xl border border-border/60 bg-secondary/20 p-6">
          {hasPreviousOwners ? (
            <div className="space-y-3">
              {collection.previous_owners?.map((owner) => (
                <div
                  key={owner}
                  className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/70 px-3 py-2"
                >
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-foreground">{owner}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-border/60">
              <p className="text-sm text-muted-foreground">
                No previous owners recorded.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
