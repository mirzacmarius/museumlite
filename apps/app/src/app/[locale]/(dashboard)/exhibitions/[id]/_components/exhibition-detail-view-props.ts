import type { Id } from "@v1/backend/convex/_generated/dataModel";
import type {
  ExhibitionDetail,
  ExhibitionDocumentRecord,
  ExhibitionDurationInfo,
  ExhibitionTimeStatus,
  ExhibitionWorkflowHistoryEntry,
  ExhibitionWorkflowStatusInfo,
} from "./exhibition-detail-types";

export interface ExhibitionDetailViewProps {
  exhibitionId: string;
  locale: string;
  exhibition: ExhibitionDetail;
  timeStatus: ExhibitionTimeStatus;
  workflowInfo: ExhibitionWorkflowStatusInfo;
  duration: ExhibitionDurationInfo;
  workflowHistory: ExhibitionWorkflowHistoryEntry[] | undefined;
  documents: ExhibitionDocumentRecord[] | undefined;
  isDeleting: boolean;
  handleDelete: () => Promise<void>;
  isUploadDialogOpen: boolean;
  setIsUploadDialogOpen: (open: boolean) => void;
  isUploading: boolean;
  uploadDocType: string;
  setUploadDocType: (value: string) => void;
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  handleFileUpload: () => Promise<void>;
  handleDeleteDocument: (
    documentId: Id<"exhibitionDocuments">,
  ) => Promise<void>;
}
