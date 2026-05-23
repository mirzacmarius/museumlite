"use client";

import type { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Checkbox } from "@v1/ui/checkbox";
import { EmptyState } from "@v1/ui/empty-state";
import type { FunctionReturnType } from "convex/server";
import { Building2, Package, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { ClientDate } from "@/components/client-date";
import { PermissionGate } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";
import { ObjectCatalogTableSkeleton } from "../loading";
import { OBJECTS_SCROLL_PRELOAD_MARGIN } from "./collection-catalog-constants";
import type { ColumnConfig } from "./column-config";
import { ObjectActionsMenu, ObjectGridView } from "./object-grid-view";
import type { ViewMode } from "./view-toggle";

type CollectionListItem = FunctionReturnType<
  typeof api.collections.list
>["page"][number];

export function CollectionList({
  organizationId,
  collections,
  collectionsStatus,
  viewMode,
  columns,
  selectedIds,
  onSelectItem,
  onSelectAll,
  onLoadMore,
  activeCollectionGroup,
  onAddToCollection,
}: {
  organizationId: Id<"organizations">;
  collections: Array<{
    _id: string;
    accessionNumber: string;
    title: string;
    objectType?: string;
    primaryImageUrl?: string;
    locationPath?: string;
    currentLocationId?: Id<"locations">;
    status: string;
    _creationTime: number;
  }>;
  collectionsStatus:
    | "LoadingFirstPage"
    | "CanLoadMore"
    | "LoadingMore"
    | "Exhausted";
  viewMode: ViewMode;
  columns: ColumnConfig[];
  selectedIds: Set<Id<"collections">>;
  onSelectItem: (id: Id<"collections">, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  onLoadMore: () => void;
  activeCollectionGroup?: { _id: Id<"collectionGroups">; name: string } | null;
  onAddToCollection?: () => void;
}) {
  const t = useScopedI18n("objects");
  const common = useScopedI18n("common");
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const isAutoLoadingRef = useRef(false);

  useEffect(() => {
    if (collectionsStatus !== "LoadingMore") {
      isAutoLoadingRef.current = false;
    }
  }, [collectionsStatus]);

  useEffect(() => {
    const root = scrollContainerRef.current;
    const target = loadMoreRef.current;

    if (!root || !target || collectionsStatus !== "CanLoadMore") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (
          entry?.isIntersecting &&
          !isAutoLoadingRef.current &&
          collectionsStatus === "CanLoadMore"
        ) {
          isAutoLoadingRef.current = true;
          onLoadMore();
        }
      },
      {
        root,
        rootMargin: OBJECTS_SCROLL_PRELOAD_MARGIN,
      },
    );

    observer.observe(target);

    return () => observer.disconnect();
  }, [collectionsStatus, onLoadMore]);

  if (collectionsStatus === "LoadingFirstPage" && collections.length === 0) {
    return <ObjectCatalogTableSkeleton />;
  }

  if (collections.length === 0) {
    const isCollectionGroupView = Boolean(activeCollectionGroup);

    return (
      <div className="flex h-64 flex-col items-center justify-center px-6 text-center">
        <EmptyState
          icon={Package}
          title={
            isCollectionGroupView
              ? t("emptyState.noObjectsInCollection")
              : t("emptyState.noObjectsFound")
          }
          description={
            isCollectionGroupView
              ? t("emptyState.addObjectsToCollectionDescription")
              : t("emptyState.addFirstObject")
          }
        />
        {isCollectionGroupView ? (
          <PermissionGate permission="collections.update">
            <Button className="mt-4" onClick={onAddToCollection}>
              <Plus className="mr-2 size-4" />
              {t("emptyState.addObjectsToCollection")}
            </Button>
          </PermissionGate>
        ) : (
          <PermissionGate permission="collections.create">
            <Button asChild className="mt-4">
              <Link href="/objects/new">
                <Plus className="mr-2 size-4" />
                {t("emptyState.addFirstObject")}
              </Link>
            </Button>
          </PermissionGate>
        )}
      </div>
    );
  }

  const allSelected =
    collections.length > 0 &&
    collections.every((item) => selectedIds.has(item._id as Id<"collections">));
  const someSelected =
    collections.some((item) =>
      selectedIds.has(item._id as Id<"collections">),
    ) && !allSelected;

  return (
    <div className="h-full flex flex-col">
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto custom-scrollbar relative"
      >
        {viewMode === "grid" ? (
          <div className="p-4 sm:p-6">
            {collections.length > 0 && (
              <div className="mb-4 flex items-center gap-2">
                <Checkbox
                  checked={
                    allSelected || (someSelected ? "indeterminate" : false)
                  }
                  onCheckedChange={(checked) => onSelectAll(checked === true)}
                  aria-label={common("selectAllItems")}
                />
                <span className="text-sm text-muted-foreground">
                  {allSelected
                    ? common("allSelected")
                    : someSelected
                      ? common("selectedCount", { count: selectedIds.size })
                      : common("selectAll")}
                </span>
              </div>
            )}
            <ObjectGridView
              items={collections.map((item) => ({
                _id: item._id as Id<"collections">,
                accessionNumber: item.accessionNumber,
                title: item.title,
                objectType: item.objectType,
                primaryImageUrl: item.primaryImageUrl,
                status: item.status,
              }))}
              organizationId={organizationId}
              selectedIds={selectedIds}
              onSelectItem={onSelectItem}
            />
          </div>
        ) : (
          <table className="w-full border-separate border-spacing-0 text-left text-xs">
            <thead className="sticky top-0 z-10 bg-background/95 shadow-sm backdrop-blur-md">
              <tr>
                <th className="w-10 border-b border-border px-4 py-3">
                  <Checkbox
                    checked={
                      allSelected || (someSelected ? "indeterminate" : false)
                    }
                    onCheckedChange={(checked) => onSelectAll(checked === true)}
                    className="border-input"
                  />
                </th>
                <th className="w-16 border-b border-border px-4 py-3 font-medium text-muted-foreground">
                  Image
                </th>
                <th className="border-b border-border px-4 py-3 font-medium text-muted-foreground">
                  Object ID & Description
                </th>
                <th className="border-b border-border px-4 py-3 font-medium text-muted-foreground">
                  Collection
                </th>
                <th className="border-b border-border px-4 py-3 font-medium text-muted-foreground">
                  Location
                </th>
                <th className="border-b border-border px-4 py-3 font-medium text-muted-foreground">
                  Date Acquired
                </th>
                <th className="border-b border-border px-4 py-3 text-right font-medium text-muted-foreground">
                  Status
                </th>
                <th className="w-10 border-b border-border px-4 py-3 font-medium text-muted-foreground" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {collections.map((item) => (
                <CollectionTableRow
                  key={item._id}
                  item={item as CollectionListItem}
                  organizationId={organizationId}
                  columns={columns}
                  isSelected={selectedIds.has(item._id as Id<"collections">)}
                  shouldEagerLoad={collections[0]?._id === item._id}
                  onSelect={(selected: boolean) =>
                    onSelectItem(item._id as Id<"collections">, selected)
                  }
                />
              ))}
            </tbody>
          </table>
        )}

        <div ref={loadMoreRef} className="h-6 w-full" />
      </div>

      <div className="shrink-0 border-t border-border bg-background px-6 py-3 text-xs text-muted-foreground">
        {collectionsStatus === "LoadingMore" ? (
          <span>{common("loading")}</span>
        ) : (
          <>
            {t("pagination.showing")}{" "}
            <span className="text-foreground">{collections.length}</span>{" "}
            {t("pagination.items")}
          </>
        )}
      </div>
    </div>
  );
}

