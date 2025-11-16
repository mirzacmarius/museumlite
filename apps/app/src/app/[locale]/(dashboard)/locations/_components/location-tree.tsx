"use client";

import { PermissionGate } from "@/components/permission-gate";
import {
  dragAndDropFeature,
  hotkeysCoreFeature,
  selectionFeature,
  syncDataLoaderFeature,
} from "@headless-tree/core";
import { useTree } from "@headless-tree/react";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@v1/ui/alert-dialog";
import { Button } from "@v1/ui/button";
import { Tree, TreeDragLine, TreeItem, TreeItemLabel } from "@v1/ui/tree";
import { Tooltip, TooltipContent, TooltipTrigger } from "@v1/ui/tooltip";
import { useMutation, useQuery } from "convex/react";
import {
  Building2,
  Edit,
  FileIcon,
  FolderIcon,
  FolderOpenIcon,
  MapPin,
  Move,
  Plus,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useRef } from "react";
import { AddChildLocationDialog } from "./add-child-location-dialog";
import { MoveLocationDialog } from "./move-location-dialog";

interface LocationTreeProps {
  organizationId: string;
}

interface LocationItem {
  _id: string;
  name: string;
  type: string;
  parentLocationId?: string;
  sortOrder: number;
  isActive: boolean;
  children?: string[];
}

const indent = 24;

