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
  Calendar,
  CheckCircle,
  Clock,
  Edit,
  ExternalLink,
  Info,
  Package,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";
import { ApprovalWorkflow } from "./_components/approval-workflow";

type WorkflowStepInfo = {
  stepNumber: number;
  name: string;
  roleName?: string;
  approvalMode?: "single" | "multi" | "unanimous";
  requiredApprovals?: number;
};

type WorkflowHistoryEntry = {
  step: number;
  approvedBy: Id<"users">;
  approvedAt: number;
  comment?: string;
};

function formatWorkflowStepDetails(step: WorkflowStepInfo) {
  const details: string[] = [];

  if (step.roleName) {
    details.push(`Approval by ${step.roleName}`);
  }

  if (step.approvalMode === "multi" && step.requiredApprovals) {
    details.push(`${step.requiredApprovals} approvals required`);
  } else if (step.approvalMode === "unanimous") {
    details.push("All approvers must approve");
  }

  return details.length > 0 ? details.join(" • ") : "Approval step";
}

function SectionCard({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/60 bg-background/70 p-5 shadow-sm sm:p-6">
      <div className="space-y-1">
        {eyebrow ? (
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {description ? (
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function DetailField({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <div className="text-sm leading-6 text-foreground">{value}</div>
    </div>
  );
}

export default function AccessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const accessionId = params.id as string;
  const { currentOrganizationId } = useOrganization();
  const locale = useCurrentLocale();
  const tCommon = useScopedI18n("common");
  const submitForApproval = useMutation(api.accessions.submitForApproval);
  const verifySource = useMutation(api.accessions.verifySource);
  const [isSubmittingDraft, setIsSubmittingDraft] = useState(false);
  const [isVerifyingSource, setIsVerifyingSource] = useState(false);
  const [draftActionError, setDraftActionError] = useState<string | null>(null);

  const accession = useQuery(
    api.accessions.get,
    accessionId ? { accessionId: accessionId as Id<"accessions"> } : "skip",
  );
  const workflowSteps = useQuery(
    api.accessions.getWorkflowSteps,
    currentOrganizationId ? { organizationId: currentOrganizationId } : "skip",
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
  const configuredWorkflowSteps =
    workflowSteps?.steps.filter(
      (step: WorkflowStepInfo) => step.stepNumber > 0,
    ) ?? [];
  const currentWorkflowStep = configuredWorkflowSteps.find(
    (step: WorkflowStepInfo) => step.stepNumber === accession.workflowStep,
  );
  const requiresSourceVerification =
    !accession.draftObjectData &&
    accession.status === "pending" &&
    (workflowSteps?.requireSourceVerification ?? false);
  const isSourceVerified = accession.sourceVerified ?? false;
  const accessionTitle =
    accession.draftObjectData?.title ||
    accession.source ||
    accession.accessionNumber;
  const accessionSubtitle = accession.draftObjectData
    ? accession.draftObjectData.creator || "Draft object awaiting review."
    : accession.notes ||
      "Review accession details, workflow state, and approval activity.";

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

  const handleVerifySource = async () => {
    setIsVerifyingSource(true);
    setDraftActionError(null);
    try {
      await verifySource({
        accessionId: accessionId as Id<"accessions">,
      });
      router.refresh();
    } catch (err) {
      setDraftActionError(
        err instanceof Error ? err.message : "Failed to verify source",
      );
    } finally {
      setIsVerifyingSource(false);
    }
  };

  return (
    <main className="z-10 flex h-full min-h-0 min-w-0 w-full flex-1 flex-col bg-background">
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border/60 bg-background/80 px-6 backdrop-blur-xl">
        <div className="flex items-center gap-2 text-xs">
          <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
            <Link href="/accessions">
              <ArrowLeft className="h-4 w-4 text-muted-foreground" />
            </Link>
          </Button>
          <span className="text-muted-foreground">Accessions</span>
          <span className="text-muted-foreground/50">/</span>
          <span className="font-medium text-foreground">
            {accession.accessionNumber}
          </span>
        </div>

        <div className="flex items-center gap-3">
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
          {accession.collectionId ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/collections/${accession.collectionId}`}>
                <ExternalLink className="mr-2 h-4 w-4" />
                View Collection
              </Link>
            </Button>
          ) : null}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="border-b border-border/60 bg-secondary/10 px-8 py-8">
          <div className="mx-auto flex max-w-5xl flex-col gap-8 lg:flex-row lg:items-start">
            <div className="flex h-48 w-48 shrink-0 flex-col items-center justify-center rounded-xl border border-border/60 bg-secondary text-center shadow-2xl">
              {getStatusIcon(displayStatus)}
              <div className="mt-4 space-y-1 px-6">
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Accession
                </p>
                <p className="text-sm font-medium text-foreground">
                  {accession.accessionNumber}
                </p>
              </div>
            </div>

            <div className="flex-1 space-y-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <span
                  className={`rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${getStatusColor(
                    displayStatus,
                  )}`}
                >
                  {displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1)}
                </span>
                <div className="rounded bg-secondary/60 px-2 py-1 text-[10px] font-mono text-muted-foreground">
                  {accession.accessionNumber}
                </div>
                {currentWorkflowStep ? (
                  <div className="rounded bg-background/80 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    {currentWorkflowStep.name}
                  </div>
                ) : null}
              </div>

              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {accessionTitle}
              </h1>

              <p className="max-w-3xl text-sm text-muted-foreground">
                {accessionSubtitle}
              </p>

              <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>
                    Received {formatDate(new Date(accession.dateReceived), locale)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  <span>{accession.source}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  <span className="capitalize">{accession.method}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-6xl px-6 py-8">
          {draftActionError ? (
            <div className="mb-6 rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
              {draftActionError}
            </div>
          ) : null}

          <div className="space-y-6">
            {configuredWorkflowSteps.length > 0 ? (
              <SectionCard
                eyebrow="Workflow"
                title={
                  currentWorkflowStep
                    ? `Current step: ${currentWorkflowStep.name}`
                    : "Approval workflow"
                }
                description={
                  currentWorkflowStep
                    ? `${formatWorkflowStepDetails(currentWorkflowStep)}${
                        requiresSourceVerification
                          ? " • Requires verified source"
                          : ""
                      }`
                    : undefined
                }
              >
                <div className="space-y-3">
                  {configuredWorkflowSteps.map((step: WorkflowStepInfo) => {
                    const isCurrent = step.stepNumber === accession.workflowStep;
                    const isCompleted =
                      accession.workflowStep !== undefined &&
                      accession.workflowStep > step.stepNumber;

                    return (
                      <div
                        key={step.stepNumber}
                        className="flex items-start justify-between gap-4 rounded-lg border border-border/60 bg-background/40 px-4 py-3"
                      >
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-foreground">
                            {step.name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {formatWorkflowStepDetails(step)}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                            isCurrent
                              ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                              : isCompleted
                                ? "bg-green-500/10 text-green-600 dark:text-green-400"
                                : "bg-secondary text-muted-foreground"
                          }`}
                        >
                          {isCurrent
                            ? "Current"
                            : isCompleted
                              ? "Done"
                              : `Step ${step.stepNumber}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </SectionCard>
            ) : null}

            {requiresSourceVerification ? (
              <SectionCard
                eyebrow="Source Verification"
                title={
                  isSourceVerified
                    ? "Source verified"
                    : "Source verification required"
                }
                description={
                  isSourceVerified
                    ? accession.sourceVerificationNotes ||
                      "This accession can proceed through approval."
                    : "Approval is blocked until the source or donor has been verified."
                }
              >
                <div className="flex justify-end">
                  <PermissionGate permission="collections.update">
                    <Button
                      type="button"
                      variant={isSourceVerified ? "outline" : "default"}
                      size="sm"
                      disabled={isVerifyingSource || isSourceVerified}
                      onClick={() => void handleVerifySource()}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      {isSourceVerified
                        ? "Verified"
                        : isVerifyingSource
                          ? "Verifying..."
                          : "Verify Source"}
                    </Button>
                  </PermissionGate>
                </div>
              </SectionCard>
            ) : null}

            {accession.draftObjectData ? (
              <SectionCard
                eyebrow="Proposed Object"
                title={accession.draftObjectData.title}
                description={accession.draftObjectData.creator || "Unknown creator"}
              >
                <div className="grid gap-4 md:grid-cols-3">
                  <DetailField
                    label="Object Type"
                    value={
                      accession.draftObjectData.objectName ||
                      accession.draftObjectData.objectType?.join(", ") ||
                      "Not set"
                    }
                  />
                  <DetailField
                    label="Date Created"
                    value={accession.draftObjectData.dateCreated || "Unknown"}
                  />
                  <DetailField
                    label="Collection"
                    value={accession.draftObjectData.collectionType || "general"}
                  />
                </div>

                {accession.draftObjectData.description ? (
                  <div className="mt-5">
                    <DetailField
                      label="Description"
                      value={
                        <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
                          {accession.draftObjectData.description}
                        </p>
                      }
                    />
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
              </SectionCard>
            ) : null}

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
              <SectionCard
                eyebrow="Record"
                title="Accession details"
                description="Core intake details and provenance context for this accession."
              >
                <div className="grid gap-5 md:grid-cols-2">
                  <DetailField label="Accession Number" value={accession.accessionNumber} />
                  <DetailField
                    label="Date Received"
                    value={formatDate(new Date(accession.dateReceived), locale)}
                  />
                  <DetailField label="Source" value={accession.source} />
                  <DetailField
                    label="Method"
                    value={<span className="capitalize">{accession.method}</span>}
                  />
                  {accession.cost ? (
                    <DetailField
                      label="Cost"
                      value={formatCurrency(accession.cost, locale, "USD")}
                    />
                  ) : null}
                  {accession.approvedAt ? (
                    <DetailField
                      label="Approved"
                      value={formatDate(new Date(accession.approvedAt), locale)}
                    />
                  ) : null}
                </div>

                {accession.notes ? (
                  <div className="mt-6 border-t border-border/60 pt-6">
                    <DetailField
                      label="Notes"
                      value={
                        <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
                          {accession.notes}
                        </p>
                      }
                    />
                  </div>
                ) : null}
              </SectionCard>

              {accession.status === "pending" && !isDraft ? (
                <SectionCard
                  eyebrow="Actions"
                  title="Approval"
                  description="Review the current workflow step and record approval or rejection."
                >
                  <ApprovalWorkflow key={accessionId} accessionId={accessionId} />
                </SectionCard>
              ) : null}
            </div>

            {accession.workflowHistory && accession.workflowHistory.length > 0 ? (
              <SectionCard
                eyebrow="History"
                title="Workflow history"
                description="Completed approval events for this accession."
              >
                <div className="space-y-3">
                  {accession.workflowHistory.map(
                    (entry: WorkflowHistoryEntry) => (
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
                            {entry.comment ? (
                              <p className="mt-1 text-sm">{entry.comment}</p>
                            ) : null}
                          </div>
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </SectionCard>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
