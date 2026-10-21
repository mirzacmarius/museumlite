"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { Highlight, HighlightScope } from "@v1/ui/motion-highlight";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  Archive,
  Download,
  Loader2,
  Plus,
  Printer,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ClientCurrentDateFns, ClientDateFns } from "@/components/client-date";
import { MoneyCell } from "@/components/money-cell";
import { PermissionGate } from "@/components/permission-gate";
import { useListState } from "@/hooks/use-list-state";
import { useListReturnPath } from "@/hooks/use-return-path";
import {
  type FormatLocale,
  formatMoney,
  totalsByCurrency,
} from "@/lib/format-number";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { AccessionsPageSkeleton } from "../accessions/accessions-page-skeleton";
import { DeaccessionKanban } from "./deaccession-kanban";
import {
  DEACCESSION_STATUS_FILTERS,
  deaccessionListState,
} from "./deaccession-list-state";
import { DeaccessionsStats } from "./deaccessions-stats";

type DeaccessionsPageClientProps = {
  organizationId: Id<"organizations">;
};

type DeaccessionsExportData = FunctionReturnType<
  typeof api.deaccessions.listForExport
>;
type DeaccessionsExportItem = DeaccessionsExportData["items"][number];

export function DeaccessionsPageClient({
  organizationId,
}: DeaccessionsPageClientProps) {
  const t = useScopedI18n("deaccessions");
  const tList = useScopedI18n("listState");
  const [isReportOpen, setIsReportOpen] = useState(false);
  const list = useListState(deaccessionListState);
  const { searchInput, setSearchInput } = list;
  const returnPath = useListReturnPath(deaccessionListState.keys);
  const counts = useQuery(api.deaccessions.getBoardCounts, { organizationId });
  const statusFilter = list.state.filters.status;

  if (counts === undefined) {
    return (
      <AccessionsPageSkeleton
        actionsCount={3}
        showWorkbenchNav={false}
        statsCount={2}
      />
    );
  }

  return (
    <>
      <div className="flex h-full flex-col p-6">
        <div className="mb-6 flex min-h-[52px] flex-wrap items-center justify-between gap-6">
          <DeaccessionsStats
            deaccessioned={counts.approved}
            pending={counts.pending}
          />

          <div className="flex flex-wrap items-center gap-3">
            <HighlightScope>
              <fieldset className="isolate flex rounded-lg bg-muted p-1">
                <legend className="sr-only">{t("table.status")}</legend>
                {DEACCESSION_STATUS_FILTERS.map((status) => (
                  <button
                    key={status}
                    type="button"
                    aria-pressed={statusFilter === status}
                    onClick={() => list.update({ filters: { status } })}
                    className={`relative rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                      statusFilter === status
                        ? ""
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {statusFilter === status && (
                      <Highlight className="bg-card shadow-sm" />
                    )}
                    {t(`filters.${status}`)}
                  </button>
                ))}
              </fieldset>
            </HighlightScope>

            <div className="group relative">
              <Search className="absolute left-2.5 top-2 size-3.5 text-muted-foreground transition-colors group-focus-within:text-foreground" />
              <input
                type="search"
                aria-label={t("searchPlaceholder")}
                placeholder={t("searchPlaceholder")}
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                className="w-64 rounded-md border border-input bg-background/60 py-1.5 pl-8 pr-3 text-xs text-foreground transition-all placeholder:text-muted-foreground focus:border-ring focus:bg-background focus:outline-none"
              />
            </div>

            {list.isFiltered ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2.5 text-xs"
                onClick={list.clear}
              >
                {tList("clearFilters")}
              </Button>
            ) : null}

            <PermissionGate
              loadingFallback={
                <div className="h-8 w-28 animate-pulse rounded-md bg-muted/60" />
              }
              permission="collections.read"
            >
              <button
                type="button"
                onClick={() => setIsReportOpen(true)}
                className="flex h-8 items-center gap-1.5 rounded-md border border-input bg-background/60 px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <Download className="size-3.5" />
                {t("actions.exportReport")}
              </button>
            </PermissionGate>

            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs"
            >
              <Link href="/objects?status=archived">
                <Archive className="size-3.5" />
                {t("withdrawnObjects")}
              </Link>
            </Button>

            <PermissionGate
              loadingFallback={
                <div className="h-8 w-24 animate-pulse rounded-md bg-muted/60" />
              }
              permission="collections.create"
            >
              <Link
                href="/deaccessions/new"
                className="flex h-8 items-center gap-1.5 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground shadow-[0_0_15px_-3px_rgba(99,102,241,0.3)] transition-colors hover:bg-primary/90"
              >
                <Plus className="size-3.5" />
                {t("actions.create")}
              </Link>
            </PermissionGate>
          </div>
        </div>

        <DeaccessionKanban
          organizationId={organizationId}
          search={list.state.search}
          status={statusFilter}
          counts={counts}
          returnPath={returnPath}
        />
      </div>

      <DeaccessionsReportDialog
        isOpen={isReportOpen}
        onOpenChange={setIsReportOpen}
        organizationId={organizationId}
      />
    </>
  );
}

type DeaccessionsReportDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: Id<"organizations">;
};

function DeaccessionsReportDialog({
  isOpen,
  onOpenChange,
  organizationId,
}: DeaccessionsReportDialogProps) {
  const locale = useCurrentLocale();
  const t = useScopedI18n("deaccessions");
  const tCommon = useScopedI18n("common");
  const exportData: DeaccessionsExportData | undefined = useQuery(
    api.deaccessions.listForExport,
    isOpen ? { organizationId } : "skip",
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className="flex h-[90vh] w-full max-w-[210mm] flex-col overflow-hidden rounded-none border-none bg-white p-0 text-black print:h-auto print:max-h-none print:max-w-none print:w-full print:overflow-visible print:rounded-none print:border-none print:p-0 print:shadow-none"
      >
        <DialogHeader className="flex-shrink-0 border-b border-zinc-200 p-6 pb-4 print:hidden">
          <DialogTitle className="text-black">{t("report.title")}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {exportData ? (
            <div className="space-y-5 bg-white p-6 text-black print:space-y-4 print:p-[15mm]">
              <div className="border-b border-zinc-200 pb-4">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  {exportData.organization.name}
                </p>
                <h1 className="text-xl font-semibold text-black">
                  {t("report.deaccessionReport")}
                </h1>
                <p className="text-sm text-zinc-600">
                  {t("report.allDeaccessions")}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 print:grid-cols-4 print:gap-2">
                <div className="rounded border border-zinc-200 p-3 text-center">
                  <p className="text-2xl font-bold text-black">
                    {exportData.totals.count}
                  </p>
                  <p className="text-xs text-zinc-500">{t("report.total")}</p>
                </div>
                <div className="rounded border border-zinc-200 p-3 text-center">
                  <p className="text-2xl font-bold text-amber-600">
                    {exportData.totals.pendingCount}
                  </p>
                  <p className="text-xs text-zinc-500">{t("report.pending")}</p>
                </div>
                <div className="rounded border border-zinc-200 p-3 text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {exportData.totals.approvedCount}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {t("report.approved")}
                  </p>
                </div>
                <div className="col-span-2 rounded border border-zinc-200 p-3 text-center sm:col-span-1">
                  <ProceedsByCurrency
                    items={exportData.items}
                    locale={locale}
                    withoutCurrencyLabel={(count) =>
                      t("report.proceedsWithoutCurrency", { count })
                    }
                  />
                  <p className="text-xs text-zinc-500">
                    {t("report.totalProceeds")}
                  </p>
                </div>
              </div>

              <div>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {t("report.records")}
                </h2>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-zinc-200">
                      <th className="py-2 text-left font-medium text-zinc-500">
                        {t("table.object")}
                      </th>
                      <th className="py-2 text-left font-medium text-zinc-500">
                        {t("report.date")}
                      </th>
                      <th className="py-2 text-left font-medium text-zinc-500">
                        {t("report.method")}
                      </th>
                      <th className="py-2 text-right font-medium text-zinc-500">
                        {t("report.proceeds")}
                      </th>
                      <th className="py-2 text-right font-medium text-zinc-500">
                        {t("report.status")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {exportData.items.map((item: DeaccessionsExportItem) => (
                      <tr key={item.deaccessionNumber}>
                        <td className="py-2">
                          <p className="font-medium text-black">
                            {item.collectionTitle}
                          </p>
                          <p className="text-zinc-500">
                            {item.accessionNumber || item.deaccessionNumber}
                          </p>
                        </td>
                        <td className="py-2 text-zinc-600">
                          <ClientDateFns
                            timestamp={item.dateDeaccessioned}
                            format="MMM d, yyyy"
                            locale={locale}
                          />
                        </td>
                        <td className="py-2 capitalize text-zinc-600">
                          {t(`method.${item.method}`)}
                        </td>
                        <td className="py-2 text-right text-zinc-600">
                          {item.proceedsAmount ? (
                            <MoneyCell
                              value={item.proceedsAmount}
                              currency={item.proceedsCurrency}
                              locale={locale}
                              notRecordedLabel={tCommon("currencyNotRecorded")}
                            />
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-2 text-right">
                          <span
                            className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${
                              item.status === "approved"
                                ? "bg-green-100 text-green-700"
                                : item.status === "rejected"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {t(`status.${item.status}`)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-zinc-200 pt-3 text-[10px] text-zinc-400">
                <p>
                  {t("report.generatedOn")}{" "}
                  <ClientCurrentDateFns
                    format="MMMM d, yyyy 'at' h:mm a"
                    locale={locale}
                  />{" "}
                  • {exportData.organization.name}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="size-8 animate-spin text-zinc-400" />
            </div>
          )}
        </div>

        <div className="flex flex-shrink-0 justify-end gap-2 border-t border-zinc-200 bg-white p-6 pt-4 print:hidden">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("actions.close")}
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="mr-2 size-4" />
            {t("actions.print")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Proceeds per recorded currency; amounts without a currency are counted. */
function ProceedsByCurrency({
  items,
  locale,
  withoutCurrencyLabel,
}: {
  items: DeaccessionsExportItem[];
  locale: string;
  withoutCurrencyLabel: (count: number) => string;
}) {
  const totals = totalsByCurrency(
    items.map((item) => ({
      amount: item.proceedsAmount,
      currency: item.proceedsCurrency,
    })),
  );
  return (
    <div className="space-y-0.5">
      {totals.byCurrency.length === 0 ? (
        <p className="text-lg font-bold text-black sm:text-2xl">{"—"}</p>
      ) : (
        totals.byCurrency.map((entry) => (
          <p
            key={entry.currency}
            className="text-lg font-bold tabular-nums text-black sm:text-2xl"
          >
            {formatMoney(entry.total, locale as FormatLocale, entry.currency)}
          </p>
        ))
      )}
      {totals.currencyNotRecordedCount > 0 ? (
        <p className="text-xs text-amber-700">
          {withoutCurrencyLabel(totals.currencyNotRecordedCount)}
        </p>
      ) : null}
    </div>
  );
}
