"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { CursorPagination } from "@v1/ui/cursor-pagination";
import { EmptyState } from "@v1/ui/empty-state";
import { type Preloaded, usePreloadedQuery, useQuery } from "convex/react";
import { Image as ImageIcon, Search, Star } from "lucide-react";
import dynamic from "next/dynamic";
import NextImage from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { MetricsUnavailableInline } from "@/components/metrics-unavailable-notice";
import { useCursorStackPagination } from "@/hooks/use-cursor-stack-pagination";
import type { MediaFileType } from "@/hooks/use-url-filters";
import { useMediaFilters } from "@/hooks/use-url-filters";
import { useI18n } from "@/locales/client";
import { MediaAppliedFilters } from "./_components/media-applied-filters";
import { MediaGridSkeleton } from "./media-skeletons";

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

function collectPageStorageIds(
  page: Array<{
    storageId: Id<"_storage">;
    thumbnailStorageId?: Id<"_storage">;
  }>,
): Array<Id<"_storage">> {
  const ids = new Set<Id<"_storage">>();
  for (const item of page) {
    ids.add(item.storageId);
    if (item.thumbnailStorageId) {
      ids.add(item.thumbnailStorageId);
    }
  }
  return [...ids];
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
  const tRoot = useI18n();
  const t = useI18n();
  const { filters, setFilters, resetFilters } = useMediaFilters();

  const [searchInput, setSearchInput] = useState(filters.search);
  const searchInputRef = useRef<HTMLInputElement>(null);
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

  const pageStorageIds = useMemo(
    () => (media ? collectPageStorageIds(media.page) : []),
    [media],
  );
  const storageUrlQueryArgs = useMemo(
    () =>
      pageStorageIds.length > 0
        ? { organizationId, storageIds: pageStorageIds }
        : "skip",
    [organizationId, pageStorageIds],
  );
  const storageUrls = useQuery(api.media.getStorageUrls, storageUrlQueryArgs);
  const urlByStorageId = useMemo(() => {
    const map = new Map<Id<"_storage">, string | null>();
    if (storageUrls) {
      for (const entry of storageUrls) {
        map.set(entry.storageId, entry.url);
      }
    }
    return map;
  }, [storageUrls]);

  const [selectedMediaId, setSelectedMediaId] =
    useState<Id<"mediaFiles"> | null>(null);

  const tabs: Array<{ id: MediaFileType; label: string }> = [
    { id: "all", label: tRoot("untranslatedDashboard.media.allAssets") },
    { id: "image", label: tRoot("mediaPage.types.image") },
    { id: "document", label: tRoot("mediaPage.types.document") },
    { id: "3d", label: tRoot("mediaPage.types.model3d") },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-4 border-b border-zinc-800/60 bg-zinc-900/20 px-6 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-200">
            {tRoot("untranslatedDashboard.media.digitalAssets")}
          </h2>
          <div className="flex items-center gap-3">
            {stats?.availability === "unavailable" ? (
              <MetricsUnavailableInline
                label={tRoot("projectionHealth.unavailable.storage")}
              />
            ) : null}
            {stats?.availability === "ready" && usage && (
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <span className="size-2 rounded-full bg-emerald-500" />
                <span>
                  {formatFileSize(stats.totalSize)}{" "}
                  {tRoot("untranslatedRecords.objects.forms.used")}
                </span>
                <span className="text-zinc-700">/</span>
                {usage.storage.limit === null ? (
                  <span>{tRoot("untranslatedDashboard.media.unlimited")}</span>
                ) : (
                  <span>
                    {formatFileSize(usage.storage.limit)}{" "}
                    {tRoot("untranslatedDashboard.media.total")}
                  </span>
                )}
              </div>
            )}
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
            <Search className="absolute left-2.5 top-2 size-3.5 text-zinc-500" />
            <input
              ref={searchInputRef}
              type="text"
              aria-label={tRoot("untranslatedDashboard.media.mediaSearch")}
              placeholder={tRoot("untranslatedDashboard.media.mediaSearch")}
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
          returnFocusRef={searchInputRef}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {media === undefined && <MediaGridSkeleton />}

        {media && media.page.length === 0 && (
          <EmptyState
            icon={ImageIcon}
            title={t("mediaPage.empty")}
            description={tRoot(
              "untranslatedDashboard.media.uploadedFromObjects",
            )}
            size="md"
          />
        )}

        {media && media.page.length > 0 && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {media.page.map((item) => {
              const previewStorageId =
                item.thumbnailStorageId ?? item.storageId;
              const previewUrl = urlByStorageId.get(previewStorageId);

              return (
                <button
                  key={item._id}
                  type="button"
                  onClick={() => setSelectedMediaId(item._id)}
                  className="group relative w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 text-left transition-all duration-300 hover:border-zinc-600 hover:shadow-xl"
                >
                  <div className="relative aspect-square overflow-hidden bg-zinc-950">
                    {item.fileType === "image" && previewUrl ? (
                      <NextImage
                        src={previewUrl}
                        alt={item.fileName}
                        fill
                        sizes="(min-width: 1280px) 16vw, (min-width: 1024px) 20vw, (min-width: 768px) 25vw, 50vw"
                        className="object-cover opacity-80 transition-all duration-500 group-hover:scale-105 group-hover:opacity-100"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center">
                        <div className="size-12 rounded-lg bg-zinc-900/40" />
                      </div>
                    )}

                    {item.isPrimary && (
                      <div className="absolute left-2 top-2 rounded bg-amber-500/90 p-1">
                        <Star className="size-3 text-white" />
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
                </button>
              );
            })}
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
