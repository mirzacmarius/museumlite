"use client";

import type { api } from "@v1/backend/convex/_generated/api";
import { cn } from "@v1/ui/utils";
import type { FunctionReturnType } from "convex/server";
import { AlertTriangle, Clock, FileText, Shield } from "lucide-react";
import { ClientDateFns } from "@/components/client-date";
import { useCurrentLocale, useI18n, useScopedI18n } from "@/locales/client";

type DetailsDoc = NonNullable<
  FunctionReturnType<typeof api.archiveDetails.get>
>;

interface ArchiveDetailsSummaryCardsProps {
  details: DetailsDoc;
}

export function ArchiveDetailsSummaryCards({
  details,
}: ArchiveDetailsSummaryCardsProps) {
  const locale = useCurrentLocale();
  const tRoot = useI18n();
  const t = useScopedI18n("modules.archive");
  const confidentialityLevel =
    details.confidentialityLevel === "public"
      ? tRoot("untranslatedRecords.objects.enums.statusPublic")
      : details.confidentialityLevel === "internal"
        ? tRoot("untranslatedRecords.objects.enums.statusInternal")
        : details.confidentialityLevel === "confidential"
          ? tRoot("untranslatedRecords.objects.enums.statusConfidential")
          : details.confidentialityLevel === "restricted"
            ? tRoot("untranslatedRecords.objects.enums.statusRestricted")
            : details.confidentialityLevel === "top_secret"
              ? tRoot("untranslatedRecords.objects.enums.statusTopSecret")
              : details.confidentialityLevel;

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
        <div className="mb-2 flex items-center gap-2">
          <FileText className="size-4 text-blue-500" />
          <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            {t("documentType")}
          </span>
        </div>
        <span className="text-sm font-medium text-foreground">
          {details.documentType || "—"}
        </span>
        {details.recordSeries ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {details.recordSeries}
          </p>
        ) : null}
      </div>

      <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
        <div className="mb-2 flex items-center gap-2">
          <Shield className="size-4 text-purple-500" />
          <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            {t("confidentiality")}
          </span>
        </div>
        <span
          className={cn(
            "inline-flex rounded px-2 py-0.5 text-xs font-medium",
            details.confidentialityLevel === "public"
              ? "bg-emerald-500/10 text-emerald-500"
              : details.confidentialityLevel === "internal"
                ? "bg-blue-500/10 text-blue-500"
                : details.confidentialityLevel === "confidential"
                  ? "bg-amber-500/10 text-amber-500"
                  : details.confidentialityLevel === "restricted"
                    ? "bg-orange-500/10 text-orange-500"
                    : details.confidentialityLevel === "top_secret"
                      ? "bg-red-500/10 text-red-500"
                      : "bg-secondary text-muted-foreground",
          )}
        >
          {confidentialityLevel || t("notClassified")}
        </span>
      </div>

      <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
        <div className="mb-2 flex items-center gap-2">
          <Clock className="size-4 text-cyan-500" />
          <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            {t("retention")}
          </span>
        </div>
        <span className="text-sm font-medium text-foreground">
          {details.retentionYears
            ? `${details.retentionYears} ${t("years")}`
            : "—"}
        </span>
        {details.retentionExpiresAt ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {t("expires")}:{" "}
            <ClientDateFns
              timestamp={details.retentionExpiresAt}
              format="MMM d, yyyy"
              locale={locale}
            />
          </p>
        ) : null}
      </div>

      <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
        <div className="mb-2 flex items-center gap-2">
          <AlertTriangle className="size-4 text-amber-500" />
          <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            {t("status")}
          </span>
        </div>
        <div className="space-y-1">
          {details.legalHold ? (
            <span className="inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium bg-red-500/10 text-red-500">
              {t("legalHold")}
            </span>
          ) : null}
          {details.flaggedForDestruction ? (
            <span className="inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium bg-orange-500/10 text-orange-500 ml-1">
              {t("flaggedForDestruction")}
            </span>
          ) : null}
          {!details.legalHold && !details.flaggedForDestruction ? (
            <span className="text-xs text-muted-foreground">{t("active")}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
