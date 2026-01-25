"use client";

import { useOrganization } from "@/components/organization-provider";
import { formatDistanceLocale } from "@/lib/format-date";
import { useCurrentLocale, useI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { EmptyState } from "@v1/ui/empty-state";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { ScrollArea } from "@v1/ui/scroll-area";
import { Textarea } from "@v1/ui/textarea";
import { useMutation, useQuery } from "convex/react";
import {
  Box,
  Building2,
  Download,
  Eye,
  File,
  FileText,
  Image,
  Loader2,
  Plus,
  Search,
  Star,
  Upload,
  Video,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

function getFileExtension(fileName: string): string {
  const ext = fileName.split(".").pop()?.toUpperCase();
  return ext || "FILE";
}

export default function MediaPage() {
  const t = useI18n();
  const { currentOrganizationId, organizations, isLoading } = useOrganization();

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (!organizations || organizations.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-8">
          <Building2 className="h-12 w-12 text-zinc-500" />
          <div className="text-center">
            <h3 className="text-lg font-semibold text-zinc-200">
              {t("mediaPage.noOrg.title")}
            </h3>
            <p className="mt-2 text-sm text-zinc-500">
              {t("mediaPage.noOrg.description")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-8">
          <Image className="h-12 w-12 text-zinc-500" />
          <div className="text-center">
            <h3 className="text-lg font-semibold text-zinc-200">
              {t("mediaPage.selectOrg.title")}
            </h3>
            <p className="mt-2 text-sm text-zinc-500">
              {t("mediaPage.selectOrg.description")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col">
      <MediaBrowser organizationId={currentOrganizationId} />
    </div>
  );
}

function MediaBrowser({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const t = useI18n();
  const [fileType, setFileType] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);
  const prevFiltersRef = useRef({ fileType, search });

  useEffect(() => {
    setCursor(null);
    prevFiltersRef.current = { fileType, search };
  }, [organizationId, fileType, search]);

  const stats = useQuery(api.media.getStorageStats, { organizationId });

  const media = useQuery(api.media.listByOrganization, {
    organizationId,
    fileType: fileType !== "all" ? fileType : undefined,
    search: search || undefined,
    paginationOpts: { numItems: 48, cursor },
  });

  const getFileIcon = (type: string) => {
    switch (type) {
      case "image":
        return <Image className="h-3 w-3" />;
      case "document":
        return <FileText className="h-3 w-3" />;
      case "video":
        return <Video className="h-3 w-3" />;
      case "3d":
        return <Box className="h-3 w-3" />;
      default:
        return <File className="h-3 w-3" />;
    }
  };

  const getFileIconColor = (type: string) => {
    switch (type) {
      case "image":
        return "bg-indigo-500/10 text-indigo-400";
      case "document":
        return "bg-blue-500/10 text-blue-400";
      case "video":
        return "bg-purple-500/10 text-purple-400";
      case "3d":
        return "bg-emerald-500/10 text-emerald-400";
      default:
        return "bg-zinc-500/10 text-zinc-400";
    }
  };

  const tabs = [
    { id: "all", label: "All Assets" },
    { id: "image", label: "Images" },
    { id: "document", label: "Documents" },
    { id: "3d", label: "3D Models" },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-4 border-b border-zinc-800/60 bg-zinc-900/20 px-6 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-200">
            Digital Assets
          </h2>
          <div className="flex items-center gap-3">
            {stats && (
              <div className="mr-4 flex items-center gap-2 text-xs text-zinc-500">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>{formatFileSize(stats.totalSize)} Used</span>
                <span className="text-zinc-700">/</span>
                <span>2TB Total</span>
              </div>
            )}
            <button
              type="button"
              className="flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-500"
            >
              <Upload className="h-3.5 w-3.5" />
              Upload Files
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFileType(tab.id)}
                className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                  fileType === tab.id
                    ? "bg-zinc-200 font-semibold text-zinc-900"
                    : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Search files..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-48 rounded-full border border-zinc-800 bg-zinc-900 py-1 pl-8 pr-4 text-xs text-zinc-300 transition-all focus:border-zinc-700 focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {media === undefined && (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
          </div>
        )}

        {media && media.page.length === 0 && (
          <EmptyState
            icon={Image}
            title={t("mediaPage.empty")}
            description="Upload images, videos, and documents to your media library"
            size="md"
          />
        )}

        {media && media.page.length > 0 && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            <div className="group flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-800 transition-all hover:border-zinc-600 hover:bg-zinc-900/40">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-500 transition-all group-hover:scale-110 group-hover:border-indigo-500/30 group-hover:text-indigo-400">
                <Plus className="h-5 w-5" />
              </div>
              <span className="text-xs font-medium text-zinc-500">
                New Upload
              </span>
            </div>

            {media.page.map((item) => (
              <div
                key={item._id}
                onClick={() => setSelectedMedia(item._id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    setSelectedMedia(item._id);
                  }
                }}
                role="button"
                tabIndex={0}
                className="group relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 transition-all duration-300 hover:border-zinc-600 hover:shadow-xl"
              >
                <div className="relative aspect-square overflow-hidden bg-zinc-950">
                  {item.fileType === "image" && item.url ? (
                    <img
                      src={item.thumbnailUrl || item.url}
                      alt={item.fileName}
                      className="h-full w-full object-cover opacity-80 transition-all duration-500 group-hover:scale-105 group-hover:opacity-100"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <File className="h-12 w-12 text-zinc-700 transition-colors group-hover:text-zinc-500" />
                    </div>
                  )}

                  <div className="absolute inset-0 flex items-end justify-between bg-gradient-to-t from-black/80 via-transparent to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="rounded bg-white/10 p-1.5 text-white backdrop-blur transition-colors hover:bg-white/20"
                        title="View"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="rounded bg-white/10 p-1.5 text-white backdrop-blur transition-colors hover:bg-white/20"
                        title="Download"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {item.isPrimary && (
                    <div className="absolute left-2 top-2 rounded bg-amber-500/90 p-1">
                      <Star className="h-3 w-3 text-white" />
                    </div>
                  )}
                </div>

                <div className="bg-zinc-900 p-2.5">
                  <div className="mb-1 flex items-center gap-2">
                    <div
                      className={`rounded p-1 ${getFileIconColor(item.fileType)}`}
                    >
                      {getFileIcon(item.fileType)}
                    </div>
                    <p className="truncate text-xs font-medium text-zinc-200">
                      {item.fileName}
                    </p>
                  </div>
                  <div className="flex justify-between text-[10px] text-zinc-500">
                    <span>{formatFileSize(item.fileSize)}</span>
                    <span>{getFileExtension(item.fileName)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {media && !media.isDone && (
        <div className="flex items-center justify-between border-t border-zinc-800/60 bg-zinc-950 px-6 py-3 text-xs text-zinc-500">
          <div>
            Showing <span className="text-zinc-300">{media.page.length}</span>{" "}
            files
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled
              className="rounded border border-zinc-800 bg-zinc-900 px-3 py-1 transition-colors hover:bg-zinc-800 hover:text-zinc-300 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setCursor(media.continueCursor)}
              className="rounded border border-zinc-800 bg-zinc-900 px-3 py-1 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {selectedMedia && (
        <MediaDetailModal
          mediaId={selectedMedia as Id<"mediaFiles">}
          onClose={() => setSelectedMedia(null)}
        />
      )}
    </div>
  );
}

function MediaDetailModal({
  mediaId,
  onClose,
}: {
  mediaId: Id<"mediaFiles">;
  onClose: () => void;
}) {
  const t = useI18n();
  const locale = useCurrentLocale();
  const [isEditing, setIsEditing] = useState(false);
  const [caption, setCaption] = useState("");
  const [photographer, setPhotographer] = useState("");
  const [copyright, setCopyright] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const media = useQuery(api.media.listByOrganization, "skip");
  const updateMedia = useMutation(api.media.update);
  const setPrimary = useMutation(api.media.setPrimary);
  const deleteMedia = useMutation(api.media.deleteMedia);

  const item = media?.page.find((m) => m._id === mediaId);

  useEffect(() => {
    if (item) {
      setCaption(item.caption || "");
      setPhotographer(item.photographer || "");
      setCopyright(item.copyright || "");
    }
  }, [item]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateMedia({
        mediaId,
        caption: caption || undefined,
        photographer: photographer || undefined,
        copyright: copyright || undefined,
      });
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetPrimary = async () => {
    await setPrimary({ mediaId });
  };

  const handleDelete = async () => {
    if (confirm(t("mediaPage.deleteConfirm"))) {
      await deleteMedia({ mediaId });
      onClose();
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl border-zinc-800 bg-zinc-900">
        <DialogHeader>
          <DialogTitle className="text-zinc-200">
            {t("mediaPage.details.title")}
          </DialogTitle>
        </DialogHeader>

        {!item ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="aspect-square overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
              {item.fileType === "image" && item.url ? (
                <img
                  src={item.url}
                  alt={item.fileName}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <File className="h-16 w-16 text-zinc-700" />
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-zinc-200">
                  {item.fileName}
                </p>
                <p className="text-xs text-zinc-500">
                  {formatFileSize(item.fileSize)} &bull;{" "}
                  {formatDistanceLocale(new Date(item.uploadedAt), locale, {
                    addSuffix: true,
                  })}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-zinc-500">
                  {t("mediaPage.details.object")}
                </p>
                <Link
                  href={`/objects/${item.collectionId}`}
                  className="text-sm text-indigo-400 hover:underline"
                >
                  {item.collectionTitle}
                </Link>
                {item.accessionNumber && (
                  <p className="text-xs text-zinc-500">
                    {item.accessionNumber}
                  </p>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="caption" className="text-xs text-zinc-400">
                      {t("mediaPage.details.caption")}
                    </Label>
                    <Textarea
                      id="caption"
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      rows={2}
                      className="border-zinc-800 bg-zinc-950 text-sm text-zinc-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label
                      htmlFor="photographer"
                      className="text-xs text-zinc-400"
                    >
                      {t("mediaPage.details.photographer")}
                    </Label>
                    <Input
                      id="photographer"
                      value={photographer}
                      onChange={(e) => setPhotographer(e.target.value)}
                      className="border-zinc-800 bg-zinc-950 text-sm text-zinc-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label
                      htmlFor="copyright"
                      className="text-xs text-zinc-400"
                    >
                      {t("mediaPage.details.copyright")}
                    </Label>
                    <Input
                      id="copyright"
                      value={copyright}
                      onChange={(e) => setCopyright(e.target.value)}
                      className="border-zinc-800 bg-zinc-950 text-sm text-zinc-200"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleSave}
                      disabled={isSaving}
                      className="bg-indigo-600 hover:bg-indigo-500"
                    >
                      {isSaving
                        ? t("mediaPage.details.saving")
                        : t("mediaPage.details.save")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsEditing(false)}
                      className="border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                    >
                      {t("mediaPage.details.cancel")}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {item.caption && (
                    <div>
                      <p className="text-xs text-zinc-500">
                        {t("mediaPage.details.caption")}
                      </p>
                      <p className="text-sm text-zinc-300">{item.caption}</p>
                    </div>
                  )}
                  {item.photographer && (
                    <div>
                      <p className="text-xs text-zinc-500">
                        {t("mediaPage.details.photographer")}
                      </p>
                      <p className="text-sm text-zinc-300">
                        {item.photographer}
                      </p>
                    </div>
                  )}
                  {item.copyright && (
                    <div>
                      <p className="text-xs text-zinc-500">
                        {t("mediaPage.details.copyright")}
                      </p>
                      <p className="text-sm text-zinc-300">{item.copyright}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2 border-t border-zinc-800 pt-4">
                {!isEditing && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsEditing(true)}
                    className="border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                  >
                    {t("mediaPage.details.editMetadata")}
                  </Button>
                )}
                {!item.isPrimary && item.fileType === "image" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSetPrimary}
                    className="border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                  >
                    <Star className="mr-1 h-3 w-3" />
                    {t("mediaPage.details.setPrimary")}
                  </Button>
                )}
                <Button size="sm" variant="destructive" onClick={handleDelete}>
                  {t("mediaPage.details.delete")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
