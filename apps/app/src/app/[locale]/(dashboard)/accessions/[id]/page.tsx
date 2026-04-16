"use client";

import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { formatDate } from "@/lib/format-date";
import { formatCurrency } from "@/lib/format-number";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useMutation, useQuery } from "convex/react";
import {
  Archive,
  ArrowLeft,
  CheckCircle,
  Clock,
  Edit,
  ExternalLink,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ApprovalWorkflow } from "./_components/approval-workflow";

export default function AccessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const accessionId = params.id as string;
  const { currentOrganizationId } = useOrganization();
  const locale = useCurrentLocale();
  const tCommon = useScopedI18n("common");
  const submitForApproval = useMutation(api.accessions.submitForApproval);
  const [isSubmittingDraft, setIsSubmittingDraft] = useState(false);
  const [draftActionError, setDraftActionError] = useState<string | null>(null);

  const accession = useQuery(
    api.accessions.get,
    accessionId ? { accessionId: accessionId as Id<"accessions"> } : "skip",
  );

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">
          Please select an organization to view accessions.
        </p>
      </div>
    );
  }

  if (accession === undefined) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">{tCommon("loading")}</p>
      </div>
    );
  }

  if (accession === null) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">Accession not found</p>
      </div>
    );
  }

  const isDraft =
    accession.status === "pending" && accession.workflowStep === 0;
  const displayStatus = isDraft ? "draft" : accession.status;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "draft":
        return <Archive className="h-5 w-5 text-slate-400" />;
      case "pending":
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case "approved":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "rejected":
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft":
        return "bg-slate-500/10 text-slate-300";
      case "pending":
        return "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400";
      case "approved":
        return "bg-green-500/10 text-green-600 dark:text-green-400";
      case "rejected":
        return "bg-red-500/10 text-red-600 dark:text-red-400";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const handleSubmitDraft = async () => {
    setIsSubmittingDraft(true);
    setDraftActionError(null);
    try {
      await submitForApproval({
        accessionId: accessionId as Id<"accessions">,
      });
      router.refresh();
    } catch (err) {
      setDraftActionError(
        err instanceof Error ? err.message : "Failed to submit draft",
      );
    } finally {
      setIsSubmittingDraft(false);
    }
  };

  return (
    <div className="flex h-full w-full bg-background px-6">
      <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
        <div className="flex w-full flex-col rounded-lg border border-border bg-card">
          {/* Header */}
          <div className="flex w-full items-center justify-between rounded-lg border-b border-border p-6">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/accessions">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Accessions
                </Link>
              </Button>
              <div className="flex items-center gap-3">
                {getStatusIcon(displayStatus)}
                <span
                  className={`rounded-full px-3 py-1 text-sm font-medium ${getStatusColor(
                    displayStatus,
                  )}`}
                >
                  {displayStatus.charAt(0).toUpperCase() +
                    displayStatus.slice(1)}
                </span>
                {accession.workflowStep !== undefined && (
                  <span className="text-sm text-muted-foreground">
                    Step {accession.workflowStep}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {isDraft ? (
                <PermissionGate permission="collections.update">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/accessions/${accessionId}/edit-object`}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit Draft
                    </Link>
                  </Button>
                </PermissionGate>
              ) : null}
              {accession.status === "pending" && !isDraft ? (
                <PermissionGate permission="collections.update">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/accessions/${accessionId}/edit`}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </Link>
                  </Button>
                </PermissionGate>
              ) : null}
              {accession.collectionId && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/collections/${accession.collectionId}`}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View Collection
                  </Link>
                </Button>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {draftActionError ? (
              <div className="mb-6 rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                {draftActionError}
              </div>
            ) : null}

            {accession.draftObjectData ? (
              <div className="mb-6 rounded-xl border border-border/60 bg-secondary/20 p-5">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Proposed Object
                  </p>
                  <h2 className="text-xl font-semibold text-foreground">
                    {accession.draftObjectData.title}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {accession.draftObjectData.creator || "Unknown creator"}
                  </p>
                </div>

                <div className="mt-4 grid gap-4 text-sm md:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      Object Type
                    </p>
                    <p className="mt-1 text-foreground">
                      {accession.draftObjectData.objectName ||
                        accession.draftObjectData.objectType?.join(", ") ||
                        "Not set"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      Date Created
                    </p>
                    <p className="mt-1 text-foreground">
                      {accession.draftObjectData.dateCreated || "Unknown"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      Collection
                    </p>
                    <p className="mt-1 text-foreground">
                      {accession.draftObjectData.collectionType || "general"}
                    </p>
                  </div>
                </div>

                {accession.draftObjectData.description ? (
                  <div className="mt-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      Description
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                      {accession.draftObjectData.description}
                    </p>
                  </div>
                ) : null}

                {isDraft ? (
                  <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border/60 pt-5">
                    <PermissionGate permission="collections.update">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/accessions/${accessionId}/edit-object`}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit Draft
                        </Link>
                      </Button>
                    </PermissionGate>
                    <PermissionGate permission="collections.update">
                      <Button
                        size="sm"
                        onClick={() => void handleSubmitDraft()}
                        disabled={isSubmittingDraft}
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        {isSubmittingDraft
                          ? "Submitting..."
                          : "Submit for Approval"}
                      </Button>
                    </PermissionGate>
                    <p className="text-sm text-muted-foreground">
                      Drafts must be submitted before approval can begin.
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="grid gap-6 md:grid-cols-2">
              {/* Accession Details */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Accession Number
                  </label>
                  <p className="mt-1 text-lg font-medium">
                    {accession.accessionNumber}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Date Received
                  </label>
                  <p className="mt-1">
                    {formatDate(new Date(accession.dateReceived), locale)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Source
                  </label>
                  <p className="mt-1">{accession.source}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Method
                  </label>
                  <p className="mt-1 capitalize">{accession.method}</p>
                </div>
                {accession.cost && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Cost
                    </label>
                    <p className="mt-1">
                      {formatCurrency(accession.cost, locale, "USD")}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {accession.notes && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Notes
                    </label>
                    <p className="mt-1 whitespace-pre-wrap">
                      {accession.notes}
                    </p>
                  </div>
                )}
                {accession.approvedBy && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Approved By
                    </label>
                    <p className="mt-1">
                      {accession.approvedAt
                        ? formatDate(new Date(accession.approvedAt), locale)
                        : "—"}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Approval Workflow */}
            {accession.status === "pending" && !isDraft && (
              <div className="mt-8 border-t border-border pt-6">
                <ApprovalWorkflow key={accessionId} accessionId={accessionId} />
              </div>
            )}

            {/* Workflow History */}
            {accession.workflowHistory &&
              accession.workflowHistory.length > 0 && (
                <div className="mt-8 border-t border-border pt-6">
                  <h3 className="mb-4 text-lg font-medium">Workflow History</h3>
                  <div className="space-y-3">
                    {accession.workflowHistory.map((entry) => (
                      <div
                        key={`${entry.step}-${entry.approvedBy}-${entry.approvedAt}`}
                        className="rounded-lg border border-border bg-card p-4"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">Step {entry.step}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatDate(new Date(entry.approvedAt), locale)}
                            </p>
                            {entry.comment && (
                              <p className="mt-1 text-sm">{entry.comment}</p>
                            )}
                          </div>
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
