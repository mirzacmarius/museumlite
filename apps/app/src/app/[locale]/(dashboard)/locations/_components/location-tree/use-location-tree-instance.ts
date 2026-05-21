import {
  dragAndDropFeature,
  hotkeysCoreFeature,
  selectionFeature,
  syncDataLoaderFeature,
} from "@headless-tree/core";
import { useTree } from "@headless-tree/react";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { TREE_INDENT } from "./constants";
import type { LocationItem } from "./types";

interface UseLocationTreeInstanceOptions {
  items: Record<string, LocationItem>;
  initialExpandedItems: string[];
  unknownLabel: string;
}

export function useLocationTreeInstance({
  items,
  initialExpandedItems,
  unknownLabel,
}: UseLocationTreeInstanceOptions) {
  const reorderLocation = useMutation(api.locations.reorder);

  return useTree<LocationItem>({
    initialState: {
      expandedItems: initialExpandedItems,
    },
    indent: TREE_INDENT,
    rootItemId: "root",
    getItemName: (item) => item.getItemData().name,
    isItemFolder: (item) => (item.getItemData()?.children?.length ?? 0) > 0,
    dataLoader: {
      getItem: (itemId) => {
        const item = items[itemId];
        if (!item) {
          return {
            _id: itemId,
            name: unknownLabel,
            type: "unknown",
            sortOrder: 0,
            isActive: false,
            children: [],
          };
        }
        return item;
      },
      getChildren: (itemId) => items[itemId]?.children ?? [],
    },
    canDrag: (draggedItems) =>
      draggedItems.every((item) => item.getItemData()._id !== "root"),
    canDrop: (draggedItems, target) => {
      const draggedItem = draggedItems[0];
      if (!draggedItem) return false;

      const draggedData = draggedItem.getItemData();
      const targetData = target.item.getItemData();

      if (draggedData._id === targetData._id) return false;
      if (draggedData._id === "root") return false;

      let currentId: string | undefined = targetData._id;
      while (currentId && currentId !== "root") {
        if (currentId === draggedData._id) return false;
        const current: LocationItem | undefined = items[currentId];
        currentId = current?.parentLocationId;
      }

      return true;
    },
    canReorder: true,
    onDrop: async (draggedItems, target) => {
      const item = draggedItems[0];
      if (!item) return;

      const itemData = item.getItemData();
      const targetData = target.item.getItemData();

      try {
        let newParentId: string | undefined;
        let newSortOrder: number;

        if ("childIndex" in target) {
          newParentId = targetData.parentLocationId;
          newSortOrder = target.childIndex;
        } else {
          newParentId = targetData._id === "root" ? undefined : targetData._id;
          const targetChildren = items[targetData._id]?.children || [];
          newSortOrder = targetChildren.length;
        }

        await reorderLocation({
          locationId: itemData._id as Id<"locations">,
          newParentLocationId: newParentId as Id<"locations"> | undefined,
          newSortOrder,
        });
      } catch (error) {
        console.error("Failed to reorder location:", error);
      }
    },
    features: [
      syncDataLoaderFeature,
      selectionFeature,
      hotkeysCoreFeature,
      dragAndDropFeature,
    ],
  });
}
