"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { useParams } from "next/navigation";
import { useReducer } from "react";
import { useOrganization } from "@/components/organization-provider";
import { useClientNow } from "@/hooks/use-client-date-format";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { ExhibitionDetailBody } from "./exhibition-detail-body";
import { ExhibitionDetailHeader } from "./exhibition-detail-header";
import {
  calculateDuration,
  getTimeStatus,
  getWorkflowStatusInfo,
} from "./exhibition-detail-helpers";
import type { ExhibitionDetailViewProps } from "./exhibition-detail-view-props";

interface ExhibitionDetailPageState {
  isUploadDialogOpen: boolean;
  isUploading: boolean;
  uploadDocType: string;
  selectedFile: File | null;
}

type ExhibitionDetailPageAction =
  | { type: "setUploadDialogOpen"; value: boolean }
  | { type: "setUploading"; value: boolean }
  | { type: "setUploadDocType"; value: string }
  | { type: "setSelectedFile"; value: File | null }
  | { type: "closeUploadDialog" };

const initialExhibitionDetailPageState: ExhibitionDetailPageState = {
  isUploadDialogOpen: false,
  isUploading: false,
  uploadDocType: "other",
  selectedFile: null,
};

function exhibitionDetailPageReducer(
  state: ExhibitionDetailPageState,
  action: ExhibitionDetailPageAction,
): ExhibitionDetailPageState {
  switch (action.type) {
    case "setUploadDialogOpen":
      return { ...state, isUploadDialogOpen: action.value };
    case "setUploading":
      return { ...state, isUploading: action.value };
    case "setUploadDocType":
      return { ...state, uploadDocType: action.value };
    case "setSelectedFile":
      return { ...state, selectedFile: action.value };
    case "closeUploadDialog":
      return {
        ...state,
        isUploadDialogOpen: false,
        selectedFile: null,
        uploadDocType: "other",
      };
  }
}

export function ExhibitionDetailPageClient() {
  const params = useParams();

  const exhibitionId = params.id as string;
  const { currentOrganizationId } = useOrganization();
  const locale = useCurrentLocale();
  const t = useScopedI18n("exhibitions");
  const now = useClientNow();

  const [state, dispatch] = useReducer(
    exhibitionDetailPageReducer,
    initialExhibitionDetailPageState,
  );

  const exhibition = useQuery(api.exhibitions.get, {
    id: exhibitionId as Id<"exhibitions">,
  });

  const workflowHistory = useQuery(
    api.exhibitions.getWorkflowHistory,
    exhibition?.status === "proposed" || exhibition?.workflowStep
      ? { exhibitionId: exhibitionId as Id<"exhibitions"> }
      : "skip",
  );

  const documents = useQuery(api.exhibitions.listDocuments, {
    exhibitionId: exhibitionId as Id<"exhibitions">,
  });

  const generateUploadUrl = useMutation(api.exhibitions.generateUploadUrl);
  const uploadDocument = useMutation(api.exhibitions.uploadDocument);

  const handleFileUpload = async () => {
    if (!state.selectedFile) return;

    dispatch({ type: "setUploading", value: true });
    try {
      const uploadUrl = await generateUploadUrl({
        exhibitionId: exhibitionId as Id<"exhibitions">,
      });
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": state.selectedFile.type },
        body: state.selectedFile,
      });
      if (!result.ok) throw new Error(await result.text());
      const { storageId } = await result.json();

      await uploadDocument({
        exhibitionId: exhibitionId as Id<"exhibitions">,
        storageId,
        documentType: state.uploadDocType as
          | "floor_plan"
          | "label"
          | "press_release"
          | "checklist"
          | "other",
        fileName: state.selectedFile.name,
      });

      dispatch({ type: "closeUploadDialog" });
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      dispatch({ type: "setUploading", value: false });
    }
  };

  if (!currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center bg-background">
        <p className="text-muted-foreground">{t("selectOrganization")}</p>
      </div>
    );
  }

  if (exhibition === undefined) {
    return (
      <div className="flex size-full items-center justify-center bg-background">
        <p className="text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  if (exhibition === null) {
    return (
      <div className="flex size-full items-center justify-center bg-background">
        <p className="text-muted-foreground">{t("exhibitionNotFound")}</p>
      </div>
    );
  }

  const viewProps: ExhibitionDetailViewProps = {
    exhibitionId,
    locale,
    exhibition,
    timeStatus: getTimeStatus(exhibition, now, t),
    workflowInfo: getWorkflowStatusInfo(exhibition, t),
    duration: calculateDuration(exhibition, now, t),
    workflowHistory,
    documents,
    isUploadDialogOpen: state.isUploadDialogOpen,
    setIsUploadDialogOpen: (value) =>
      dispatch({ type: "setUploadDialogOpen", value }),
    isUploading: state.isUploading,
    uploadDocType: state.uploadDocType,
    setUploadDocType: (value) => dispatch({ type: "setUploadDocType", value }),
    selectedFile: state.selectedFile,
    setSelectedFile: (value) => dispatch({ type: "setSelectedFile", value }),
    handleFileUpload,
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background">
      <ExhibitionDetailHeader {...viewProps} />
      <ExhibitionDetailBody {...viewProps} />
    </div>
  );
}
