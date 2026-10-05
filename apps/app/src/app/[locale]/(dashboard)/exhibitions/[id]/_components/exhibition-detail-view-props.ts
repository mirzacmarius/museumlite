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
  isUploadDialogOpen: boolean;
  setIsUploadDialogOpen: (open: boolean) => void;
  isUploading: boolean;
  uploadDocType: string;
  setUploadDocType: (value: string) => void;
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  handleFileUpload: () => Promise<void>;
}
