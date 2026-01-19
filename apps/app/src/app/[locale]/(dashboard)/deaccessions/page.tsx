"use client";

import { useOrganization } from "@/components/organization-provider";
import { formatDateFns } from "@/lib/format-date";
import { formatCurrency } from "@/lib/format-number";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { Input } from "@v1/ui/input";
import { ScrollArea } from "@v1/ui/scroll-area";
import { useQuery } from "convex/react";
import {
  Archive,
  Building2,
  Download,
  Loader2,
  Plus,
  Printer,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export default function DeaccessionsPage() {
  const t = useScopedI18n("deaccessions");
  const locale = useCurrentLocale();
  const { currentOrganizationId, organizations, isLoading } = useOrganization();

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">{t("detail.loading")}</p>
      </div>
    );
  }

  if (!organizations || organizations.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-8">
          <Building2 className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold text-foreground">
              {t("noOrg.title")}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("noOrg.description")}
            </p>
          </div>
          <Button asChild>
            <Link href="/organizations/new">
              <Plus className="mr-2 h-4 w-4" />
              {t("noOrg.createButton")}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-8">
          <Archive className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold text-foreground">
              {t("selectOrg.title")}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("selectOrg.description")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-background">
      <DeaccessionTable organizationId={currentOrganizationId} />
    </div>
  );
}

