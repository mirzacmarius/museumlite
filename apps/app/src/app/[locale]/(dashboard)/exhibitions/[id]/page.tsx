"use client";

import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { formatDate } from "@/lib/format-date";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
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
import { useMutation, useQuery } from "convex/react";
import {
  AlertCircle,
  ArrowLeft,
  Box,
  Calendar,
  CheckCircle2,
  CircleDot,
  Clock,
  Download,
  FileText,
  GalleryVerticalEnd,
  Info,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  Upload,
  User,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

export default function ExhibitionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const exhibitionId = params.id as string;
  const { currentOrganizationId } = useOrganization();
  const locale = useCurrentLocale();
  const t = useScopedI18n("exhibitions");
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
  const [uploadDocType, setUploadDocType] = useState<string>("other");
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
      router.push("/exhibitions");
    } catch (error) {
      console.error("Failed to delete exhibition:", error);
      setIsDeleting(false);
    }
  };

  const isPast = exhibition.endDate && exhibition.endDate < Date.now();
  const isUpcoming = exhibition.startDate > Date.now();

  let timeStatusColor =
    "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  let timeStatusText = t("status.current");

  if (isPast) {
    timeStatusColor = "bg-muted text-muted-foreground border-border";
    timeStatusText = t("status.past");
  } else if (isUpcoming) {
    timeStatusColor = "bg-blue-500/10 text-blue-400 border-blue-500/20";
    timeStatusText = t("status.upcoming");
  }

  const getWorkflowStatusInfo = () => {
    const status = exhibition.status ?? "active";
    switch (status) {
      case "proposed":
        return {
          color: "bg-amber-500/10 text-amber-400 border-amber-500/20",
          icon: CircleDot,
          text: t("status.pendingApproval"),
        };
      case "approved":
        return {
          color: "bg-blue-500/10 text-blue-400 border-blue-500/20",
          icon: CheckCircle2,
          text: t("status.approved"),
        };
      case "active":
        return {
          color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
          icon: CheckCircle2,
          text: t("status.active"),
        };
      case "closed":
        return {
          color: "bg-muted text-muted-foreground border-border",
          icon: CheckCircle2,
          text: t("status.closed"),
        };
      case "rejected":
        return {
          color: "bg-red-500/10 text-red-400 border-red-500/20",
          icon: XCircle,
          text: t("status.rejected"),
        };
      default:
        return {
          color: "bg-muted text-muted-foreground border-border",
          icon: CircleDot,
          text: status,
        };
    }
  };

  const workflowInfo = getWorkflowStatusInfo();
  const WorkflowIcon = workflowInfo.icon;

  const calculateDuration = () => {
    const now = Date.now();
    const start = exhibition.startDate;
    const end = exhibition.endDate;

    if (isUpcoming) {
      const daysUntilStart = Math.ceil((start - now) / (1000 * 60 * 60 * 24));
      return {
        label: t("detail.startsIn"),
        value: `${daysUntilStart} ${t("detail.days")}`,
      };
    }
    if (isPast && end) {
      const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      return {
        label: t("detail.duration"),
        value: `${totalDays} ${t("detail.days")}`,
      };
    }
    const daysActive = Math.ceil((now - start) / (1000 * 60 * 60 * 24));
    return {
      label: t("detail.activeFor"),
      value: `${daysActive} ${t("detail.days")}`,
    };
  };

  const duration = calculateDuration();

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background">
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-xl">
        <div className="flex items-center gap-2 text-xs">
          <Button variant="ghost" size="icon" className="size-7" asChild>
            <Link href="/exhibitions">
              <ArrowLeft className="size-4 text-muted-foreground" />
            </Link>
          </Button>
          <span className="text-muted-foreground">{t("title")}</span>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium text-foreground truncate max-w-[200px]">
            {exhibition.title}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <PermissionGate permission="collections.update">
            <Button
              variant="outline"
              size="sm"
              asChild
              className="border-border text-foreground/80 hover:bg-muted hover:text-white"
            >
              <Link href={`/exhibitions/${exhibitionId}/edit`}>
                <Pencil className="mr-2 size-3.5" />
                {t("actions.edit")}
              </Link>
            </Button>
          </PermissionGate>

          <PermissionGate permission="collections.delete">
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-900/30 text-red-400 hover:bg-red-950/50 hover:text-red-300 hover:border-red-900/50"
                >
                  <Trash2 className="mr-2 size-3.5" />
                  {t("actions.delete")}
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-background border-border sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle className="text-foreground">
                    {t("actions.delete")}
                  </DialogTitle>
                  <DialogDescription className="text-muted-foreground">
                    {t("actions.deleteConfirm")}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    className="border-border text-foreground/80 hover:bg-muted"
                    disabled={isDeleting}
                  >
                    {t("actions.cancel")}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="bg-red-900 text-red-100 hover:bg-red-800"
                  >
                    {isDeleting ? t("actions.deleting") : t("actions.delete")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </PermissionGate>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-6 py-8 pb-20">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${timeStatusColor}`}
                >
                  {timeStatusText}
                </span>
                {exhibition.status && exhibition.status !== "active" && (
                  <span
                    className={`flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${workflowInfo.color}`}
                  >
                    <WorkflowIcon className="size-3" />
                    {workflowInfo.text}
                  </span>
                )}
                {exhibition.isLoan && (
                  <span className="text-[10px] font-medium text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                    {t("status.loan")}
                  </span>
                )}
              </div>
              <h1 className="text-3xl font-bold text-foreground">
                {exhibition.title}
              </h1>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="size-4" />
                <span className="text-xs font-medium uppercase tracking-wider">
                  {duration.label}
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold text-foreground">
                {duration.value}
              </p>
            </div>

            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <AlertCircle className="size-4" />
                <span className="text-xs font-medium uppercase tracking-wider">
                  {t("detail.status")}
                </span>
              </div>
              <p className="mt-2 text-lg font-semibold text-foreground capitalize">
                {exhibition.status ?? t("status.active")}
              </p>
              {exhibition.workflowStep && exhibition.totalWorkflowSteps && (
                <p className="text-xs text-muted-foreground">
                  {t("detail.step", {
                    step: exhibition.workflowStep.toString(),
                    total: exhibition.totalWorkflowSteps.toString(),
                  })}
                </p>
              )}
            </div>

            {exhibition.creatorName && (
              <div className="rounded-lg border border-border bg-muted/20 p-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="size-4" />
                  <span className="text-xs font-medium uppercase tracking-wider">
                    {t("detail.createdBy")}
                  </span>
                </div>
                <p className="mt-2 text-sm font-medium text-foreground truncate">
                  {exhibition.creatorName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(new Date(exhibition._creationTime), locale)}
                </p>
              </div>
            )}

            {exhibition.approverName && exhibition.approvedAt && (
              <div className="rounded-lg border border-border bg-muted/20 p-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="size-4" />
                  <span className="text-xs font-medium uppercase tracking-wider">
                    {t("detail.approvedBy")}
                  </span>
                </div>
                <p className="mt-2 text-sm font-medium text-foreground truncate">
                  {exhibition.approverName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(new Date(exhibition.approvedAt), locale)}
                </p>
              </div>
            )}
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="md:col-span-2 space-y-6">
              <div className="rounded-xl border border-border bg-muted/20 p-6">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
                  <GalleryVerticalEnd className="size-4" />
                  {t("detail.overview")}
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
                  <div>
                    <label className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide">
                      {t("detail.location")}
                    </label>
                    <p className="text-sm text-foreground mt-1 flex items-center gap-2">
                      <MapPin className="size-3.5 text-muted-foreground" />
                      {exhibition.location || "—"}
                    </p>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide">
                      {t("detail.dateRange")}
                    </label>
                    <p className="text-sm text-foreground mt-1 flex items-center gap-2">
                      <Calendar className="size-3.5 text-muted-foreground" />
                      {formatDate(new Date(exhibition.startDate), locale)}
                      {exhibition.endDate
                        ? ` — ${formatDate(new Date(exhibition.endDate), locale)}`
                        : ` ${t("card.ongoing")}`}
                    </p>
                  </div>

                  {exhibition.isLoan && (
                    <div className="md:col-span-2">
                      <label className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide">
                        {t("detail.loanVenue")}
                      </label>
                      <p className="text-sm text-foreground mt-1">
                        {exhibition.loanVenue || "—"}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-muted/20 p-6">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
                  <Info className="size-4" />
                  {t("detail.notes")}
                </h2>
                <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                  {exhibition.notes || t("detail.noNotes")}
                </p>
              </div>

              <div className="rounded-xl border border-border bg-muted/20 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
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
                      <DialogContent className="bg-background border-border">
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
                              <SelectTrigger className="bg-muted/50 border-border">
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
                              className="bg-muted/50 border-border"
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
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText className="size-4 text-muted-foreground flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {doc.fileName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {doc.documentType.replace("_", " ")} •{" "}
                              {formatDate(new Date(doc.uploadedAt), locale)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {doc.url && (
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
                          )}
                          <PermissionGate permission="collections.delete">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-red-400 hover:text-red-300 hover:bg-red-950/50"
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
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {t("detail.noDocuments")}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-xl border border-border bg-muted/20 p-6">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
                  <Box className="size-4" />
                  {t("detail.relatedObject")}
                </h2>

                {exhibition.collectionId && (
                  <div className="group relative rounded-lg border border-border bg-background/50 p-4 transition-all hover:border-border hover:bg-muted/50">
                    <Link
                      href={`/collections/${exhibition.collectionId}`}
                      className="absolute inset-0 z-10"
                    />
                    <h3 className="font-medium text-foreground group-hover:text-white truncate">
                      {exhibition.collectionTitle || t("detail.unknownObject")}
                    </h3>
                    <div className="mt-2 flex items-center text-xs text-muted-foreground group-hover:text-muted-foreground">
                      {t("detail.viewObjectDetails")}{" "}
                      <ArrowLeft className="ml-1 size-3 rotate-180" />
                    </div>
                  </div>
                )}
              </div>

              {workflowHistory && workflowHistory.length > 0 && (
                <div className="rounded-xl border border-border bg-muted/20 p-6">
                  <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
                    <Clock className="size-4" />
                    {t("detail.approvalHistory")}
                  </h2>

                  <div className="space-y-4">
                    {workflowHistory.map((item, index) => (
                      <div
                        key={`${item.step}-${item.approvedAt}`}
                        className="relative pl-4 border-l-2 border-border"
                      >
                        <div className="absolute -left-1.5 top-0.5 size-2.5 rounded-full bg-primary" />
                        <div className="text-sm">
                          <p className="font-medium text-foreground">
                            {item.step === 0
                              ? t("detail.created")
                              : item.comment?.startsWith("Rejected")
                                ? t("status.rejected")
                                : t("detail.stepApproved", {
                                    step: item.step.toString(),
                                  })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.approverName ?? t("detail.unknownUser")} •{" "}
                            {formatDate(new Date(item.approvedAt), locale)}
                          </p>
                          {item.comment &&
                            !item.comment.startsWith("Rejected") && (
                              <p className="mt-1 text-xs text-muted-foreground italic">
                                "{item.comment}"
                              </p>
                            )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
