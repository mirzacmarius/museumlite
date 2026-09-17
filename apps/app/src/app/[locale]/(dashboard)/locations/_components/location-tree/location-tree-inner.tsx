"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Tree, TreeDragLine, TreeItem, TreeItemLabel } from "@v1/ui/tree";
import { cn } from "@v1/ui/utils";
import { useQuery } from "convex/react";
import { MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useEffectEvent } from "react";
import { usePermissions } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";
import { TREE_INDENT } from "./constants";
import { LocationTreeItemActions } from "./location-tree-item-actions";
import { LocationTreeTypeIcon } from "./location-tree-type-icon";
import type { LocationTreeInnerProps } from "./types";
import { useLocationTreeInstance } from "./use-location-tree-instance";
import { useLocationTreeItems } from "./use-location-tree-items";

export function LocationTreeInner({
  organizationId,
  initialExpandedItems,
  onExpandedItemsChange,
  onEdit,
  onAddChild,
  onMove,
  onDelete,
}: LocationTreeInnerProps) {
  const { push } = useRouter();
  const t = useScopedI18n("locations.tree");
  const tCommon = useScopedI18n("common");
  const { hasPermission } = usePermissions();
  const canReorderLocations = hasPermission("locations.create");

  const allLocations = useQuery(
    api.locations.listAll,
    organizationId
      ? { organizationId: organizationId as Id<"organizations"> }
      : "skip",
  );

  const allLocationsLabel = t("allLocations");
  const unknownLabel = t("unknown");
  const { items, rootChildren } = useLocationTreeItems(
    allLocations,
    allLocationsLabel,
  );

  const tree = useLocationTreeInstance({
    items,
    initialExpandedItems,
    unknownLabel,
    canReorderLocations,
  });

  useEffect(() => {
    if (rootChildren.length > 0 && initialExpandedItems.length === 0) {
      rootChildren.forEach((childId) => {
        const item = tree.getItemInstance(childId);
        if (item && !item.isExpanded()) {
          item.expand();
        }
      });
    }
  }, [rootChildren, initialExpandedItems.length, tree]);

  const navigateToLocation = useCallback(
    (locationId: string, event: React.MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("[data-action-button]")) {
        return;
      }
      push(`/locations/${locationId}`);
    },
    [push],
  );

  const syncExpandedItems = useEffectEvent(() => {
    onExpandedItemsChange(tree.getState().expandedItems);
  });

  useEffect(() => {
    const timer = setInterval(() => {
      syncExpandedItems();
    }, 500);

    return () => clearInterval(timer);
  }, [tree]);

  if (allLocations === undefined) {
    return (
      <div className="flex h-64 items-center justify-center p-6">
        <p className="text-muted-foreground">{tCommon("loading")}</p>
      </div>
    );
  }

  if (allLocations.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4 p-6">
        <MapPin className="size-12 text-muted-foreground" />
        <div className="text-center">
          <p className="text-muted-foreground">{t("noLocations")}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("createFirst")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6" suppressHydrationWarning>
      <Tree
        className="relative before:absolute before:inset-0 before:ms-4.5 before:bg-[repeating-linear-gradient(to_right,transparent_0,transparent_calc(var(--tree-indent)-1px),var(--border)_calc(var(--tree-indent)-1px),var(--border)_calc(var(--tree-indent)))]"
        indent={TREE_INDENT}
        tree={tree}
      >
        <TreeDragLine />
        {tree.getItems().map((item) => {
          const itemData = item.getItemData();
          if (itemData._id === "root") return null;

          return (
            <div
              key={item.getId()}
              className="flex items-center gap-2 not-last:pb-0.5"
            >
              <TreeItem
                item={item}
                className={cn(
                  "flex-1 not-last:pb-0",
                  canReorderLocations && "cursor-grab active:cursor-grabbing",
                )}
                onClick={(e) => navigateToLocation(itemData._id, e)}
              >
                <TreeItemLabel className="relative flex items-center gap-2 before:absolute before:inset-x-0 before:-inset-y-0.5 before:-z-10 before:bg-background data-[drag-target=true]:ring-2 data-[drag-target=true]:ring-primary">
                  <LocationTreeTypeIcon
                    type={itemData.type}
                    isFolder={item.isFolder()}
                    isExpanded={item.isExpanded()}
                  />
                  <span>{item.getItemName()}</span>
                  <span className="ml-auto text-xs capitalize text-muted-foreground">
                    {itemData.type}
                  </span>
                </TreeItemLabel>
              </TreeItem>

              <LocationTreeItemActions
                itemData={itemData}
                onEdit={onEdit}
                onAddChild={onAddChild}
                onMove={onMove}
                onDelete={onDelete}
              />
            </div>
          );
        })}
      </Tree>
    </div>
  );
}
