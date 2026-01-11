"use client";

import { useOrganization } from "@/components/organization-provider";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { ScrollArea } from "@v1/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { Textarea } from "@v1/ui/textarea";
import { useMutation, useQuery } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import {
  Building2,
  File,
  FileImage,
  FileText,
  FileVideo,
  HardDrive,
  Image,
  Loader2,
  Search,
  Star,
  X,
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

export default function MediaPage() {
  const { currentOrganizationId, organizations, isLoading } = useOrganization();

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!organizations || organizations.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-8">
          <Building2 className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold text-foreground">
              No Organization Found
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              You need to create an organization to manage media.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-8">
          <Image className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold text-foreground">
              Select an Organization
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Please select an organization from the dropdown above to view
              media.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-background">
      <MediaBrowser organizationId={currentOrganizationId} />
    </div>
  );
}

function MediaBrowser({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
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
        return <FileImage className="h-4 w-4" />;
      case "document":
        return <FileText className="h-4 w-4" />;
      case "video":
        return <FileVideo className="h-4 w-4" />;
      default:
        return <File className="h-4 w-4" />;
    }
  };

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h3 className="text-sm font-medium text-foreground">Media Library</h3>
          <p className="text-xs text-muted-foreground">
            All media files across your collection.
          </p>
        </div>
        {stats && (
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Storage</span>
                <span className="text-sm font-semibold text-white">
                  {formatFileSize(stats.totalSize)}
                </span>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Files</span>
              <span className="text-sm font-semibold text-white">
                {stats.totalFiles}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">This Week</span>
              <span className="text-sm font-semibold text-white">
                +{stats.recentUploads}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="mb-4 flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search files..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border-border bg-muted/50 pl-9 text-sm placeholder:text-muted-foreground"
          />
        </div>
        <Select value={fileType} onValueChange={setFileType}>
          <SelectTrigger className="w-[140px] border-border bg-muted/50">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="image">Images</SelectItem>
            <SelectItem value="document">Documents</SelectItem>
            <SelectItem value="video">Videos</SelectItem>
            <SelectItem value="3d">3D Models</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {stats && stats.byType.length > 0 && (
        <div className="mb-4 flex gap-2">
          {stats.byType.map((t) => (
            <button
              key={t.type}
              type="button"
              onClick={() => setFileType(t.type === fileType ? "all" : t.type)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
                fileType === t.type
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {getFileIcon(t.type)}
              <span className="capitalize">{t.type}</span>
              <span className="text-[10px] opacity-60">{t.count}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-hidden rounded-lg border border-border bg-muted/20">
        <ScrollArea className="h-full">
          {media === undefined && (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {media && media.page.length === 0 && (
            <div className="flex h-64 flex-col items-center justify-center gap-2">
              <Image className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No media found</p>
            </div>
          )}

          {media && media.page.length > 0 && (
            <div className="grid grid-cols-2 gap-2 p-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {media.page.map((item) => (
                <button
                  key={item._id}
                  type="button"
                  onClick={() => setSelectedMedia(item._id)}
                  className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-card transition-all hover:border-primary/50 hover:ring-1 hover:ring-primary/20"
                >
                  {item.fileType === "image" && item.url ? (
                    <img
                      src={item.thumbnailUrl || item.url}
                      alt={item.fileName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-muted/50">
                      {getFileIcon(item.fileType)}
                    </div>
                  )}
                  {item.isPrimary && (
                    <div className="absolute left-1 top-1 rounded bg-amber-500/90 p-0.5">
                      <Star className="h-3 w-3 text-white" />
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <p className="truncate text-xs font-medium text-white">
                      {item.fileName}
                    </p>
                    <p className="truncate text-[10px] text-white/70">
                      {item.collectionTitle}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {media && !media.isDone && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCursor(media.continueCursor)}
            className="border-border text-muted-foreground hover:bg-accent hover:text-white"
          >
            Load More
          </Button>
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
    if (confirm("Delete this file? This cannot be undone.")) {
      await deleteMedia({ mediaId });
      onClose();
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Media Details</DialogTitle>
        </DialogHeader>

        {!item ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="aspect-square overflow-hidden rounded-lg border border-border bg-muted">
              {item.fileType === "image" && item.url ? (
                <img
                  src={item.url}
                  alt={item.fileName}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <File className="h-16 w-16 text-muted-foreground" />
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium">{item.fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(item.fileSize)} &bull;{" "}
                  {formatDistanceToNow(item.uploadedAt, { addSuffix: true })}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Object</p>
                <Link
                  href={`/objects/${item.collectionId}`}
                  className="text-sm text-primary hover:underline"
                >
                  {item.collectionTitle}
                </Link>
                {item.accessionNumber && (
                  <p className="text-xs text-muted-foreground">
                    {item.accessionNumber}
                  </p>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="caption" className="text-xs">
                      Caption
                    </Label>
                    <Textarea
                      id="caption"
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      rows={2}
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="photographer" className="text-xs">
                      Photographer
                    </Label>
                    <Input
                      id="photographer"
                      value={photographer}
                      onChange={(e) => setPhotographer(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="copyright" className="text-xs">
                      Copyright
                    </Label>
                    <Input
                      id="copyright"
                      value={copyright}
                      onChange={(e) => setCopyright(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSave} disabled={isSaving}>
                      {isSaving ? "Saving..." : "Save"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsEditing(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {item.caption && (
                    <div>
                      <p className="text-xs text-muted-foreground">Caption</p>
                      <p className="text-sm">{item.caption}</p>
                    </div>
                  )}
                  {item.photographer && (
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Photographer
                      </p>
                      <p className="text-sm">{item.photographer}</p>
                    </div>
                  )}
                  {item.copyright && (
                    <div>
                      <p className="text-xs text-muted-foreground">Copyright</p>
                      <p className="text-sm">{item.copyright}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-4 border-t border-border">
                {!isEditing && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsEditing(true)}
                  >
                    Edit Metadata
                  </Button>
                )}
                {!item.isPrimary && item.fileType === "image" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSetPrimary}
                  >
                    <Star className="mr-1 h-3 w-3" />
                    Set as Primary
                  </Button>
                )}
                <Button size="sm" variant="destructive" onClick={handleDelete}>
                  Delete
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
