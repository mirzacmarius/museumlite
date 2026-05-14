"use client";

import { PermissionGate } from "@/components/permission-gate";
import { formatDateFns } from "@/lib/format-date";
import { formatCurrency } from "@/lib/format-number";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Download, Loader2, Plus, Printer, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { toast } from "sonner";

import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { AccessionsPageSkeleton } from "../accessions/accessions-page-skeleton";
import { DeaccessionKanban } from "./deaccession-kanban";
import { DeaccessionsStats } from "./deaccessions-stats";

type DeaccessionsPageClientProps = {
  organizationId: Id<"organizations">;
};

type DeaccessionsList = FunctionReturnType<typeof api.deaccessions.list>;
type DeaccessionListItem = DeaccessionsList["page"][number];
type DeaccessionsExportData = FunctionReturnType<
  typeof api.deaccessions.listForExport
>;
type DeaccessionsExportItem = DeaccessionsExportData["items"][number];

export function DeaccessionsPageClient({
  organizationId,
}: DeaccessionsPageClientProps) {
  const t = useScopedI18n("deaccessions");
  const objectsT = useScopedI18n("objects");
  const [searchQuery, setSearchQuery] = useState("");
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isEmptyingTrash, setIsEmptyingTrash] = useState(false);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const deaccessions = useQuery(api.deaccessions.list, {
    organizationId,
    paginationOpts: { numItems: 100, cursor: null },
  });
  const deletedObjectCount = useQuery(api.collections.countDeletedCollections, {
    organizationId,
  });
  const emptyDeletedCollections = useMutation(
    api.collections.emptyDeletedCollections,
  );

  if (deaccessions === undefined) {
    return (
      <AccessionsPageSkeleton
        actionsCount={3}
        showWorkbenchNav={false}
        statsCount={2}
      />
    );
  }

  const pending = deaccessions.page.filter(
    (item: DeaccessionListItem) => item.status === "pending",
  ).length;
  const deaccessioned = deaccessions.page.filter(
    (item: DeaccessionListItem) => item.status === "approved",
  ).length;

  const handleEmptyTrash = async () => {
    const count = deletedObjectCount ?? 0;
    if (count === 0) {
      return;
    }

    const confirmed = window.confirm(
      objectsT("actions.emptyTrashConfirm", { count }),
    );
    if (!confirmed) {
      return;
    }

    setIsEmptyingTrash(true);
    try {
      const result = await emptyDeletedCollections({ organizationId });
      toast.success(objectsT("actions.emptyTrashSuccess", result));
    } catch (error) {
      console.error("Failed to empty deleted objects:", error);
      toast.error(objectsT("error.failedToEmptyTrash"));
    } finally {
      setIsEmptyingTrash(false);
    }
  };

  return (
    <>
      <div className="flex h-full flex-col p-6">
        <div className="mb-6 flex min-h-[52px] items-center justify-between gap-6">
          <DeaccessionsStats deaccessioned={deaccessioned} pending={pending} />

          <div className="flex items-center gap-3">
            <div className="group relative">
              <Search className="absolute left-2.5 top-2 size-3.5 text-muted-foreground transition-colors group-focus-within:text-foreground" />
              <input
                type="text"
                placeholder={t("searchPlaceholder")}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-64 rounded-md border border-input bg-background/60 py-1.5 pl-8 pr-3 text-xs text-foreground transition-all placeholder:text-muted-foreground focus:border-ring focus:bg-background focus:outline-none"
              />
            </div>

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

            <PermissionGate
              loadingFallback={
                <div className="h-8 w-28 animate-pulse rounded-md bg-muted/60" />
              }
              permission="collections.delete"
            >
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleEmptyTrash}
                disabled={
                  isEmptyingTrash ||
                  deletedObjectCount === undefined ||
                  deletedObjectCount === 0
                }
                className="h-8 px-2.5 text-xs"
              >
                {isEmptyingTrash ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
                {isEmptyingTrash
                  ? objectsT("actions.emptyingTrash")
                  : objectsT("actions.emptyTrash")}
              </Button>
            </PermissionGate>

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
          deaccessions={deaccessions}
          organizationId={organizationId}
          searchQuery={deferredSearchQuery}
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
  const exportData: DeaccessionsExportData | undefined = useQuery(
    api.deaccessions.listForExport,
    isOpen ? { organizationId } : "skip",
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] w-full max-w-[210mm] flex-col overflow-hidden rounded-none border-none bg-white p-0 text-black print:h-auto print:max-h-none print:max-w-none print:w-full print:overflow-visible print:rounded-none print:border-none print:p-0 print:shadow-none">
        <DialogHeader className="flex-shrink-0 border-b border-gray-200 p-6 pb-4 print:hidden">
          <DialogTitle className="text-black">{t("report.title")}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {exportData ? (
            <div className="space-y-5 bg-white p-6 text-black print:space-y-4 print:p-[15mm]">
              <div className="border-b border-gray-200 pb-4">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  {exportData.organization.name}
                </p>
                <h1 className="text-xl font-bold text-black">
                  {t("report.deaccessionReport")}
                </h1>
                <p className="text-sm text-gray-600">
                  {t("report.allDeaccessions")}
                </p>
              </div>

              <div className="grid grid-cols-4 gap-4 print:gap-2">
                <div className="rounded border border-gray-200 p-3 text-center">
                  <p className="text-2xl font-bold text-black">
                    {exportData.totals.count}
                  </p>
                  <p className="text-xs text-gray-500">{t("report.total")}</p>
                </div>
                <div className="rounded border border-gray-200 p-3 text-center">
                  <p className="text-2xl font-bold text-amber-600">
                    {exportData.totals.pendingCount}
                  </p>
                  <p className="text-xs text-gray-500">{t("report.pending")}</p>
                </div>
                <div className="rounded border border-gray-200 p-3 text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {exportData.totals.approvedCount}
                  </p>
                  <p className="text-xs text-gray-500">
                    {t("report.approved")}
                  </p>
                </div>
                <div className="rounded border border-gray-200 p-3 text-center">
                  <p className="text-2xl font-bold text-black">
                    {formatCurrency(
                      exportData.totals.totalProceeds,
                      locale,
                      "USD",
                    ).replace(/\.\d+$/, "")}
                  </p>
                  <p className="text-xs text-gray-500">
                    {t("report.totalProceeds")}
                  </p>
                </div>
              </div>

              <div>
                <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
                  {t("report.records")}
                </h2>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="py-2 text-left font-medium text-gray-500">
                        {t("table.object")}
                      </th>
                      <th className="py-2 text-left font-medium text-gray-500">
                        {t("report.date")}
                      </th>
                      <th className="py-2 text-left font-medium text-gray-500">
                        {t("report.method")}
                      </th>
                      <th className="py-2 text-right font-medium text-gray-500">
                        {t("report.proceeds")}
                      </th>
                      <th className="py-2 text-right font-medium text-gray-500">
                        {t("report.status")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {exportData.items.map((item: DeaccessionsExportItem) => (
                      <tr key={item.deaccessionNumber}>
                        <td className="py-2">
                          <p className="font-medium text-black">
                            {item.collectionTitle}
                          </p>
                          <p className="text-gray-500">
                            {item.accessionNumber || item.deaccessionNumber}
                          </p>
                        </td>
                        <td className="py-2 text-gray-600">
                          {formatDateFns(
                            new Date(item.dateDeaccessioned),
                            "MMM d, yyyy",
                            locale,
                          )}
                        </td>
                        <td className="py-2 capitalize text-gray-600">
                          {t(`method.${item.method}`)}
                        </td>
                        <td className="py-2 text-right text-gray-600">
                          {item.proceedsAmount
                            ? formatCurrency(
                                item.proceedsAmount,
                                locale,
                                item.proceedsCurrency || "USD",
                              )
                            : "—"}
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

              <div className="border-t border-gray-200 pt-3 text-[10px] text-gray-400">
                <p>
                  {t("report.generatedOn")}{" "}
                  {formatDateFns(
                    new Date(),
                    "MMMM d, yyyy 'at' h:mm a",
                    locale,
                  )}{" "}
                  • {exportData.organization.name}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="size-8 animate-spin text-gray-400" />
            </div>
          )}
        </div>

        <div className="flex flex-shrink-0 justify-end gap-2 border-t border-gray-200 bg-white p-6 pt-4 print:hidden">
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
