"use client";

import type { api } from "@v1/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { FileText, Trash2 } from "lucide-react";
import { ClientDateFns } from "@/components/client-date";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";

type DetailsDoc = NonNullable<
  FunctionReturnType<typeof api.archiveDetails.get>
>;

interface ArchiveAccessSectionProps {
  details: DetailsDoc;
}

export function ArchiveAccessSection({ details }: ArchiveAccessSectionProps) {
  const locale = useCurrentLocale();
  const common = useScopedI18n("modules.common");

  return (
    <>
      <div>
        <h3 className="mb-4 flex items-center gap-2 text-xs font-medium text-foreground">
          <FileText className="size-4 text-green-500" />
          Physical & Digital Location
        </h3>

        <div className="rounded-lg border border-border/60 bg-secondary/20 p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                Box Number
              </div>
              <div className="text-sm font-medium text-foreground">
                {details.boxNumber || "—"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                Folder Number
              </div>
              <div className="text-sm font-medium text-foreground">
                {details.folderNumber || "—"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                File Format
              </div>
              <div className="text-sm font-medium text-foreground">
                {details.fileFormat || "—"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                File Size
              </div>
              <div className="text-sm font-medium text-foreground">
                {details.fileSize
                  ? `${(details.fileSize / 1024 / 1024).toFixed(2)} MB`
                  : "—"}
              </div>
            </div>
          </div>
          {details.pageCount ? (
            <div className="mt-4 pt-4 border-t border-border/40">
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-2">
                Document Details
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                    Page Count
                  </div>
                  <div className="text-sm font-medium text-foreground">
                    {details.pageCount}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                    OCR Processed
                  </div>
                  <div className="text-sm font-medium text-foreground">
                    {details.ocrProcessed ? common("yes") : common("no")}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          {details.keywords && details.keywords.length > 0 ? (
            <div className="mt-4 pt-4 border-t border-border/40">
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-2">
                Keywords
              </div>
              <div className="flex flex-wrap gap-2">
                {details.keywords.map((keyword) => (
                  <span
                    key={keyword}
                    className="inline-flex rounded px-2 py-0.5 text-xs font-medium bg-blue-500/10 text-blue-500"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {details.flaggedForDestruction ? (
        <div>
          <h3 className="mb-4 flex items-center gap-2 text-xs font-medium text-foreground">
            <Trash2 className="size-4 text-red-500" />
            Destruction Information
          </h3>

          <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                  Destruction Date
                </div>
                <div className="text-sm font-medium text-foreground">
                  {details.destructionDate ? (
                    <ClientDateFns
                      timestamp={details.destructionDate}
                      format="MMM d, yyyy"
                      locale={locale}
                    />
                  ) : (
                    "—"
                  )}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                  Destruction Method
                </div>
                <div className="text-sm font-medium text-foreground">
                  {details.destructionMethod || "—"}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                  Witnessed By
                </div>
                <div className="text-sm font-medium text-foreground">
                  {details.destructionWitnessedBy || "—"}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
