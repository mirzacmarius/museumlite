import type { Doc, Id } from "@v1/backend/convex/_generated/dataModel";

export interface DeaccessionWorkflowHistoryEntry {
  step: number;
  approvedAt: number;
  approverName?: string;
  comment?: string;
}

export interface DeaccessionDetailViewProps {
  deaccessionId: string;
  locale: string;
  deaccession: Doc<"deaccessions">;
  collection: Doc<"collections"> | null | undefined;
  collectionThumbnailUrl?: string | null;
  actionLabel: string;
  collectionStatusLabel: string | null;
  reviewStateLabel: string;
  workflowHistory: DeaccessionWorkflowHistoryEntry[] | undefined;
  workflowEntryCount: number;
  comment: string;
  setComment: (value: string) => void;
  isApproving: boolean;
  isRejecting: boolean;
  handleApprove: () => Promise<void>;
  handleReject: () => Promise<void>;
  isPrintModalOpen: boolean;
  setIsPrintModalOpen: (open: boolean) => void;
  exportData:
    | {
        organization: { name: string };
        deaccession: {
          deaccessionNumber: string;
          dateDeaccessioned: number;
          reason: string;
          method: string;
          disposition?: string;
          notes?: string;
          status: string;
          proceedsAmount?: number;
          proceedsCurrency?: string;
          proceedsRecipient?: string;
          proceedsDate?: number;
          proceedsNotes?: string;
          approvedAt?: number;
        };
        collection?: {
          title: string;
          accessionNumber?: string;
          description?: string;
          primaryImageUrl?: string;
        } | null;
        workflowHistory: DeaccessionWorkflowHistoryEntry[];
        approverName?: string;
      }
    | null
    | undefined;
}
