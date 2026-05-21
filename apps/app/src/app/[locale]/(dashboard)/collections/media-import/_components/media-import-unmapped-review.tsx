"use client";

import { ObjectCombobox } from "@/components/object-combobox";
import { useOrganization } from "@/components/organization-provider";
import { useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@v1/ui/table";
import { useMutation, useQuery } from "convex/react";
import {
  AlertCircle,
  CheckCircle2,
  FileImage,
  Loader2,
  Trash2,
} from "lucide-react";
import { useState } from "react";

interface MediaImportUnmappedReviewProps {
  jobId: Id<"importJobs">;
  onComplete: () => void;
}

export function MediaImportUnmappedReview({
  jobId,
  onComplete,
}: MediaImportUnmappedReviewProps) {
  const t = useScopedI18n("collections");
  const unmappedFiles = useQuery(api.mediaImports.getUnmappedFiles, { jobId });
  const mapFile = useMutation(api.mediaImports.mapFileToCollection);
  const deleteFile = useMutation(api.mediaImports.deleteUnmappedFile);
  const { currentOrganizationId } = useOrganization();

  const [handledFiles, setHandledFiles] = useState<Set<string>>(new Set());

  if (!unmappedFiles) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const remainingFiles = unmappedFiles.filter(
    (f) => !handledFiles.has(f.storageId),
  );

  if (remainingFiles.length === 0) {
    return (
      <div className="text-center py-12">
        <CheckCircle2 className="mx-auto mb-4 size-12 text-green-500" />
        <h3 className="text-lg font-medium">
          {t("mediaImport.allFilesHandled")}
        </h3>
        <Button onClick={onComplete} className="mt-4">
          {t("mediaImport.backToSummary")}
        </Button>
      </div>
    );
  }

  const handleMap = async (storageId: Id<"_storage">, collectionId: string) => {
    try {
      await mapFile({
        jobId,
        storageId,
        collectionId: collectionId as Id<"collections">,
      });
      setHandledFiles((prev) => new Set(prev).add(storageId));
    } catch (err) {
      console.error("Failed to map file", err);
      alert("Failed to map file");
    }
  };

  const handleDelete = async (storageId: Id<"_storage">) => {
    if (!confirm("Are you sure you want to delete this file?")) return;
    try {
      await deleteFile({ jobId, storageId });
      setHandledFiles((prev) => new Set(prev).add(storageId));
    } catch (err) {
      console.error("Failed to delete file", err);
      alert("Failed to delete file");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">
            {t("mediaImport.reviewTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {remainingFiles.length} files need attention
          </p>
        </div>
        <Button variant="outline" onClick={onComplete}>
          Finish Review
        </Button>
      </div>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>File Name</TableHead>
              <TableHead>Size</TableHead>
              <TableHead className="w-[400px]">Map to Object</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {remainingFiles.map((file) => (
              <TableRow key={file.storageId}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <FileImage className="size-4 text-muted-foreground" />
                    {file.fileName}
                  </div>
                  {file.error && (
                    <div className="text-xs text-destructive mt-1 flex items-center gap-1">
                      <AlertCircle className="size-3" />
                      {file.error}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {(file.fileSize / 1024 / 1024).toFixed(2)} MB
                </TableCell>
                <TableCell>
                  <ObjectCombobox
                    organizationId={currentOrganizationId ?? undefined}
                    placeholder={t("mediaImport.searchObjectPlaceholder")}
                    onValueChange={(val) =>
                      val && handleMap(file.storageId, val)
                    }
                  />
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(file.storageId)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
