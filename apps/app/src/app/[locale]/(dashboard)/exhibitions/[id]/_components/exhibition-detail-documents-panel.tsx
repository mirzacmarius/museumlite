"use client";

import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@v1/ui/dialog";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { Download, FileText, Plus, Trash2, Upload } from "lucide-react";
import { ClientDate } from "@/components/client-date";
import { PermissionGate } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";
import type { ExhibitionDetailViewProps } from "./exhibition-detail-view-props";

export function ExhibitionDetailDocumentsPanel({
  locale,
  documents,
  isUploadDialogOpen,
  setIsUploadDialogOpen,
  isUploading,
  uploadDocType,
  setUploadDocType,
  selectedFile,
  setSelectedFile,
  handleFileUpload,
  handleDeleteDocument,
}: Pick<
  ExhibitionDetailViewProps,
  | "locale"
  | "documents"
  | "isUploadDialogOpen"
  | "setIsUploadDialogOpen"
  | "isUploading"
  | "uploadDocType"
  | "setUploadDocType"
  | "selectedFile"
  | "setSelectedFile"
  | "handleFileUpload"
  | "handleDeleteDocument"
>) {
  const t = useScopedI18n("exhibitions");

  return (
    <div className="rounded-xl border border-border bg-muted/20 p-6">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          <FileText className="size-4" />
          {t("detail.documents")}
        </h2>
        <PermissionGate permission="collections.update">
          <Dialog
            open={isUploadDialogOpen}
            onOpenChange={setIsUploadDialogOpen}
          >
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="mr-1 size-3.5" />
                {t("detail.add")}
              </Button>
            </DialogTrigger>
            <DialogContent className="border-border bg-background">
              <DialogHeader>
                <DialogTitle className="text-foreground">
                  {t("actions.uploadDocument")}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  {t("detail.uploadDescription")}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">
                    {t("documentUpload.typeLabel")}
                  </Label>
                  <Select
                    value={uploadDocType}
                    onValueChange={setUploadDocType}
                  >
                    <SelectTrigger className="border-border bg-muted/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="floor_plan">
                        {t("documentUpload.floorPlan")}
                      </SelectItem>
                      <SelectItem value="label">
                        {t("documentUpload.label")}
                      </SelectItem>
                      <SelectItem value="press_release">
                        {t("documentUpload.pressRelease")}
                      </SelectItem>
                      <SelectItem value="checklist">
                        {t("documentUpload.checklist")}
                      </SelectItem>
                      <SelectItem value="other">
                        {t("documentUpload.other")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">
                    {t("detail.file")}
                  </Label>
                  <Input
                    type="file"
                    onChange={(e) =>
                      setSelectedFile(e.target.files?.[0] ?? null)
                    }
                    className="border-border bg-muted/50"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsUploadDialogOpen(false)}
                  className="border-border"
                >
                  {t("actions.cancel")}
                </Button>
                <Button
                  onClick={handleFileUpload}
                  disabled={!selectedFile || isUploading}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Upload className="mr-2 size-4" />
                  {isUploading
                    ? t("actions.uploading")
                    : t("documentUpload.uploadButton")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </PermissionGate>
      </div>

      {documents && documents.length > 0 ? (
        <div className="space-y-3">
          {documents.map((doc) => (
            <div
              key={doc._id}
              className="flex items-center justify-between rounded-lg border border-border bg-background/50 p-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <FileText className="size-4 flex-shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {doc.fileName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {doc.documentType.replace("_", " ")} •{" "}
                    <ClientDate timestamp={doc.uploadedAt} locale={locale} />
                  </p>
                </div>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                {doc.url ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    asChild
                  >
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={doc.fileName}
                    >
                      <Download className="size-4" />
                    </a>
                  </Button>
                ) : null}
                <PermissionGate permission="collections.delete">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-red-400 hover:bg-red-950/50 hover:text-red-300"
                    onClick={() => handleDeleteDocument(doc._id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </PermissionGate>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="py-4 text-center text-sm text-muted-foreground">
          {t("detail.noDocuments")}
        </p>
      )}
    </div>
  );
}
