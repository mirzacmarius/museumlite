"use client";

import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
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
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  DollarSign,
  Loader2,
  Printer,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function DeaccessionDetailPage() {
  const params = useParams();
  const deaccessionId = params.id as string;
  const locale = useCurrentLocale();
  const t = useScopedI18n("deaccessions");
  const tCommon = useScopedI18n("common");
  const { currentOrganizationId } = useOrganization();

  const deaccession = useQuery(
    api.deaccessions.get,
    deaccessionId
      ? { deaccessionId: deaccessionId as Id<"deaccessions"> }
      : "skip",
  );

  const collection = useQuery(
    api.collections.get,
    deaccession ? { collectionId: deaccession.collectionId } : "skip",
  );

  const workflowHistory = useQuery(
    api.deaccessions.getWorkflowHistory,
    deaccessionId
      ? { deaccessionId: deaccessionId as Id<"deaccessions"> }
      : "skip",
  );

  const [comment, setComment] = useState("");
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const approve = useMutation(api.deaccessions.approve);
  const reject = useMutation(api.deaccessions.reject);

  const exportData = useQuery(
    api.deaccessions.getExportData,
    deaccessionId && isPrintModalOpen
      ? { deaccessionId: deaccessionId as Id<"deaccessions"> }
      : "skip",
  );

  useEffect(() => {
    setComment("");
    setIsApproving(false);
    setIsRejecting(false);
  }, [deaccessionId]);

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">{t("detail.selectOrg")}</p>
      </div>
    );
  }

  if (deaccession === undefined || collection === undefined) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">{tCommon("loading")}</p>
      </div>
    );
  }

  if (deaccession === null) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">{t("detail.notFound")}</p>
      </div>
    );
  }

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      await approve({
        deaccessionId: deaccessionId as Id<"deaccessions">,
        comment: comment || undefined,
      });
      setComment("");
      // Show success - toast would go here
    } catch (error) {
      console.error("Failed to approve:", error);
      // Show error - toast would go here
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    setIsRejecting(true);
    try {
      await reject({
        deaccessionId: deaccessionId as Id<"deaccessions">,
        comment: comment || undefined,
      });
      setComment("");
      // Show success - toast would go here
    } catch (error) {
      console.error("Failed to reject:", error);
      // Show error - toast would go here
    } finally {
      setIsRejecting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center rounded-full bg-blue-500/10 px-3 py-1 text-sm font-medium text-blue-600">
            <Clock className="mr-1.5 h-4 w-4" />
            {t("status.pending")}
          </span>
        );
      case "approved":
        return (
          <span className="inline-flex items-center rounded-full bg-green-500/10 px-3 py-1 text-sm font-medium text-green-600">
            <CheckCircle className="mr-1.5 h-4 w-4" />
            {t("status.approved")}
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center rounded-full bg-red-500/10 px-3 py-1 text-sm font-medium text-red-600">
            <XCircle className="mr-1.5 h-4 w-4" />
            {t("status.rejected")}
          </span>
        );
    }
  };

  return (
    <div className="flex h-full w-full bg-background px-6">
      <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
        <div className="flex w-full flex-col gap-6">
          {/* Back button */}
          <Button variant="ghost" size="sm" asChild className="w-fit">
            <Link href="/deaccessions">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("actions.backToDeaccessions")}
            </Link>
          </Button>

          {/* Deaccession Info Card */}
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-2xl font-semibold">
                  {deaccession.deaccessionNumber}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {formatDateFns(
                    new Date(deaccession.dateDeaccessioned),
                    "MMMM d, yyyy",
                    locale,
                  )}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {getStatusBadge(deaccession.status)}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsPrintModalOpen(true)}
                >
                  <Printer className="mr-2 h-4 w-4" />
                  {t("actions.boardReport")}
                </Button>
              </div>
            </div>

            <div className="grid gap-4">
              <div>
                <Label className="text-muted-foreground">
                  {t("detail.reason")}
                </Label>
                <p className="mt-1 whitespace-pre-wrap">{deaccession.reason}</p>
              </div>

              <div>
                <Label className="text-muted-foreground">
                  {t("detail.methodLabel")}
                </Label>
                <p className="mt-1 capitalize">{deaccession.method}</p>
              </div>

              {deaccession.disposition && (
                <div>
                  <Label className="text-muted-foreground">
                    {t("detail.disposition")}
                  </Label>
                  <p className="mt-1 whitespace-pre-wrap">
                    {deaccession.disposition}
                  </p>
                </div>
              )}

              {deaccession.notes && (
                <div>
                  <Label className="text-muted-foreground">
                    {t("detail.notes")}
                  </Label>
                  <p className="mt-1 whitespace-pre-wrap">
                    {deaccession.notes}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Collection Info Card */}
          {collection && (
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="text-lg font-semibold mb-4">
                {t("detail.collectionObject")}
              </h3>
              <Link
                href={`/collections/${collection._id}`}
                className="flex items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-accent"
              >
                <div className="flex-1">
                  <h4 className="font-medium">{collection.title}</h4>
                  <p className="text-sm text-muted-foreground">
                    {collection.accessionNumber}
                  </p>
                  <p className="text-sm text-muted-foreground capitalize mt-1">
                    Status: {collection.status}
                  </p>
                </div>
                <ArrowLeft className="h-4 w-4 rotate-180 flex-shrink-0" />
              </Link>
            </div>
          )}

          {/* Workflow Timeline */}
          {workflowHistory && workflowHistory.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="text-lg font-semibold mb-4">
                {t("detail.workflowHistory")}
              </h3>
              <div className="space-y-4">
                {workflowHistory.map((entry, index) => (
                  <div
                    key={`${entry.step}-${entry.approvedAt}`}
                    className="flex gap-4"
                  >
                    <div className="flex flex-col items-center">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium flex-shrink-0">
                        {entry.step}
                      </div>
                      {index < workflowHistory.length - 1 && (
                        <div className="flex-1 w-px bg-border mt-2 min-h-[40px]" />
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <p className="font-medium">
                        {entry.step === 0
                          ? t("detail.created")
                          : t("detail.step", { step: entry.step })}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {entry.approverName || t("detail.unknown")} •{" "}
                        {formatDateFns(
                          new Date(entry.approvedAt),
                          "MMM d, yyyy 'at' h:mm a",
                          locale,
                        )}
                      </p>
                      {entry.comment && (
                        <p className="mt-2 text-sm italic bg-muted/50 p-2 rounded">
                          {entry.comment}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Approval Actions */}
          {deaccession.status === "pending" && (
            <PermissionGate permission="collections.approve_deaccession">
              <div className="rounded-lg border border-border bg-card p-6">
                <h3 className="text-lg font-semibold mb-4">
                  {t("detail.approvalAction")}
                </h3>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="comment">{t("detail.commentLabel")}</Label>
                    <Textarea
                      id="comment"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder={t("detail.commentPlaceholder")}
                      rows={3}
                      disabled={isApproving || isRejecting}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleApprove}
                      disabled={isApproving || isRejecting}
                    >
                      {isApproving && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {!isApproving && <CheckCircle className="mr-2 h-4 w-4" />}
                      {t("actions.approve")}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleReject}
                      disabled={isApproving || isRejecting}
                    >
                      {isRejecting && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {!isRejecting && <XCircle className="mr-2 h-4 w-4" />}
                      {t("actions.reject")}
                    </Button>
                  </div>
                </div>
              </div>
            </PermissionGate>
          )}
        </div>
      </div>

      <Dialog open={isPrintModalOpen} onOpenChange={setIsPrintModalOpen}>
        <DialogContent className="flex flex-col max-w-[210mm] w-full h-[90vh] bg-white text-black p-0 print:max-w-none print:max-h-none print:h-auto print:w-full print:overflow-visible print:shadow-none print:border-none print:rounded-none print:p-0">
          <DialogHeader className="flex-shrink-0 print:hidden border-b border-gray-200 p-6 pb-4">
            <DialogTitle className="text-black">
              {t("report.deaccessionBoardReport")}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            {exportData ? (
              <div className="space-y-5 bg-white text-black p-6 print:p-[15mm] print:space-y-4 print:break-inside-avoid-page">
                <div className="flex items-start gap-4 border-b border-gray-200 pb-4 print:gap-3 print:pb-3">
                  {exportData.collection?.primaryImageUrl && (
                    <img
                      src={exportData.collection.primaryImageUrl}
                      alt={exportData.collection.title}
                      className="h-24 w-24 flex-shrink-0 rounded border border-gray-300 object-cover print:h-20 print:w-20"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500 print:text-[10px]">
                      {exportData.organization.name}
                    </p>
                    <h1 className="text-xl font-bold text-black print:text-lg">
                      Deaccession Report
                    </h1>
                    <p className="text-sm text-gray-600 print:text-xs">
                      {exportData.deaccession.deaccessionNumber}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span
                      className={`inline-block rounded px-2 py-1 text-xs font-medium ${
                        exportData.deaccession.status === "approved"
                          ? "bg-green-100 text-green-800"
                          : exportData.deaccession.status === "rejected"
                            ? "bg-red-100 text-red-800"
                            : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {exportData.deaccession.status.charAt(0).toUpperCase() +
                        exportData.deaccession.status.slice(1)}
                    </span>
                  </div>
                </div>

                {exportData.collection && (
                  <div className="print:break-inside-avoid">
                    <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500 print:text-[10px]">
                      Object Information
                    </h2>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm print:text-xs print:gap-x-4 print:gap-y-1">
                      <div>
                        <p className="text-xs font-medium text-gray-500 print:text-[10px]">
                          Title
                        </p>
                        <p className="text-black">
                          {exportData.collection.title}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 print:text-[10px]">
                          Accession Number
                        </p>
                        <p className="text-black">
                          {exportData.collection.accessionNumber || "—"}
                        </p>
                      </div>
                      {exportData.collection.description && (
                        <div className="col-span-2">
                          <p className="text-xs font-medium text-gray-500 print:text-[10px]">
                            Description
                          </p>
                          <p className="text-black">
                            {exportData.collection.description}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="print:break-inside-avoid">
                  <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500 print:text-[10px]">
                    Deaccession Details
                  </h2>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm print:text-xs print:gap-x-4 print:gap-y-1">
                    <div>
                      <p className="text-xs font-medium text-gray-500 print:text-[10px]">
                        Date Deaccessioned
                      </p>
                      <p className="text-black">
                        {formatDateFns(
                          new Date(exportData.deaccession.dateDeaccessioned),
                          "MMMM d, yyyy",
                          locale,
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 print:text-[10px]">
                        Method
                      </p>
                      <p className="text-black capitalize">
                        {exportData.deaccession.method}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs font-medium text-gray-500 print:text-[10px]">
                        Reason
                      </p>
                      <p className="text-black whitespace-pre-wrap">
                        {exportData.deaccession.reason}
                      </p>
                    </div>
                    {exportData.deaccession.disposition && (
                      <div className="col-span-2">
                        <p className="text-xs font-medium text-gray-500 print:text-[10px]">
                          Disposition
                        </p>
                        <p className="text-black whitespace-pre-wrap">
                          {exportData.deaccession.disposition}
                        </p>
                      </div>
                    )}
                    {exportData.deaccession.notes && (
                      <div className="col-span-2">
                        <p className="text-xs font-medium text-gray-500 print:text-[10px]">
                          Notes
                        </p>
                        <p className="text-black whitespace-pre-wrap">
                          {exportData.deaccession.notes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {(exportData.deaccession.proceedsAmount ||
                  exportData.deaccession.proceedsRecipient) && (
                  <div className="print:break-inside-avoid">
                    <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500 print:text-[10px]">
                      <DollarSign className="inline h-3 w-3 mr-1" />
                      Proceeds Information
                    </h2>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm print:text-xs print:gap-x-4 print:gap-y-1">
                      {exportData.deaccession.proceedsAmount !== undefined && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 print:text-[10px]">
                            Amount
                          </p>
                          <p className="text-black font-semibold">
                            {formatCurrency(
                              exportData.deaccession.proceedsAmount,
                              locale,
                              exportData.deaccession.proceedsCurrency || "USD",
                            )}
                          </p>
                        </div>
                      )}
                      {exportData.deaccession.proceedsRecipient && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 print:text-[10px]">
                            Recipient
                          </p>
                          <p className="text-black">
                            {exportData.deaccession.proceedsRecipient}
                          </p>
                        </div>
                      )}
                      {exportData.deaccession.proceedsDate && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 print:text-[10px]">
                            Date Received
                          </p>
                          <p className="text-black">
                            {formatDateFns(
                              new Date(exportData.deaccession.proceedsDate),
                              "MMMM d, yyyy",
                              locale,
                            )}
                          </p>
                        </div>
                      )}
                      {exportData.deaccession.proceedsNotes && (
                        <div className="col-span-2">
                          <p className="text-xs font-medium text-gray-500 print:text-[10px]">
                            Proceeds Notes
                          </p>
                          <p className="text-black whitespace-pre-wrap">
                            {exportData.deaccession.proceedsNotes}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {exportData.workflowHistory.length > 0 && (
                  <div className="print:break-inside-avoid">
                    <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500 print:text-[10px]">
                      Approval History
                    </h2>
                    <div className="space-y-2">
                      {exportData.workflowHistory.map((entry, index) => (
                        <div
                          key={`${entry.step}-${entry.approvedAt}`}
                          className="flex items-start gap-3 text-sm print:text-xs"
                        >
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-medium flex-shrink-0">
                            {entry.step}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-black">
                              {entry.step === 0
                                ? t("detail.created")
                                : t("detail.step", { step: entry.step })}
                            </p>
                            <p className="text-xs text-gray-500">
                              {entry.approverName} •{" "}
                              {formatDateFns(
                                new Date(entry.approvedAt),
                                "MMM d, yyyy 'at' h:mm a",
                                locale,
                              )}
                            </p>
                            {entry.comment && (
                              <p className="mt-1 text-xs italic text-gray-600">
                                "{entry.comment}"
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {exportData.deaccession.approvedAt &&
                  exportData.approverName && (
                    <div className="print:break-inside-avoid border-t border-gray-200 pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-gray-500 print:text-[10px]">
                            Final Approval
                          </p>
                          <p className="text-sm font-medium text-black">
                            {exportData.approverName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatDateFns(
                              new Date(exportData.deaccession.approvedAt),
                              "MMMM d, yyyy 'at' h:mm a",
                              locale,
                            )}
                          </p>
                        </div>
                        <CheckCircle className="h-8 w-8 text-green-600" />
                      </div>
                    </div>
                  )}

                <div className="border-t border-gray-200 pt-3 text-[10px] text-gray-400 print:pt-2 print:text-[9px]">
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
              onClick={() => setIsPrintModalOpen(false)}
            >
              {t("actions.close")}
            </Button>
            <Button onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" />
              {t("actions.print")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
