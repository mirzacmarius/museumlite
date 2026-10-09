"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Badge } from "@v1/ui/badge";
import { Button } from "@v1/ui/button";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Plus, Scale } from "lucide-react";
import { useState } from "react";
import { ClientDate } from "@/components/client-date";
import { PermissionGate, usePermissions } from "@/components/permission-gate";
import { useClientNow } from "@/hooks/use-client-date-format";
import { CALENDAR_DATE_OPTIONS } from "@/lib/format-date";
import { type FormatLocale, formatMoney } from "@/lib/format-number";
import { useScopedI18n } from "@/locales/client";
import {
  type AppraisalDefaults,
  AppraisalFormDialog,
} from "./appraisal-form-dialog";

type ObjectValuation = NonNullable<
  FunctionReturnType<typeof api.appraisals.getObjectValuation>
>;
type AppraisalView = ObjectValuation["history"][number];

interface ValuationTabProps {
  collectionId: Id<"collections">;
  locale: string;
}

function defaultsFrom(appraisal: AppraisalView): AppraisalDefaults {
  return {
    purpose: appraisal.purpose,
    value: appraisal.value,
    currency: appraisal.currency,
    appraisalDate: appraisal.appraisalDate,
    appraiserName: appraisal.appraiserName,
    appraiserCompany: appraisal.appraiserCompany,
    appraiserCredentials: appraisal.appraiserCredentials,
    validUntil: appraisal.validUntil,
    notes: appraisal.notes,
  };
}

export function ValuationTab({ collectionId, locale }: ValuationTabProps) {
  const t = useScopedI18n("valuation");
  const now = useClientNow();
  const { hasPermission } = usePermissions();
  const canRecord = hasPermission("collections.update");
  const valuation = useQuery(
    api.appraisals.getObjectValuation,
    now === undefined ? "skip" : { collectionId, now },
  );
  const [recordOpen, setRecordOpen] = useState(false);
  const [correcting, setCorrecting] = useState<AppraisalView | null>(null);

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div className="space-y-1">
          <h3 className="flex items-center gap-2 text-xs font-medium text-foreground">
            <Scale className="size-4 text-emerald-500" />
            {t("title")}
          </h3>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {t("description")}
          </p>
        </div>
        <PermissionGate permission="collections.update">
          <Button size="sm" onClick={() => setRecordOpen(true)}>
            <Plus className="mr-2 size-4" />
            {t("recordAppraisal")}
          </Button>
        </PermissionGate>
      </div>

      {valuation === undefined ? (
        <div className="h-32 w-full animate-pulse rounded-xl bg-card/40" />
      ) : valuation === null || valuation.history.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noCurrent")}</p>
      ) : (
        <>
          <section className="space-y-3" aria-labelledby="current-valuations">
            <h4
              id="current-valuations"
              className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground"
            >
              {t("currentTitle")}
            </h4>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {valuation.current.map((appraisal) => (
                <CurrentValuationCard
                  key={appraisal._id}
                  appraisal={appraisal}
                  locale={locale}
                />
              ))}
            </div>
          </section>

          <section className="space-y-3" aria-labelledby="appraisal-history">
            <h4
              id="appraisal-history"
              className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground"
            >
              {t("historyTitle")}
            </h4>
            <ul className="divide-y divide-border/60 rounded-xl border border-border/60">
              {valuation.history.map((appraisal) => (
                <AppraisalHistoryRow
                  key={appraisal._id}
                  appraisal={appraisal}
                  locale={locale}
                  onCorrect={
                    canRecord && appraisal.supersededBy === undefined
                      ? () => setCorrecting(appraisal)
                      : undefined
                  }
                />
              ))}
            </ul>
            {valuation.truncated ? (
              <p className="text-xs text-muted-foreground">{t("truncated")}</p>
            ) : null}
          </section>
        </>
      )}

      {recordOpen ? (
        <AppraisalFormDialog
          open={recordOpen}
          onOpenChange={setRecordOpen}
          collectionId={collectionId}
        />
      ) : null}
      {correcting ? (
        <AppraisalFormDialog
          open
          onOpenChange={(open) => {
            if (!open) setCorrecting(null);
          }}
          collectionId={collectionId}
          supersedes={{
            appraisalId: correcting._id,
            defaults: defaultsFrom(correcting),
          }}
        />
      ) : null}
    </div>
  );
}

function CurrentValuationCard({
  appraisal,
  locale,
}: {
  appraisal: AppraisalView;
  locale: string;
}) {
  const t = useScopedI18n("valuation");
  return (
    <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          {t(`purposes.${appraisal.purpose}`)} · {appraisal.currency}
        </span>
        {appraisal.isWithinValuationAge ? null : (
          <Badge
            variant="outline"
            className="border-amber-500/30 text-amber-400"
          >
            {t("renewalDue")}
          </Badge>
        )}
      </div>
      <p className="mt-2 text-lg font-semibold tabular-nums text-foreground">
        {formatMoney(
          appraisal.value,
          locale as FormatLocale,
          appraisal.currency,
        )}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {appraisal.appraiserName} ·{" "}
        <ClientDate
          timestamp={appraisal.appraisalDate}
          locale={locale}
          options={CALENDAR_DATE_OPTIONS}
        />
      </p>
      {appraisal.currencyRecognized ? null : (
        <p className="mt-1 text-xs text-amber-400">
          {t("currencyNotRecognized")}
        </p>
      )}
    </div>
  );
}

function AppraisalHistoryRow({
  appraisal,
  locale,
  onCorrect,
}: {
  appraisal: AppraisalView;
  locale: string;
  onCorrect?: () => void;
}) {
  const t = useScopedI18n("valuation");
  const status = appraisal.isCurrent
    ? {
        label: t("current"),
        className: "border-emerald-500/30 text-emerald-400",
      }
    : appraisal.supersededBy
      ? {
          label: t("supersededBadge"),
          className: "border-zinc-500/30 text-zinc-400",
        }
      : {
          label: t("replacedBadge"),
          className: "border-border text-muted-foreground",
        };
  return (
    <li className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={
              appraisal.supersededBy
                ? "text-sm font-semibold tabular-nums text-muted-foreground line-through"
                : "text-sm font-semibold tabular-nums text-foreground"
            }
          >
            {formatMoney(
              appraisal.value,
              locale as FormatLocale,
              appraisal.currency,
            )}
          </span>
          <span className="text-xs text-muted-foreground">
            {t(`purposes.${appraisal.purpose}`)}
          </span>
          <Badge variant="outline" className={status.className}>
            {status.label}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {appraisal.appraiserName}
          {appraisal.appraiserCompany ? ` (${appraisal.appraiserCompany})` : ""}{" "}
          ·{" "}
          <ClientDate
            timestamp={appraisal.appraisalDate}
            locale={locale}
            options={CALENDAR_DATE_OPTIONS}
          />
        </p>
        {appraisal.supersessionReason ? (
          <p className="text-xs text-muted-foreground">
            {t("correctionOf", { reason: appraisal.supersessionReason })}
          </p>
        ) : null}
        {appraisal.supersededAt ? (
          <p className="text-xs text-muted-foreground">
            {t("supersededOn")}{" "}
            <ClientDate timestamp={appraisal.supersededAt} locale={locale} />
          </p>
        ) : null}
      </div>
      {onCorrect ? (
        <Button variant="outline" size="sm" onClick={onCorrect}>
          {t("supersede")}
        </Button>
      ) : null}
    </li>
  );
}
