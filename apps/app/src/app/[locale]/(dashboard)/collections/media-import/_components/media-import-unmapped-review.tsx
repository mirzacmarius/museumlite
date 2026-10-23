"use client";

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
import { AlertCircle, CheckCircle2, FileImage, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ObjectCombobox } from "@/components/object-combobox";
import { useOrganization } from "@/components/organization-provider";
import { useActionErrorMessage } from "@/hooks/use-action-error-message";
import { useScopedI18n } from "@/locales/client";

interface MediaImportUnmappedReviewProps {
  jobId: Id<"importJobs">;
  onComplete: () => void;
}

export function MediaImportUnmappedReview({
  jobId,
  onComplete,
}: MediaImportUnmappedReviewProps) {
  const t = useScopedI18n("collections");
  const actionMessage = useActionErrorMessage();
  const unmappedFiles = useQuery(api.mediaImports.getUnmappedFiles, { jobId });
  const mapFile = useMutation(api.mediaImports.mapFileToCollection);

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
      toast.error(actionMessage(err, t("mediaImport.errorMapFailed")));
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
            {t("mediaImport.filesNeedAttention", {
              count: remainingFiles.length,
            })}
          </p>
        </div>
        <Button variant="outline" onClick={onComplete}>
          {t("mediaImport.finishReview")}
        </Button>
      </div>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("mediaImport.tableHeaders.fileName")}</TableHead>
              <TableHead>{t("mediaImport.tableHeaders.size")}</TableHead>
              <TableHead className="w-[400px]">
                {t("mediaImport.tableHeaders.mapToObject")}
              </TableHead>
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
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
