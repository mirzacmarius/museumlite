"use client";

import { useCursorStackPagination } from "@/hooks/use-cursor-stack-pagination";
import { useMediaFilters } from "@/hooks/use-url-filters";
import type { MediaFileType } from "@/hooks/use-url-filters";
import { useI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { CursorPagination } from "@v1/ui/cursor-pagination";
import { EmptyState } from "@v1/ui/empty-state";
import { Image as ImageIcon, Loader2, Plus, Search, Star, Upload } from "lucide-react";
import dynamic from "next/dynamic";
import NextImage from "next/image";
import { useEffect, useMemo, useState } from "react";
import { type Preloaded, usePreloadedQuery, useQuery } from "convex/react";
import { MediaAppliedFilters } from "./_components/media-applied-filters";

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

const MediaDetailModal = dynamic(
  () => import("./media-detail-modal").then((mod) => mod.MediaDetailModal),
  { ssr: false },
);

type MediaPageClientProps = {
  organizationId: Id<"organizations">;
  initialFilters: { fileType: MediaFileType; search: string };
  preloadedStats: Preloaded<typeof api.media.getStorageStats>;
  preloadedUsage: Preloaded<typeof api.organizations.getUsageStats>;
  preloadedMedia: Preloaded<typeof api.media.listByOrganization>;
};

export function MediaPageClient({
  organizationId,
  initialFilters,
  preloadedStats,
  preloadedUsage,
  preloadedMedia,
}: MediaPageClientProps) {
  const t = useI18n();
  const { filters, setFilters, resetFilters } = useMediaFilters();

  const [searchInput, setSearchInput] = useState(filters.search);
  useEffect(() => {
    setSearchInput(filters.search);
  }, [filters.search]);
  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (searchInput !== filters.search) {
        setFilters({ search: searchInput });
      }
    }, 250);
    return () => window.clearTimeout(handle);
  }, [filters.search, searchInput, setFilters]);

  const resetKey = useMemo(
    () => JSON.stringify({ organizationId, filters }),
    [filters, organizationId],
  );
  const { cursor, goNext, goPrev, canGoPrev } = useCursorStackPagination({
    resetKey,
  });

  const shouldUsePreloaded =
    cursor === null &&
    filters.fileType === initialFilters.fileType &&
    filters.search === initialFilters.search;

  const preloadedStatsResult = usePreloadedQuery(preloadedStats);
  const liveStatsResult = useQuery(
    api.media.getStorageStats,
    shouldUsePreloaded ? "skip" : { organizationId },
  );
  const stats = shouldUsePreloaded ? preloadedStatsResult : liveStatsResult;
  const preloadedUsageResult = usePreloadedQuery(preloadedUsage);
  const liveUsageResult = useQuery(
    api.organizations.getUsageStats,
    shouldUsePreloaded ? "skip" : { organizationId },
  );
  const usage = shouldUsePreloaded ? preloadedUsageResult : liveUsageResult;

  const queryArgs = useMemo(
    () => ({
      organizationId,
      fileType: filters.fileType !== "all" ? filters.fileType : undefined,
      search: filters.search !== "" ? filters.search : undefined,
      paginationOpts: { numItems: 20, cursor },
    }),
    [cursor, filters.fileType, filters.search, organizationId],
  );

  const preloadedMediaResult = usePreloadedQuery(preloadedMedia);
  const liveMediaResult = useQuery(
    api.media.listByOrganization,
    shouldUsePreloaded ? "skip" : queryArgs,
  );
  const media = shouldUsePreloaded ? preloadedMediaResult : liveMediaResult;

  const [selectedMediaId, setSelectedMediaId] = useState<Id<"mediaFiles"> | null>(
    null,
  );

  const tabs: Array<{ id: MediaFileType; label: string }> = [
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
                {usage === undefined ? (
                  <span>Loading...</span>
                ) : usage.storage.limit === null ? (
                  <span>Unlimited</span>
                ) : (
                  <span>{formatFileSize(usage.storage.limit)} Total</span>
                )}
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
                onClick={() => setFilters({ fileType: tab.id })}
                className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                  filters.fileType === tab.id
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
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-48 rounded-full border border-zinc-800 bg-zinc-900 py-1 pl-8 pr-4 text-xs text-zinc-300 transition-all focus:border-zinc-700 focus:outline-none"
            />
          </div>
        </div>

        <MediaAppliedFilters
          className="pt-1"
          filters={{ fileType: filters.fileType, search: filters.search }}
          onChange={setFilters}
          onClearAll={resetFilters}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {media === undefined && (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
          </div>
        )}

        {media && media.page.length === 0 && (
          <EmptyState
            icon={ImageIcon}
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
                onClick={() => setSelectedMediaId(item._id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    setSelectedMediaId(item._id);
                  }
                }}
                role="button"
                tabIndex={0}
                className="group relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 transition-all duration-300 hover:border-zinc-600 hover:shadow-xl"
              >
                <div className="relative aspect-square overflow-hidden bg-zinc-950">
                  {item.fileType === "image" && (item.thumbnailUrl || item.url) ? (
                    <NextImage
                      src={item.thumbnailUrl ?? item.url ?? ""}
                      alt={item.fileName}
                      fill
                      sizes="(min-width: 1280px) 16vw, (min-width: 1024px) 20vw, (min-width: 768px) 25vw, 50vw"
                      className="object-cover opacity-80 transition-all duration-500 group-hover:scale-105 group-hover:opacity-100"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <div className="h-12 w-12 rounded-lg bg-zinc-900/40" />
                    </div>
                  )}

                  {item.isPrimary && (
                    <div className="absolute left-2 top-2 rounded bg-amber-500/90 p-1">
                      <Star className="h-3 w-3 text-white" />
                    </div>
                  )}
                </div>

                <div className="bg-zinc-900 p-2.5">
                  <p className="truncate text-xs font-medium text-zinc-200">
                    {item.fileName}
                  </p>
                  <div className="mt-1 flex justify-between text-[10px] text-zinc-500">
                    <span>{formatFileSize(item.fileSize)}</span>
                    <span>{getFileExtension(item.fileName)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {media && (
        <CursorPagination
          variant="nextPrev"
          countLabel={`${media.page.length} items`}
          canPrev={canGoPrev}
          canNext={!media.isDone && !!media.continueCursor}
          onPrev={goPrev}
          onNext={() => {
            if (media.isDone) return;
            if (!media.continueCursor) return;
            goNext(media.continueCursor);
          }}
        />
      )}

      {selectedMediaId && (
        <MediaDetailModal
          mediaId={selectedMediaId}
          onClose={() => setSelectedMediaId(null)}
        />
      )}
    </div>
  );
}
