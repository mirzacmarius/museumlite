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
  ImageIcon,
  Loader2,
  Printer,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

function getDeaccessionActionLabel(deaccession: {
  targetCollectionStatus: "deaccessioned" | "archived" | "deleted";
  method: "sale" | "donation" | "destruction" | "transfer";
}) {
  if (deaccession.targetCollectionStatus === "archived") {
    return "Archive";
  }

  if (deaccession.targetCollectionStatus === "deleted") {
    return "Delete";
  }

  switch (deaccession.method) {
    case "sale":
      return "Sale";
    case "donation":
      return "Donation";
    case "transfer":
      return "Transfer";
    case "destruction":
      return "Disposal";
  }
}

function formatStatusLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

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
  const collectionThumbnail = useQuery(
    api.collections.getThumbnail,
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

  const actionLabel = getDeaccessionActionLabel(deaccession);

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

  const formattedDeaccessionedDate = formatDateFns(
    new Date(deaccession.dateDeaccessioned),
    "MMMM d, yyyy",
    locale,
  );
  const collectionStatusLabel = collection
    ? formatStatusLabel(collection.status)
    : null;
  const workflowEntryCount = workflowHistory?.length ?? 0;
  const reviewStateLabel =
    deaccession.status === "pending"
      ? "Awaiting review"
      : deaccession.status === "approved"
        ? "Approved"
        : "Rejected";

  return (
    <>
      <main className="flex h-full min-h-0 w-full flex-col bg-background">
        <div className="flex-1 overflow-y-auto px-6">
          <div className="mx-auto min-h-full w-full max-w-[1440px] py-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <Button variant="ghost" size="sm" asChild className="w-fit">
                <Link href="/deaccessions">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {t("actions.backToDeaccessions")}
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPrintModalOpen(true)}
                className="border-border/70 bg-card/70 backdrop-blur"
              >
                <Printer className="mr-2 h-4 w-4" />
                {t("actions.boardReport")}
              </Button>
            </div>

            <div className="space-y-4">
              <section className="overflow-hidden rounded-[22px] border border-border/70 bg-card shadow-[0_18px_48px_rgba(0,0,0,0.12)]">
                <div className="border-b border-border/60 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_38%),linear-gradient(135deg,rgba(255,255,255,0.04),transparent_55%)] px-5 py-5 sm:px-6">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground/75">
                        Deaccession Review
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
                        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                          {deaccession.deaccessionNumber}
                        </h1>
                        {getStatusBadge(deaccession.status)}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        <span>{formattedDeaccessionedDate}</span>
                        <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
                        <span>{actionLabel}</span>
                        <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
                        <span className="capitalize">{deaccession.method}</span>
                        {collection && (
                          <>
                            <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
                            <span className="truncate">{collection.title}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-5 gap-y-2 text-sm lg:text-right">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/65">
                          Object Status
                        </p>
                        <p className="mt-1 font-medium">
                          {collectionStatusLabel || "Unavailable"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/65">
                          Review State
                        </p>
                        <p className="mt-1 font-medium">{reviewStateLabel}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 px-5 py-5 sm:px-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.95fr)]">
                  <div className="grid gap-4">
                    <div className="rounded-2xl border border-border/60 bg-background/40 p-4">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/65">
                        {t("detail.reason")}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground/92">
                        {deaccession.reason}
                      </p>
                    </div>

                    {(deaccession.disposition || deaccession.notes) && (
                      <div className="grid gap-3 md:grid-cols-2">
                        {deaccession.disposition && (
                          <div className="rounded-xl border border-border/60 bg-background/40 p-4">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/65">
                              {t("detail.disposition")}
                            </p>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground/85">
                              {deaccession.disposition}
                            </p>
                          </div>
                        )}
                        {deaccession.notes && (
                          <div className="rounded-xl border border-border/60 bg-background/40 p-4">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/65">
                              {t("detail.notes")}
                            </p>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground/85">
                              {deaccession.notes}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="grid gap-4">
                    {collection && (
                      <div className="rounded-2xl border border-border/60 bg-background/45 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/65">
                              Linked Object
                            </p>
                            <h2 className="mt-1 text-base font-semibold">
                              {t("detail.collectionObject")}
                            </h2>
                          </div>
                        </div>
                        <Link
                          href={`/collections/${collection._id}`}
                          className="mt-3 flex items-center gap-3 rounded-xl border border-border/60 bg-background/60 px-3 py-3 transition-colors hover:bg-accent/60"
                        >
                          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-background">
                            {collectionThumbnail?.thumbnailUrl ? (
                              <img
                                src={collectionThumbnail.thumbnailUrl}
                                alt={collection.title}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <ImageIcon className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {collection.title}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                              <span>{collection.accessionNumber}</span>
                              <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                              <span>{collectionStatusLabel}</span>
                            </div>
                          </div>
                          <ArrowLeft className="h-4 w-4 flex-shrink-0 rotate-180 text-muted-foreground" />
                        </Link>
                      </div>
                    )}

                    {deaccession.status === "pending" && (
                      <PermissionGate permission="collections.approve_deaccession">
                        <div className="rounded-2xl border border-border/60 bg-background/45 p-4">
                          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/65">
                            Approval
                          </p>
                          <h2 className="mt-1 text-base font-semibold">
                            {t("detail.approvalAction")}
                          </h2>
                          <div className="mt-3 space-y-3">
                            <div>
                              <Label htmlFor="comment">
                                {t("detail.commentLabel")}
                              </Label>
                              <Textarea
                                id="comment"
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                placeholder={t("detail.commentPlaceholder")}
                                rows={3}
                                disabled={isApproving || isRejecting}
                                className="mt-2 resize-none border-border/70 bg-background/70"
                              />
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                              <Button
                                onClick={handleApprove}
                                disabled={isApproving || isRejecting}
                                className="w-full"
                              >
                                {isApproving && (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                {!isApproving && (
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                )}
                                {`Approve ${actionLabel}`}
                              </Button>
                              <Button
                                variant="destructive"
                                onClick={handleReject}
                                disabled={isApproving || isRejecting}
                                className="w-full"
                              >
                                {isRejecting && (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                {!isRejecting && (
                                  <XCircle className="mr-2 h-4 w-4" />
                                )}
                                {t("actions.reject")}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </PermissionGate>
                    )}
                  </div>
                </div>
              </section>

              {workflowHistory && workflowHistory.length > 0 && (
                <section className="rounded-[20px] border border-border/70 bg-card p-5 shadow-[0_14px_36px_rgba(0,0,0,0.1)]">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/65">
                        Process Log
                      </p>
                      <h2 className="mt-1 text-lg font-semibold">
                        {t("detail.workflowHistory")}
                      </h2>
                    </div>
                    <div className="rounded-full border border-border/60 bg-background/60 px-3 py-1 text-xs text-muted-foreground">
                      {workflowEntryCount} entries
                    </div>
                  </div>

                  <div className="grid gap-2.5">
                    {workflowHistory.map((entry) => (
                      <div
                        key={`${entry.step}-${entry.approvedAt}`}
                        className="grid gap-3 rounded-xl border border-border/60 bg-background/40 px-3 py-3 sm:grid-cols-[44px_minmax(0,1fr)] sm:items-start"
                      >
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border/60 bg-background text-sm font-semibold">
                          {entry.step}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <p className="text-sm font-medium">
                              {entry.step === 0
                                ? t("detail.created")
                                : t("detail.step", { step: entry.step })}
                            </p>
                            <span className="text-xs text-muted-foreground">
                              {entry.approverName || t("detail.unknown")}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDateFns(
                                new Date(entry.approvedAt),
                                "MMM d, yyyy 'at' h:mm a",
                                locale,
                              )}
                            </span>
                          </div>
                          {entry.comment && (
                            <p className="mt-2 text-sm italic text-foreground/82">
                              {entry.comment}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      </main>

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
    </>
  );
}