export function LocationTree({ organizationId }: LocationTreeProps) {
  const router = useRouter();
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [addChildDialogOpen, setAddChildDialogOpen] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{
    id: string;
    name: string;
    parentId?: string;
  } | null>(null);
  const [treeVersion, setTreeVersion] = useState(0);

  // Fetch all locations for the tree
  const allLocations = useQuery(
    api.locations.listAll,
    organizationId
      ? { organizationId: organizationId as Id<"organizations"> }
      : "skip",
  );

  const deleteLocation = useMutation(api.locations.deleteLocation);
  const updateLocation = useMutation(api.locations.update);
  const reorderLocation = useMutation(api.locations.reorder);

  // Track previous dataVersion to detect changes
  const prevDataVersionRef = useRef<string>('');

  // Build items map for tree - memoized to rebuild when allLocations changes
  const { items, rootChildren, dataVersion } = useMemo(() => {
    const itemsMap: Record<string, LocationItem> = {};
    const roots: string[] = [];

    if (allLocations) {
      // Sort locations by sortOrder first
      const sortedLocations = [...allLocations].sort(
        (a, b) => a.sortOrder - b.sortOrder,
      );

      for (const loc of sortedLocations) {
        itemsMap[loc._id] = {
          _id: loc._id,
          name: loc.name,
          type: loc.type,
          parentLocationId: loc.parentLocationId,
          sortOrder: loc.sortOrder,
          isActive: loc.isActive,
          children: [],
        };

        if (!loc.parentLocationId) {
          roots.push(loc._id);
        }
      }

      // Build children arrays (maintaining sort order)
      for (const loc of sortedLocations) {
        if (loc.parentLocationId) {
          const parent = itemsMap[loc.parentLocationId];
          if (parent?.children) {
            parent.children.push(loc._id);
          }
        }
      }
    }

    // Add virtual root
    itemsMap.root = {
      _id: "root",
      name: "All Locations",
      type: "root",
      sortOrder: 0,
      isActive: true,
      children: roots,
    };

    // Create a version hash based on the actual structure AND order
    const structureHash = allLocations
      ?.map(loc => `${loc._id}:${loc.parentLocationId || 'root'}:${loc.sortOrder}`)
      .sort()
      .join('|') || '';

    return { items: itemsMap, rootChildren: roots, dataVersion: structureHash };
  }, [allLocations]);

  // Create tree instance - will recreate when items OR dataVersion changes
  const tree = useTree<LocationItem>({
    initialState: {
      // Start with empty to avoid hydration mismatch
      // Will be expanded via useEffect on client
      expandedItems: [],
    },
    indent,
    rootItemId: "root",
    getItemName: (item) => item.getItemData().name,
    isItemFolder: (item) => (item.getItemData()?.children?.length ?? 0) > 0,
    dataLoader: {
      getItem: (itemId) => {
        const item = items[itemId];
        if (!item) {
          // Fallback for undefined items
          return {
            _id: itemId,
            name: "Unknown",
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
    canDrag: (draggedItems) => {
      // Allow dragging all items except root
      return draggedItems.every(
        (item) => item.getItemData()._id !== "root",
      );
    },
    canDrop: (draggedItems, target) => {
      const draggedItem = draggedItems[0];
      if (!draggedItem) return false;
      
      const draggedData = draggedItem.getItemData();
      const targetData = target.item.getItemData();
      
      // Don't allow dropping on itself
      if (draggedData._id === targetData._id) return false;
      
      // Don't allow dropping on the root visually
      if (draggedData._id === "root") return false;
      
      // Don't allow dropping a location onto one of its descendants (circular reference)
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
        
        // Check if this is an ordered drop (between items)
        if ("childIndex" in target) {
          // Dropped between items - use the parent of the target item
          newParentId = targetData.parentLocationId;
          // Use the childIndex as the new sortOrder
          newSortOrder = target.childIndex;
        } else {
          // Dropped on an item - make it a child of that item
          newParentId = targetData._id === "root" ? undefined : targetData._id;
          // Put it at the end of the children
          const targetChildren = items[targetData._id]?.children || [];
          newSortOrder = targetChildren.length;
        }
        
        // Call the reorder mutation
        await reorderLocation({
          locationId: itemData._id as Id<"locations">,
          newParentLocationId: newParentId as Id<"locations"> | undefined,
          newSortOrder,
        });
        
        // Convex will automatically update allLocations, which changes dataVersion
        // and forces tree to re-render via the key prop
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

  // Detect data changes and log for debugging
  useEffect(() => {
    if (prevDataVersionRef.current && prevDataVersionRef.current !== dataVersion) {
      console.log('🔄 Location data changed, tree will re-render');
    }
    prevDataVersionRef.current = dataVersion;
  }, [dataVersion]);

  // Expand root children after initial render on client AND when tree version changes
  useEffect(() => {
    if (rootChildren.length > 0) {
      rootChildren.forEach((childId) => {
        const item = tree.getItemInstance(childId);
        if (item && !item.isExpanded()) {
          item.expand();
        }
      });
    }
  }, [rootChildren.length, treeVersion, tree]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async () => {
    if (!selectedLocation) return;
    try {
      await deleteLocation({
        locationId: selectedLocation.id as Id<"locations">,
      });
      setDeleteDialogOpen(false);
      setSelectedLocation(null);
      // Force tree to rebuild
      setTreeVersion((v) => v + 1);
    } catch (error) {
      console.error("Failed to delete location:", error);
    }
  };

  const getTypeIcon = (type: string, isFolder: boolean, isExpanded: boolean) => {
    if (type === "root") return null;

    if (isFolder) {
      return isExpanded ? (
        <FolderOpenIcon className="pointer-events-none size-4 text-muted-foreground" />
      ) : (
        <FolderIcon className="pointer-events-none size-4 text-muted-foreground" />
      );
    }

    switch (type.toLowerCase()) {
      case "building":
        return <Building2 className="pointer-events-none size-4 text-muted-foreground" />;
      case "room":
      case "gallery":
        return <MapPin className="pointer-events-none size-4 text-muted-foreground" />;
      default:
        return <FileIcon className="pointer-events-none size-4 text-muted-foreground" />;
    }
  };

  if (allLocations === undefined) {
    return (
      <div className="flex h-64 items-center justify-center p-6">
        <p className="text-muted-foreground">Loading locations...</p>
      </div>
    );
  }

  if (allLocations.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4 p-6">
        <MapPin className="h-12 w-12 text-muted-foreground" />
        <div className="text-center">
          <p className="text-muted-foreground">No locations found</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Create your first location to get started
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="p-6" suppressHydrationWarning>
        <Tree
          key={`tree-${dataVersion}-v${treeVersion}`}
          className="relative before:absolute before:inset-0 before:ms-4.5 before:bg-[repeating-linear-gradient(to_right,transparent_0,transparent_calc(var(--tree-indent)-1px),var(--border)_calc(var(--tree-indent)-1px),var(--border)_calc(var(--tree-indent)))]"
          indent={indent}
          tree={tree}
        >
          <TreeDragLine />
          {tree.getItems().map((item) => {
            const itemData = item.getItemData();
            if (itemData._id === "root") return null;

            const isHovered = hoveredItemId === itemData._id;

            return (
              <div
                key={item.getId()}
                className="group flex items-center gap-1.5 not-last:pb-0.5"
                onMouseEnter={() => setHoveredItemId(itemData._id)}
                onMouseLeave={() => setHoveredItemId(null)}
              >
                <TreeItem 
                  item={item} 
                  className="flex-0 not-last:pb-0 cursor-grab active:cursor-grabbing"
                  onClick={() => router.push(`/locations/${itemData._id}`)}
                >
                  <TreeItemLabel className="relative flex items-center gap-2 before:absolute before:inset-x-0 before:-inset-y-0.5 before:-z-10 before:bg-background data-[drag-target=true]:ring-2 data-[drag-target=true]:ring-primary">
                    {getTypeIcon(
                      itemData.type,
                      item.isFolder(),
                      item.isExpanded(),
                    )}
                    <span className="flex-1">{item.getItemName()}</span>
                    <span className="text-xs capitalize text-muted-foreground">
                      {itemData.type}
                    </span>
                  </TreeItemLabel>
                </TreeItem>

                {/* Action buttons - visible on hover - OUTSIDE TreeItem to avoid nested buttons */}
                <span
                  className={`flex items-center gap-0.5 transition-opacity ${
                    isHovered ? "opacity-100" : "opacity-0"
                  }`}
                >
                      <PermissionGate permission="locations.update">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              data-action-button
                              type="button"
                              className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/locations/${itemData._id}/edit`);
                              }}
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Edit location</TooltipContent>
                        </Tooltip>
                      </PermissionGate>

                      <PermissionGate permission="locations.create">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              data-action-button
                              type="button"
                              className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedLocation({
                                  id: itemData._id,
                                  name: itemData.name,
                                  parentId: itemData.parentLocationId,
                                });
                                setAddChildDialogOpen(true);
                              }}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Add child location</TooltipContent>
                        </Tooltip>
                      </PermissionGate>

                      <PermissionGate permission="locations.update">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              data-action-button
                              type="button"
                              className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedLocation({
                                  id: itemData._id,
                                  name: itemData.name,
                                  parentId: itemData.parentLocationId,
                                });
                                setMoveDialogOpen(true);
                              }}
                            >
                              <Move className="h-3.5 w-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Move to another parent</TooltipContent>
                        </Tooltip>
                      </PermissionGate>

                      <PermissionGate permission="locations.delete">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              data-action-button
                              type="button"
                              className="h-7 w-7 inline-flex items-center justify-center rounded-md text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedLocation({
                                  id: itemData._id,
                                  name: itemData.name,
                                  parentId: itemData.parentLocationId,
                                });
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Delete location</TooltipContent>
                        </Tooltip>
                      </PermissionGate>
                    </span>
              </div>
            );
          })}
        </Tree>
      </div>

      {/* Dialogs */}
      {selectedLocation && (
        <>
          <AddChildLocationDialog
            parentLocationId={selectedLocation.id}
            parentLocationName={selectedLocation.name}
            organizationId={organizationId}
            open={addChildDialogOpen}
            onOpenChange={setAddChildDialogOpen}
            onSuccess={() => {
              // Force tree to rebuild
              setTreeVersion((v) => v + 1);
            }}
          />

          <MoveLocationDialog
            locationId={selectedLocation.id}
            locationName={selectedLocation.name}
            currentParentId={selectedLocation.parentId}
            open={moveDialogOpen}
            onOpenChange={setMoveDialogOpen}
            onSuccess={() => {
              // Force tree to rebuild
              setTreeVersion((v) => v + 1);
            }}
          />

          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Location</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete{" "}
                  <span className="font-medium">{selectedLocation.name}</span>?
                  This action cannot be undone. Make sure this location has no
                  children or objects.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </>
  );
}
