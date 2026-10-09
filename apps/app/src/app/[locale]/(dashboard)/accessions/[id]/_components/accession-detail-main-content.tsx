"use client";

import { Button } from "@v1/ui/button";
import { CheckCircle, Edit, ExternalLink } from "lucide-react";
import Link from "next/link";
import { AuditCaseHistory } from "@/components/audit-case-history";
import { CaseTaskPanel } from "@/components/case-tasks/case-task-panel";
import { PermissionGate } from "@/components/permission-gate";
import { useI18n } from "@/locales/client";
import { AccessionDetailReviewPanel } from "./accession-detail-review-panel";
import type { WorkflowStepInfo } from "./accession-detail-types";
import {
  DetailField,
  formatWorkflowStepDetails,
  SectionCard,
} from "./accession-detail-ui";
import type { AccessionDetailViewProps } from "./accession-detail-view-props";
export function AccessionDetailMainContent(props: AccessionDetailViewProps) {
  const tRoot = useI18n();
  const {
    accession,
    isDraft,
    configuredWorkflowSteps,
    workflowSummary,
    canEditObjectDraft,
    draftEditHref,
    draftActionError,
    isSubmittingDraft,
    handleSubmitDraft,
  } = props;

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      {draftActionError ? (
        <div className="mb-6 rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {draftActionError}
        </div>
      ) : null}

      <div className="space-y-6">
        <AccessionDetailReviewPanel {...props} />

        {configuredWorkflowSteps.length > 0 &&
        !(accession.status === "pending" && !isDraft) ? (
          <SectionCard
            eyebrow="Workflow"
            title={tRoot(
              "untranslatedRecords.accessions.detail.approvalWorkflow",
            )}
            description={workflowSummary}
          >
            <div className="grid gap-2.5 lg:grid-cols-2">
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
                      <p className="text-xs leading-5 text-muted-foreground">
                        {formatWorkflowStepDetails(step, tRoot)}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                        isCurrent
                          ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                          : isCompleted
                            ? "bg-green-500/10 text-green-600 dark:text-green-400"
                            : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {isCurrent
                        ? tRoot(
                            "untranslatedRecords.accessions.workflow.current",
                          )
                        : isCompleted
                          ? tRoot(
                              "untranslatedRecords.accessions.workflow.done",
                            )
                          : tRoot(
                              "untranslatedRecords.accessions.workflow.step",
                              { step: step.stepNumber },
                            )}
                    </span>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        ) : null}

        {accession.collectionId ? (
          <SectionCard
            eyebrow={tRoot("untranslatedRecords.objects.attributes.collection")}
            title={tRoot("untranslatedRecords.accessions.detail.linkedObject")}
            description={tRoot(
              "untranslatedRecords.accessions.detail.linkedObjectDescription",
            )}
          >
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-between sm:w-auto"
              asChild
            >
              <Link href={`/collections/${accession.collectionId}`}>
                {tRoot(
                  "untranslatedRecords.accessions.detail.openCreatedObject",
                )}
                <ExternalLink className="size-4" />
              </Link>
            </Button>
          </SectionCard>
        ) : null}

        <div className="space-y-6">
          {accession.draftObjectData ? (
            <SectionCard
              eyebrow={tRoot(
                "untranslatedRecords.accessions.detail.proposedObject",
              )}
              title={accession.draftObjectData.title}
              description={
                accession.draftObjectData.creator ||
                tRoot("untranslatedRecords.accessions.detail.unknownCreator")
              }
            >
              <div className="grid gap-4 md:grid-cols-3">
                <DetailField
                  label={tRoot("objects.filters.objectType")}
                  value={
                    accession.draftObjectData.objectName ||
                    accession.draftObjectData.objectType?.join(", ") ||
                    tRoot("untranslatedRecords.accessions.detail.notSet")
                  }
                />
                <DetailField
                  label={tRoot("objects.form.dateCreated")}
                  value={
                    accession.draftObjectData.dateCreated ||
                    tRoot("untranslatedRecords.accessions.detail.unknown")
                  }
                />
                <DetailField
                  label={tRoot("objects.form.collectionGroup")}
                  value={
                    accession.draftObjectData.collectionType ||
                    tRoot("untranslatedRecords.objects.enums.generalCollection")
                  }
                />
              </div>

              {accession.draftObjectData.description ? (
                <div className="mt-5">
                  <DetailField
                    label={tRoot("library.catalog.detail.description")}
                    value={
                      <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
                        {accession.draftObjectData.description}
                      </p>
                    }
                  />
                </div>
              ) : null}

              {canEditObjectDraft ? (
                <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border/60 pt-5">
                  <PermissionGate permission="collections.update">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={draftEditHref}>
                        <Edit className="mr-2 size-4" />
                        {isDraft
                          ? tRoot(
                              "untranslatedRecords.accessions.detail.editDraft",
                            )
                          : tRoot("untranslatedRecords.objects.actions.edit")}
                      </Link>
                    </Button>
                  </PermissionGate>
                  {isDraft ? (
                    <>
                      <PermissionGate permission="collections.update">
                        <Button
                          size="sm"
                          onClick={() => void handleSubmitDraft()}
                          disabled={isSubmittingDraft}
                        >
                          <CheckCircle className="mr-2 size-4" />
                          {isSubmittingDraft
                            ? tRoot(
                                "untranslatedRecords.accessions.detail.submitting",
                              )
                            : tRoot(
                                "untranslatedRecords.accessions.detail.submitForApproval",
                              )}
                        </Button>
                      </PermissionGate>
                      <p className="text-sm text-muted-foreground">
                        {tRoot(
                          "untranslatedRecords.accessions.detail.draftsMustBeSubmitted",
                        )}
                      </p>
                    </>
                  ) : null}
                </div>
              ) : null}
            </SectionCard>
          ) : null}

          <CaseTaskPanel
            organizationId={accession.organizationId}
            caseType="accession"
            caseId={accession._id}
          />

          <AuditCaseHistory
            organizationId={accession.organizationId}
            caseId={`accession:${accession._id}`}
          />
        </div>
      </div>
    </div>
  );
}
