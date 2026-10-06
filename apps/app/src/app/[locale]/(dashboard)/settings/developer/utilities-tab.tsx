"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@v1/ui/alert-dialog";
import { Button } from "@v1/ui/button";
import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PermissionGate } from "@/components/permission-gate";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";

type AppLocale = ReturnType<typeof useCurrentLocale>;

const approvalDateFormatters: Record<AppLocale, Intl.DateTimeFormat> = {
  en: new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }),
  es: new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }),
  fr: new Intl.DateTimeFormat("fr", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }),
  no: new Intl.DateTimeFormat("nb-NO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }),
  ro: new Intl.DateTimeFormat("ro", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }),
};

export function UtilitiesTab({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const t = useScopedI18n("settings.developer");
  const untranslated = useScopedI18n(
    "untranslatedDashboard.settings.developer",
  );
  const common = useScopedI18n("common");
  const [status, setStatus] = useState<"deleted" | "archived">("deleted");
  const [cursor, setCursor] = useState<string | null>(null);
  const [isDeletingLoans, setIsDeletingLoans] = useState(false);
  const [deleteResult, setDeleteResult] = useState<{
    deletedLoans: number;
    deletedLoanItems: number;
    updatedCollections: number;
  } | null>(null);
  const review = useQuery(api.organizationCleanup.reviewRetainedCollections, {
    organizationId,
    status,
    paginationOpts: { numItems: 25, cursor },
  });
  const deleteAllLoans = useMutation(api.loans.deleteAllLoans);

  const handleDeleteAllLoans = async () => {
    setIsDeletingLoans(true);
    setDeleteResult(null);
    try {
      const result = await deleteAllLoans({ organizationId });
      setDeleteResult(result);
    } catch {
      alert(untranslated("failedToDeleteLoans"));
    } finally {
      setIsDeletingLoans(false);
    }
  };

  return (
    <div className="min-w-0 space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Retained evidence review</h2>
        <p className="text-sm text-muted-foreground">
          Institutional records and original files are retained. Review
          historical withdrawal metadata here, then open the object to inspect
          its evidence or restore it. Missing reasons, dates and actors require
          staff review; no historical facts are inferred.
        </p>
        <Button asChild variant="outline">
          <Link href="/objects?status=archived">Open archived objects</Link>
        </Button>
      </div>
      <ApprovalHistory organizationId={organizationId} />
      <section className="space-y-3 rounded-lg border border-destructive/50 bg-destructive/5 p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-full bg-destructive/10 p-2">
            <Trash2 className="size-5 text-destructive" />
          </div>
          <div className="flex-1 space-y-2">
            <div>
              <h3 className="text-lg font-semibold">{t("deleteAllLoans")}</h3>
              <p className="text-sm text-muted-foreground">
                {t("deleteLoansDesc")}
              </p>
            </div>
            {deleteResult && (
              <div className="space-y-1 rounded-md bg-muted p-4">
                <p className="text-sm font-medium">{t("operationCompleted")}</p>
                <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                  <li>
                    {t("deletedLoans", {
                      count: deleteResult.deletedLoans,
                      plural: deleteResult.deletedLoans === 1 ? "" : "s",
                    })}
                  </li>
                  <li>
                    {t("deletedLoanItems", {
                      count: deleteResult.deletedLoanItems,
                      plural: deleteResult.deletedLoanItems === 1 ? "" : "s",
                    })}
                  </li>
                  <li>
                    {t("updatedCollections", {
                      count: deleteResult.updatedCollections,
                      plural: deleteResult.updatedCollections === 1 ? "" : "s",
                    })}
                  </li>
                </ul>
              </div>
            )}
            <PermissionGate permission="loans.update">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={isDeletingLoans}>
                    <Trash2 className="mr-2 size-4" />
                    {isDeletingLoans ? common("deleting") : t("deleteAllLoans")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="size-5 text-destructive" />
                      {t("deleteLoansDialog")}
                    </AlertDialogTitle>
                    <AlertDialogDescription className="space-y-2">
                      <p className="font-medium">{t("willDelete")}</p>
                      <ul className="list-inside list-disc space-y-1 text-sm">
                        <li>{t("allLoans")}</li>
                        <li>{t("allLoanItems")}</li>
                        <li>{t("restoreActive")}</li>
                      </ul>
                      <p className="pt-2 font-semibold text-destructive">
                        {t("cannotUndo")}
                      </p>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAllLoans}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {t("confirmDelete")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </PermissionGate>
          </div>
        </div>
      </section>
      <div className="flex flex-wrap gap-2">
        {(["deleted", "archived"] as const).map((value) => (
          <Button
            key={value}
            variant={status === value ? "secondary" : "outline"}
            onClick={() => {
              setStatus(value);
              setCursor(null);
            }}
          >
            {value === "deleted"
              ? "Legacy deleted records"
              : "Archived records"}
          </Button>
        ))}
      </div>
      {review === undefined ? (
        <p className="text-sm text-muted-foreground">
          Loading retained records…
        </p>
      ) : (
        <>
          {review.page.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No retained records in this view.
            </p>
          ) : (
            <ul className="divide-y divide-white/10 rounded-lg border border-white/10">
              {review.page.map((record) => (
                <li key={record.collectionId} className="space-y-1 p-4">
                  <Link
                    className="font-medium underline underline-offset-4"
                    href={`/objects/${record.collectionId}`}
                  >
                    {record.accessionNumber}: {record.title}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {record.withdrawalReason ?? "Withdrawal reason unrecorded"}
                  </p>
                  {record.requiresReview && (
                    <p className="text-sm text-amber-400">
                      Historical withdrawal metadata needs review.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            {cursor !== null && (
              <Button variant="outline" onClick={() => setCursor(null)}>
                Back to first page
              </Button>
            )}
            {!review.isDone && (
              <Button
                variant="outline"
                onClick={() => setCursor(review.continueCursor)}
              >
                Next page
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ApprovalHistory({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const locale = useCurrentLocale();
  const approvals = useQuery(
    api.workflows.listRetainedApprovals,
    isOpen
      ? {
          organizationId,
          paginationOpts: { numItems: 25, cursor },
        }
      : "skip",
  );
  const formattedApprovals =
    approvals?.page.map((vote) => ({
      ...vote,
      formattedApprovedAt: approvalDateFormatters[locale].format(
        new Date(vote.approvedAt),
      ),
    })) ?? [];
  return (
    <section className="space-y-3">
      <Button
        variant="outline"
        aria-expanded={isOpen}
        aria-controls="retained-approval-history"
        onClick={() => setIsOpen(!isOpen)}
      >
        Historical workflow approvals
      </Button>
      {isOpen && (
        <div id="retained-approval-history" className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Original decisions remain readable after a workflow advances or
            resets. Cleared votes no longer count toward an active step.
          </p>
          {approvals === undefined ? (
            <p className="text-sm text-muted-foreground">Loading approvals…</p>
          ) : (
            <>
              {formattedApprovals.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No approvals recorded.
                </p>
              ) : (
                <ul className="divide-y divide-white/10 rounded-lg border border-white/10">
                  {formattedApprovals.map((vote) => (
                    <li
                      key={vote.approvalId}
                      className="space-y-1 break-words p-4"
                    >
                      <p className="text-sm font-medium">
                        {vote.workflowType}, step {vote.stepNumber}:{" "}
                        {vote.approvedByName ?? "Actor name unrecorded"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Record {vote.entityId}
                      </p>
                      {vote.comment && (
                        <p className="text-sm">{vote.comment}</p>
                      )}
                      <p className="text-right text-xs text-white/60">
                        {vote.formattedApprovedAt} UTC ·{" "}
                        {vote.clearedAt === null
                          ? "Active vote"
                          : "Retained historical vote"}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-2">
                {cursor !== null && (
                  <Button variant="outline" onClick={() => setCursor(null)}>
                    Back to first page
                  </Button>
                )}
                {!approvals.isDone && (
                  <Button
                    variant="outline"
                    onClick={() => setCursor(approvals.continueCursor)}
                  >
                    Next page
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
