export type RemovalType = "sold" | "archived" | "move";
export type AccessionMode = "keep" | "auto" | "manual";

export interface DeaccessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collectionId: import("@v1/backend/convex/_generated/dataModel").Id<"collections">;
  collectionTitle: string;
  organizationId: import("@v1/backend/convex/_generated/dataModel").Id<"organizations">;
  initialRemovalType?: RemovalType | null;
}

export interface DeaccessionWorkflowConfig {
  workflowType: string;
  steps: unknown[];
}
