"use client";

import type { api } from "@v1/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { Clock, FileText, Shield, Trash2 } from "lucide-react";
import { useSyncExternalStore } from "react";
import { ClientDateFns } from "@/components/client-date";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";

type DetailsDoc = NonNullable<
  FunctionReturnType<typeof api.archiveDetails.get>
>;

function ClientDaysUntilExpiry({ timestamp }: { timestamp: number }) {
  return useSyncExternalStore(
    () => () => {},
    () => String(Math.ceil((timestamp - Date.now()) / (1000 * 60 * 60 * 24))),
    () => "",
  );
}

interface ArchiveDetailsSectionsProps {
  details: DetailsDoc;
}

export function ArchiveDetailsSections({
  details,
}: ArchiveDetailsSectionsProps) {
  const locale = useCurrentLocale();
  const common = useScopedI18n("modules.common");

  return (
    <>
      <div>
        <h3 className="mb-4 flex items-center gap-2 text-xs font-medium text-foreground">
          <FileText className="size-4 text-blue-500" />
          Document Information
        </h3>

        <div className="rounded-lg border border-border/60 bg-secondary/20 p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                Document Type
              </div>
              <div className="text-sm font-medium text-foreground">
                {details.documentType || "—"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                Retention Category
              </div>
              <div className="text-sm font-medium text-foreground">
                {details.retentionCategory || "—"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                Originating Department
              </div>
              <div className="text-sm font-medium text-foreground">
                {details.originatingDepartment || "—"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                Record Series
              </div>
              <div className="text-sm font-medium text-foreground">
                {details.recordSeries || "—"}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-4 flex items-center gap-2 text-xs font-medium text-foreground">
          <Clock className="size-4 text-cyan-500" />
          Retention Schedule
        </h3>

        <div className="rounded-lg border border-border/60 bg-secondary/20 p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                Retention Period
              </div>
              <div className="text-sm font-medium text-foreground">
                {details.retentionYears
                  ? `${details.retentionYears} years`
                  : "—"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                Retention Start Date
              </div>
              <div className="text-sm font-medium text-foreground">
                {details.retentionStartDate ? (
                  <ClientDateFns
                    timestamp={details.retentionStartDate}
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
                Retention Expires
              </div>
              <div className="text-sm font-medium text-foreground">
                {details.retentionExpiresAt ? (
                  <ClientDateFns
                    timestamp={details.retentionExpiresAt}
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
                Days Until Expiry
              </div>
              <div className="text-sm font-medium text-foreground">
                {details.retentionExpiresAt ? (
                  <ClientDaysUntilExpiry
                    timestamp={details.retentionExpiresAt}
                  />
                ) : (
                  "—"
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-4 flex items-center gap-2 text-xs font-medium text-foreground">
          <Shield className="size-4 text-purple-500" />
          Security & Access
        </h3>

        <div className="rounded-lg border border-border/60 bg-secondary/20 p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                Confidentiality Level
              </div>
              <div className="text-sm font-medium text-foreground">
                {details.confidentialityLevel || "—"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                Legal Hold
              </div>
              <div className="text-sm font-medium text-foreground">
                {details.legalHold ? common("yes") : common("no")}
              </div>
            </div>
          </div>
          {details.legalHoldReason ? (
            <div className="mt-4 pt-4 border-t border-border/40">
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-2">
                Legal Hold Reason
              </div>
              <p className="text-sm text-muted-foreground">
                {details.legalHoldReason}
              </p>
            </div>
          ) : null}
          {details.accessRestrictions &&
          details.accessRestrictions.length > 0 ? (
            <div className="mt-4 pt-4 border-t border-border/40">
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-2">
                Access Restrictions
              </div>
              <div className="flex flex-wrap gap-2">
                {details.accessRestrictions.map((restriction) => (
                  <span
                    key={restriction}
                    className="inline-flex rounded px-2 py-0.5 text-xs font-medium bg-amber-500/10 text-amber-500"
                  >
                    {restriction}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

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
