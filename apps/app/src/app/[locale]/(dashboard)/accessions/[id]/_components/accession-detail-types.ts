import type { Id } from "@v1/backend/convex/_generated/dataModel";

export interface WorkflowStepInfo {
  stepNumber: number;
  name: string;
  roleName?: string;
  approvalMode?: "single" | "multi" | "unanimous";
  requiredApprovals?: number;
}

export interface WorkflowHistoryEntry {
  step: number;
  approvedBy: Id<"users">;
  approvedAt: number;
  comment?: string;
}
