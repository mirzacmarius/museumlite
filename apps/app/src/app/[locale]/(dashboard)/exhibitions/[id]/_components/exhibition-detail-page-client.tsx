"use client";

import { useOrganization } from "@/components/organization-provider";
import { useClientNow } from "@/hooks/use-client-date-format";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ExhibitionDetailBody } from "./exhibition-detail-body";
import { ExhibitionDetailHeader } from "./exhibition-detail-header";
import {
  calculateDuration,
  getTimeStatus,
  getWorkflowStatusInfo,
} from "./exhibition-detail-helpers";
import type { ExhibitionDetailViewProps } from "./exhibition-detail-view-props";

export function ExhibitionDetailPageClient() {
  const params = useParams();
  const { push } = useRouter();
  const exhibitionId = params.id as string;
  const { currentOrganizationId } = useOrganization();
  const locale = useCurrentLocale();
  const t = useScopedI18n("exhibitions");
  const now = useClientNow();
  const deleteExhibition = useMutation(api.exhibitions.remove);
  const [isDeleting, setIsDeleting] = useState(false);

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
  const deleteDocument = useMutation(api.exhibitions.deleteDocument);

  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadDocType, setUploadDocType] = useState("other");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": selectedFile.type },
        body: selectedFile,
      });
      const { storageId } = await result.json();

      await uploadDocument({
        exhibitionId: exhibitionId as Id<"exhibitions">,
        storageId,
        documentType: uploadDocType as
          | "floor_plan"
          | "label"
          | "press_release"
          | "checklist"
          | "other",
        fileName: selectedFile.name,
      });

      setIsUploadDialogOpen(false);
      setSelectedFile(null);
      setUploadDocType("other");
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDocument = async (
    documentId: Id<"exhibitionDocuments">,
  ) => {
    try {
      await deleteDocument({ documentId });
    } catch (error) {
      console.error("Delete failed:", error);
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

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteExhibition({ id: exhibitionId as Id<"exhibitions"> });
      push("/exhibitions");
    } catch (error) {
      console.error("Failed to delete exhibition:", error);
      setIsDeleting(false);
    }
  };

  const viewProps: ExhibitionDetailViewProps = {
    exhibitionId,
    locale,
    exhibition,
    timeStatus: getTimeStatus(exhibition, now, t),
    workflowInfo: getWorkflowStatusInfo(exhibition, t),
    duration: calculateDuration(exhibition, now, t),
    workflowHistory,
    documents,
    isDeleting,
    handleDelete,
    isUploadDialogOpen,
    setIsUploadDialogOpen,
    isUploading,
    uploadDocType,
    setUploadDocType,
    selectedFile,
    setSelectedFile,
    handleFileUpload,
    handleDeleteDocument,
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background">
      <ExhibitionDetailHeader {...viewProps} />
      <ExhibitionDetailBody {...viewProps} />
    </div>
  );
}