function CollectionTableRow({
  item,
  organizationId,
  columns,
  isSelected,
  onSelect,
  shouldEagerLoad = false,
}: {
  item: CollectionListItem;
  organizationId: Id<"organizations">;
  columns: ColumnConfig[];
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
  shouldEagerLoad?: boolean;
}) {
  const _isColumnVisible = (columnId: string) =>
    columns.find((c) => c.id === columnId)?.visible ?? true;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
      case "verified":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-status-success/20 bg-status-success/10 px-2 py-0.5 font-medium text-status-success-foreground capitalize">
            {status}
          </span>
        );
      case "loaned":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-status-info/20 bg-status-info/10 px-2 py-0.5 font-medium text-status-info-foreground capitalize">
            {status}
          </span>
        );
      case "deaccessioned":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-status-error/20 bg-status-error/10 px-2 py-0.5 font-medium text-status-error-foreground capitalize">
            {status}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-status-warning/20 bg-status-warning/10 px-2 py-0.5 font-medium text-status-warning-foreground capitalize">
            {status}
          </span>
        );
    }
  };

  return (
    <tr
      className={`group transition-colors hover:bg-accent/50 ${isSelected ? "bg-accent" : ""}`}
    >
      <td className="px-4 py-3">
        <Checkbox
          checked={isSelected}
          onCheckedChange={(checked) => onSelect(!!checked)}
          onClick={(e) => e.stopPropagation()}
          className="border-input"
        />
      </td>
      <td className="px-4 py-3">
        <div className="relative size-10 overflow-hidden rounded-lg border border-border bg-muted">
          {item.primaryImageUrl ? (
            <Image
              src={item.primaryImageUrl}
              alt={item.title}
              fill
              sizes="40px"
              loading={shouldEagerLoad ? "eager" : "lazy"}
              className="object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center">
              <Building2 className="size-4 text-muted-foreground/60" />
            </div>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <Link
          href={`/objects/${item._id}`}
          className="flex flex-col group-hover:cursor-pointer"
        >
          <span className="max-w-[200px] truncate font-medium text-foreground transition-colors">
            {item.title}
          </span>
          <span className="mt-0.5 font-mono text-[10px] text-muted-foreground">
            {item.accessionNumber}
          </span>
        </Link>
      </td>
      <td className="px-4 py-3">
        <span className="inline-block max-w-[120px] truncate rounded-full border border-border bg-muted px-2 py-0.5 text-muted-foreground">
          {(() => {
            if (!item.objectType) return "General";
            try {
              const parsed = JSON.parse(item.objectType);
              return Array.isArray(parsed) ? parsed[0] : item.objectType;
            } catch {
              return item.objectType;
            }
          })()}
        </span>
      </td>
      <td className="max-w-[150px] truncate px-4 py-3 text-muted-foreground">
        {item.locationPath ? (
          <span className="flex items-center gap-1">{item.locationPath}</span>
        ) : (
          <span className="text-muted-foreground/60">-</span>
        )}
      </td>
      <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground">
        <ClientDate timestamp={item._creationTime} locale="en-US" />
      </td>
      <td className="px-4 py-3 text-right">{getStatusBadge(item.status)}</td>
      <td className="px-4 py-3 text-right">
        <ObjectActionsMenu
          item={item}
          organizationId={organizationId}
          triggerClassName="size-8 border-none bg-transparent text-muted-foreground hover:bg-transparent hover:text-foreground"
          iconClassName="size-4"
        />
      </td>
    </tr>
  );
}
