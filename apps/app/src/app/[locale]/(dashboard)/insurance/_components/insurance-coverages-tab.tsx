"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Badge } from "@v1/ui/badge";
import { Button } from "@v1/ui/button";
import { DataTable } from "@v1/ui/data-table";
import { EmptyState } from "@v1/ui/empty-state";
import { usePaginatedQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ShieldCheck } from "lucide-react";
import { ClientDate } from "@/components/client-date";
import { CALENDAR_DATE_OPTIONS } from "@/lib/format-date";
import { useScopedI18n } from "@/locales/client";
import { MoneyCell } from "./money-cell";

type CoverageRow = FunctionReturnType<
  typeof api.insurance.listCoverages
>["page"][number];

const stateColor: Record<CoverageRow["state"], string> = {
  in_force: "border-emerald-500/30 text-emerald-400",
  not_started: "border-blue-500/30 text-blue-400",
  expired: "border-rose-500/30 text-rose-400",
  policy_inactive: "border-orange-500/30 text-orange-400",
  removed: "border-zinc-500/30 text-zinc-400",
  needs_review: "border-amber-500/30 text-amber-400",
};

const appraisalColor: Record<CoverageRow["appraisalStatus"], string> = {
  not_applicable: "text-muted-foreground",
  currency_not_recorded: "text-amber-400",
  missing: "text-amber-400",
  current: "text-emerald-400",
  stale: "text-rose-400",
};

export function InsuranceCoveragesTab({
  organizationId,
  now,
  locale,
}: {
  organizationId: Id<"organizations">;
  now: number | undefined;
  locale: string;
}) {
  const t = useScopedI18n("untranslatedDashboard.insurance.coverageTab");
  const tInsurance = useScopedI18n("untranslatedDashboard.insurance");
  const { results, status, loadMore } = usePaginatedQuery(
    api.insurance.listCoverages,
    now === undefined ? "skip" : { organizationId, now },
    { initialNumItems: 25 },
  );
  return (
    <div className="space-y-4">
      <DataTable
        loading={status === "LoadingFirstPage"}
        data={results}
        columns={[
          {
            key: "target",
            label: t("columns.target"),
            className: "min-w-0 flex-[1.6]",
            render: (row) =>
              row.target ? (
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium text-foreground">
                    {row.target.reference
                      ? `${row.target.reference} · ${row.target.label}`
                      : row.target.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {t(`targetKinds.${row.target.kind}`)}
                    {row.splitFromCoverageId ? ` · ${t("splitFrom")}` : ""}
                  </span>
                </span>
              ) : (
                <span className="text-amber-400">
                  {t("needsReviewTargets", {
                    count: row.recordedTargets.length,
                  })}
                </span>
              ),
          },
          {
            key: "policyNumber",
            label: t("columns.policy"),
            className: "w-32 flex-none",
          },
          {
            key: "coveredValue",
            label: t("columns.value"),
            className: "w-36 flex-none",
            render: (row) => (
              <MoneyCell
                value={row.coveredValue}
                currency={row.currency}
                locale={locale}
                notRecordedLabel={tInsurance("currencyNotRecorded")}
              />
            ),
          },
          {
            key: "period",
            label: t("columns.period"),
            className: "w-48 flex-none",
            render: (row) => (
              <span className="text-xs">
                <ClientDate
                  timestamp={row.start}
                  locale={locale}
                  options={CALENDAR_DATE_OPTIONS}
                />{" "}
                –{" "}
                <ClientDate
                  timestamp={row.end}
                  locale={locale}
                  options={CALENDAR_DATE_OPTIONS}
                />
              </span>
            ),
          },
          {
            key: "state",
            label: t("columns.state"),
            className: "w-32 flex-none",
            render: (row) => (
              <Badge variant="outline" className={stateColor[row.state]}>
                {t(`states.${row.state}`)}
              </Badge>
            ),
          },
          {
            key: "appraisalStatus",
            label: t("columns.appraisal"),
            className: "w-32 flex-none",
            render: (row) => (
              <span
                className={`text-xs ${appraisalColor[row.appraisalStatus]}`}
              >
                {t(`appraisalStatus.${row.appraisalStatus}`)}
              </span>
            ),
          },
        ]}
        emptyState={
          <EmptyState
            title={t("empty")}
            description={t("emptyDescription")}
            icon={ShieldCheck}
          />
        }
      />
      {status === "CanLoadMore" ? (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={() => loadMore(25)}>
            {t("loadMore")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