function DeaccessionTable({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const t = useScopedI18n("deaccessions");
  const locale = useCurrentLocale();
  const [status, setStatus] = useState<
    "all" | "pending" | "approved" | "rejected"
  >("all");
  const [search, setSearch] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const prevFiltersRef = useRef({ status, search });

  useEffect(() => {
    setCursor(null);
    prevFiltersRef.current = { status, search };
  }, [organizationId, status, search]);

  const deaccessions = useQuery(api.deaccessions.list, {
    organizationId,
    paginationOpts: { numItems: 50, cursor },
    status: status !== "all" ? status : undefined,
    search: search || undefined,
  });

  const exportData = useQuery(
    api.deaccessions.listForExport,
    isExportModalOpen
      ? {
          organizationId,
          status: status !== "all" ? status : undefined,
        }
      : "skip",
  );

  const pendingCount =
    deaccessions?.page.filter((d) => d.status === "pending").length ?? 0;
  const approvedCount =
    deaccessions?.page.filter((d) => d.status === "approved").length ?? 0;

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h3 className="text-sm font-medium text-foreground">
            Deaccession Records
          </h3>
          <p className="text-xs text-muted-foreground">
            Items permanently removed from collection.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-6">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Pending
              </span>
              <span className="text-xl font-semibold tracking-tight text-white">
                {pendingCount}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Approved
              </span>
              <span className="text-xl font-semibold tracking-tight text-white">
                {approvedCount}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-white"
          >
            <Download className="h-3 w-3" />
            Export Report
          </button>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search deaccessions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border-border bg-muted/50 pl-9 text-sm placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex gap-1 rounded-lg border border-border bg-muted/30 p-1">
          {(["all", "pending", "approved", "rejected"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                status === s
                  ? "bg-muted text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden rounded-lg border border-border bg-muted/20">
        <ScrollArea className="h-full">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-muted/50 font-medium text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Object</th>
                <th className="px-4 py-3">Disposal Date</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {deaccessions === undefined && (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center">
                    <p className="text-muted-foreground">
                      Loading deaccessions...
                    </p>
                  </td>
                </tr>
              )}

              {deaccessions && deaccessions.page.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Archive className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        No deaccessions found
                      </p>
                    </div>
                  </td>
                </tr>
              )}

              {deaccessions?.page.map((item) => (
                <DeaccessionRow key={item._id} item={item} />
              ))}
            </tbody>
          </table>
        </ScrollArea>
      </div>

      {deaccessions && !deaccessions.isDone && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCursor(deaccessions.continueCursor)}
            className="border-border text-muted-foreground hover:bg-accent hover:text-white"
          >
            Load More
          </Button>
        </div>
      )}

      <Dialog open={isExportModalOpen} onOpenChange={setIsExportModalOpen}>
        <DialogContent className="flex flex-col max-w-[210mm] w-full h-[90vh] bg-white text-black p-0 print:max-w-none print:max-h-none print:h-auto print:w-full print:overflow-visible print:shadow-none print:border-none print:rounded-none print:p-0">
          <DialogHeader className="flex-shrink-0 print:hidden border-b border-gray-200 p-6 pb-4">
            <DialogTitle className="text-black">
              Deaccessions Summary Report
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            {exportData ? (
              <div className="space-y-5 bg-white text-black p-6 print:p-[15mm] print:space-y-4">
                <div className="border-b border-gray-200 pb-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    {exportData.organization.name}
                  </p>
                  <h1 className="text-xl font-bold text-black">
                    Deaccessions Report
                  </h1>
                  <p className="text-sm text-gray-600">
                    {status !== "all"
                      ? `${status.charAt(0).toUpperCase() + status.slice(1)} deaccessions`
                      : "All deaccessions"}
                  </p>
                </div>

                <div className="grid grid-cols-4 gap-4 print:gap-2">
                  <div className="rounded border border-gray-200 p-3 text-center">
                    <p className="text-2xl font-bold text-black">
                      {exportData.totals.count}
                    </p>
                    <p className="text-xs text-gray-500">Total</p>
                  </div>
                  <div className="rounded border border-gray-200 p-3 text-center">
                    <p className="text-2xl font-bold text-amber-600">
                      {exportData.totals.pendingCount}
                    </p>
                    <p className="text-xs text-gray-500">Pending</p>
                  </div>
                  <div className="rounded border border-gray-200 p-3 text-center">
                    <p className="text-2xl font-bold text-green-600">
                      {exportData.totals.approvedCount}
                    </p>
                    <p className="text-xs text-gray-500">Approved</p>
                  </div>
                  <div className="rounded border border-gray-200 p-3 text-center">
                    <p className="text-2xl font-bold text-black">
                      {formatCurrency(
                        exportData.totals.totalProceeds,
                        locale,
                        "USD",
                      ).replace(/\.\d+$/, "")}
                    </p>
                    <p className="text-xs text-gray-500">Total Proceeds</p>
                  </div>
                </div>

                <div>
                  <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
                    Deaccession Records
                  </h2>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="py-2 text-left font-medium text-gray-500">
                          Object
                        </th>
                        <th className="py-2 text-left font-medium text-gray-500">
                          Date
                        </th>
                        <th className="py-2 text-left font-medium text-gray-500">
                          Method
                        </th>
                        <th className="py-2 text-right font-medium text-gray-500">
                          Proceeds
                        </th>
                        <th className="py-2 text-right font-medium text-gray-500">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {exportData.items.map((item) => (
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
                            {item.method}
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
                              {item.status.charAt(0).toUpperCase() +
                                item.status.slice(1)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="border-t border-gray-200 pt-3 text-[10px] text-gray-400">
                  <p>
                    Generated on{" "}
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
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            )}
          </div>

          <div className="flex-shrink-0 flex justify-end gap-2 p-6 pt-4 border-t border-gray-200 bg-white print:hidden">
            <Button
              variant="outline"
              onClick={() => setIsExportModalOpen(false)}
            >
              Close
            </Button>
            <Button onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DeaccessionRow({
  item,
}: {
  item: {
    _id: Id<"deaccessions">;
    deaccessionNumber: string;
    collectionId: Id<"collections">;
    dateDeaccessioned: number;
    reason: string;
    method: "sale" | "donation" | "destruction" | "transfer";
    status: "pending" | "approved" | "rejected";
    workflowStep?: number;
  };
}) {
  const locale = useCurrentLocale();
  const collection = useQuery(api.collections.get, {
    collectionId: item.collectionId,
  });

  const getMethodDisplay = (method: string) => {
    switch (method) {
      case "sale":
        return "Sale / Auction";
      case "donation":
        return "Donation";
      case "destruction":
        return "Destruction (Witnessed)";
      case "transfer":
        return "Transfer";
      default:
        return method;
    }
  };

  const getReasonBadge = (reason: string, method: string) => {
    const lowerReason = reason.toLowerCase();
    if (
      lowerReason.includes("irreparable") ||
      lowerReason.includes("damaged") ||
      method === "destruction"
    ) {
      return (
        <span className="rounded border border-rose-500/20 bg-rose-500/10 px-1.5 py-0.5 text-rose-400">
          {reason.length > 30 ? `${reason.substring(0, 30)}...` : reason}
        </span>
      );
    }
    if (method === "sale") {
      return (
        <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-emerald-400">
          {reason.length > 30 ? `${reason.substring(0, 30)}...` : reason}
        </span>
      );
    }
    return (
      <span className="text-muted-foreground">
        {reason.length > 40 ? `${reason.substring(0, 40)}...` : reason}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <span className="rounded border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-amber-400">
            Pending
          </span>
        );
      case "approved":
        return (
          <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-emerald-400">
            Approved
          </span>
        );
      case "rejected":
        return (
          <span className="rounded border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-rose-400">
            Rejected
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <tr className="cursor-pointer transition-colors hover:bg-card">
      <td className="px-4 py-3">
        <Link href={`/deaccessions/${item._id}`} className="block">
          <div className="font-medium text-foreground/80">
            {collection?.title || item.deaccessionNumber}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {collection?.accessionNumber || "Loading..."}
          </div>
        </Link>
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        {formatDateFns(new Date(item.dateDeaccessioned), "MMM d, yyyy", locale)}
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        {getMethodDisplay(item.method)}
      </td>
      <td className="px-4 py-3">{getReasonBadge(item.reason, item.method)}</td>
      <td className="px-4 py-3 text-right">{getStatusBadge(item.status)}</td>
    </tr>
  );
}
