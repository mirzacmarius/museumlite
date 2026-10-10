"use client";

import { Button } from "@v1/ui/button";
import { CheckCircle } from "lucide-react";
import { PermissionGate } from "@/components/permission-gate";
import { useI18n } from "@/locales/client";
import type { WorkflowStepInfo } from "./accession-detail-types";
import { formatWorkflowStepDetails, SectionCard } from "./accession-detail-ui";
import type { AccessionDetailViewProps } from "./accession-detail-view-props";
import { ApprovalWorkflow } from "./approval-workflow";
export function AccessionDetailReviewPanel({
  accession,
  accessionId,
  isDraft,
  configuredWorkflowSteps,
  requiresSourceVerification,
  isSourceVerified,
  isVerifyingSource,
  reviewRailTitle,
  reviewRailDescription,
  handleVerifySource,
}: AccessionDetailViewProps) {
  const tRoot = useI18n();
  if (accession.status !== "pending" || isDraft) {
    return null;
  }

  return (
    <SectionCard
      eyebrow={tRoot("untranslatedRecords.accessions.detail.review")}
      title={reviewRailTitle}
      description={reviewRailDescription}
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="space-y-4">
          {requiresSourceVerification ? (
            <div
              className={`rounded-xl border p-4 ${
                isSourceVerified
                  ? "border-emerald-500/20 bg-emerald-500/5"
                  : "border-yellow-500/20 bg-yellow-500/5"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    {isSourceVerified
                      ? tRoot("untranslatedRecords.accessions.source.verified")
                      : tRoot(
                          "untranslatedRecords.accessions.source.verificationRequired",
                        )}
                  </p>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {isSourceVerified
                      ? accession.sourceVerificationNotes ||
                        tRoot(
                          "untranslatedRecords.accessions.source.blockerCleared",
                        )
                      : tRoot(
                          "untranslatedRecords.accessions.source.verifyBeforeApproval",
                        )}
                  </p>
                </div>
                <PermissionGate permission="collections.update">
                  <Button
                    type="button"
                    variant={isSourceVerified ? "outline" : "default"}
                    size="sm"
                    disabled={isVerifyingSource || isSourceVerified}
                    onClick={() => void handleVerifySource()}
                    className="shrink-0"
                  >
                    <CheckCircle className="mr-2 size-4" />
                    {isSourceVerified
                      ? tRoot(
                          "untranslatedRecords.accessions.source.verifiedShort",
                        )
                      : isVerifyingSource
                        ? tRoot(
                            "untranslatedRecords.accessions.source.verifying",
                          )
                        : tRoot("untranslatedRecords.accessions.source.verify")}
                  </Button>
                </PermissionGate>
              </div>
            </div>
          ) : null}

          {configuredWorkflowSteps.length > 0 ? (
            <div className="rounded-xl border border-border/60 bg-background/40 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                {tRoot("untranslatedRecords.accessions.detail.workflow")}
              </p>
              <div className="mt-3 grid gap-2.5 lg:grid-cols-2">
                {configuredWorkflowSteps.map((step: WorkflowStepInfo) => {
                  const isCurrent = step.stepNumber === accession.workflowStep;
                  const isCompleted =
                    accession.workflowStep !== undefined &&
                    accession.workflowStep > step.stepNumber;

                  return (
                    <div
                      key={step.stepNumber}
                      className="flex items-start justify-between gap-4 rounded-lg border border-border/60 bg-background/60 p-3"
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
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-border/60 bg-background/40 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {tRoot("untranslatedRecords.accessions.detail.decision")}
          </p>
          <div className="mt-3">
            <ApprovalWorkflow
              key={accessionId}
              accessionId={accessionId}
              compact
            />
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
