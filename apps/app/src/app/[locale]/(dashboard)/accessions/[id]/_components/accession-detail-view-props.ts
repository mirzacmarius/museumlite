import type { api } from "@v1/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import type { ReactNode } from "react";
import type { WorkflowStepInfo } from "./accession-detail-types";

export type AccessionDetailRecord = NonNullable<
  FunctionReturnType<typeof api.accessions.get>
>;

export interface AccessionDetailViewProps {
  accession: AccessionDetailRecord;
  locale: string;
  accessionId: string;
  isDraft: boolean;
  displayStatus: string;
  configuredWorkflowSteps: WorkflowStepInfo[];
  currentWorkflowStep?: WorkflowStepInfo;
  requiresSourceVerification: boolean;
  isSourceVerified: boolean;
  isObjectDraft: boolean;
  canEditObjectDraft: boolean;
  draftEditHref: string;
  accessionTitle: string;
  accessionSubtitle: string;
  workflowSummary: string;
  reviewStateTone: "success" | "warning" | "default";
  heroReviewStateLabel: string;
  heroSourceVerificationState: string;
  reviewRailTitle: string;
  reviewRailDescription: string;
  draftActionError: string | null;
  isSubmittingDraft: boolean;
  isVerifyingSource: boolean;
  getStatusIcon: (status: string) => ReactNode;
  getStatusColor: (status: string) => string;
  handleSubmitDraft: () => void | Promise<void>;
  handleVerifySource: () => void | Promise<void>;
}
