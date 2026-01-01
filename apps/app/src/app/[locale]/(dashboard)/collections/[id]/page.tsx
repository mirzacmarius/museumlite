"use client";

import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
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
  AlertDialogTrigger,
} from "@v1/ui/alert-dialog";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  Archive,
  ArrowLeft,
  Building2,
  ExternalLink,
  FolderInput,
  PlusCircle,
  Search,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export default function CollectionGroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.id as Id<"collectionGroups">;
  const { currentOrganizationId } = useOrganization();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const group = useQuery(api.collectionGroups.get, { groupId });
  const deleteGroup = useMutation(api.collectionGroups.deleteGroup);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteGroup({ groupId });
      router.push("/collections");
    } catch (error) {
      console.error("Failed to delete collection:", error);
      setIsDeleting(false);
    }
  };

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">
          Please select an organization to view collections.
        </p>
      </div>
    );
  }

  if (group === undefined) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (group === null) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">Collection not found</p>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-secondary px-6 dark:bg-black">
      <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
        <div className="flex w-full flex-col rounded-lg border border-border bg-card dark:bg-black">
          <div className="flex w-full items-center justify-between rounded-lg p-6">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/collections">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Link>
              </Button>
              <div className="flex flex-col gap-1">
                <h2 className="text-xl font-medium text-primary">
                  {group.name}
                </h2>
                <p className="text-sm font-normal text-primary/60">
                  {group.itemsCount || 0} items
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <PermissionGate permission="collections.update">
                <Button variant="outline" asChild>
                  <Link href={`/collections/${group._id}/edit`}>
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </Button>
              </PermissionGate>
              <PermissionGate permission="collections.update">
                <Button
                  variant="outline"
                  onClick={() => setIsAddDialogOpen(true)}
                >
                  <FolderInput className="mr-2 h-4 w-4" />
                  Import Existing
                </Button>
              </PermissionGate>
              <PermissionGate permission="collections.create">
                <Button asChild>
                  <Link href={`/objects/new?collectionGroupId=${group._id}`}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    New Object
                  </Link>
                </Button>
              </PermissionGate>
              <PermissionGate permission="collections.delete">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Collection</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete "{group.name}"? Objects
                        in this collection will be unlinked but not deleted.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {isDeleting ? "Deleting..." : "Delete Collection"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </PermissionGate>
            </div>
          </div>
          <div className="flex w-full px-6">
            <div className="w-full border-b border-border" />
          </div>

          <CollectionObjectsList
            organizationId={currentOrganizationId}
            groupId={group._id}
            isAddDialogOpen={isAddDialogOpen}
            onAddDialogOpenChange={setIsAddDialogOpen}
          />
        </div>
      </div>
    </div>
  );
}

function CollectionObjectsList({
  organizationId,
  groupId,
  isAddDialogOpen,
  onAddDialogOpenChange,
}: {
  organizationId: Id<"organizations">;
  groupId: Id<"collectionGroups">;
  isAddDialogOpen: boolean;
  onAddDialogOpenChange: (open: boolean) => void;
}) {
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>(
    [],
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Get items in this collection group (using many-to-many relationship)
  const groupItems = useQuery(api.collectionGroups.listItems, { groupId });

  // Get all collections for the "add existing" dialog
  const collections = useQuery(
    api.collections.list,
    organizationId && isAddDialogOpen
      ? {
          organizationId,
          paginationOpts: { numItems: 100, cursor: null },
          status: "active",
          search: searchQuery || undefined,
        }
      : "skip",
  );

  const addItems = useMutation(api.collectionGroups.addItems);
  const removeItems = useMutation(api.collectionGroups.removeItems);

  // Filter out collections already in this group
  const availableCollections = useMemo(() => {
    if (!collections?.page || !groupItems) return [];
    const existingIds = new Set(groupItems.map((item) => item.collectionId));
    return collections.page.filter((c) => !existingIds.has(c._id));
  }, [collections, groupItems]);

  const handleDialogOpenChange = (open: boolean) => {
    onAddDialogOpenChange(open);
    if (!open) {
      setSearchQuery("");
      setSelectedCollectionIds([]);
      setError(null);
    }
  };

  const handleAddItems = async () => {
    if (selectedCollectionIds.length === 0) {
      setError("Please select at least one object");
      return;
    }

    setError(null);
    try {
      await addItems({
        groupId,
        collectionIds: selectedCollectionIds as Id<"collections">[],
      });
      setSelectedCollectionIds([]);
      onAddDialogOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to add items to collection",
      );
    }
  };

  const handleRemoveItem = async (collectionId: string) => {
    setError(null);
    try {
      await removeItems({
        groupId,
        collectionIds: [collectionId as Id<"collections">],
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to remove item from collection",
      );
    }
  };

  if (groupItems === undefined) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">Loading items...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      {error && (
        <div className="mb-4 rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Import Existing Objects Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Existing Objects</DialogTitle>
            <DialogDescription>
              Search and select existing objects to add to this collection
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Search and Select Objects *</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by accession number or title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              {collections === undefined ? (
                <p className="text-sm text-muted-foreground">
                  Loading objects...
                </p>
              ) : availableCollections.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {searchQuery
                    ? "No objects found matching your search"
                    : "No available objects to add"}
                </p>
              ) : (
                <div className="max-h-[200px] space-y-1 overflow-y-auto rounded-md border border-border p-2">
                  {availableCollections.map((collection) => {
                    const isSelected = selectedCollectionIds.includes(
                      collection._id,
                    );
                    return (
                      <button
                        key={collection._id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedCollectionIds(
                              selectedCollectionIds.filter(
                                (id) => id !== collection._id,
                              ),
                            );
                          } else {
                            setSelectedCollectionIds([
                              ...selectedCollectionIds,
                              collection._id,
                            ]);
                          }
                        }}
                        className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-accent"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-medium">
                              {collection.accessionNumber}
                            </span>
                            <span className="ml-2 text-muted-foreground">
                              {collection.title}
                            </span>
                          </div>
                          {isSelected && <X className="h-4 w-4" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              {selectedCollectionIds.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Selected ({selectedCollectionIds.length}):
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedCollectionIds.map((id) => {
                      const collection = collections?.page.find(
                        (c) => c._id === id,
                      );
                      return (
                        <div
                          key={id}
                          className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-sm"
                        >
                          <span>
                            {collection?.accessionNumber} - {collection?.title}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedCollectionIds(
                                selectedCollectionIds.filter((i) => i !== id),
                              )
                            }
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onAddDialogOpenChange(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleAddItems}>Import Objects</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {groupItems.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-4">
          <p className="text-muted-foreground">No items in this collection</p>
          <div className="flex gap-2">
            <PermissionGate permission="collections.update">
              <Button onClick={() => onAddDialogOpenChange(true)}>
                <FolderInput className="mr-2 h-4 w-4" />
                Import Existing
              </Button>
            </PermissionGate>
            <PermissionGate permission="collections.create">
              <Button variant="outline" asChild>
                <Link href={`/objects/new?collectionGroupId=${groupId}`}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  New Object
                </Link>
              </Button>
            </PermissionGate>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {groupItems.map((item) => (
            <CollectionListItem
              key={item._id}
              item={item}
              organizationId={organizationId}
              onRemove={() => handleRemoveItem(item.collectionId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type CollectionGroupItem = FunctionReturnType<
  typeof api.collectionGroups.listItems
>[number];

function CollectionListItem({
  item,
  onRemove,
}: {
  item: CollectionGroupItem;
  organizationId: Id<"organizations">;
  onRemove?: () => void;
}) {
  const primaryImageUrl = useQuery(api.media.getPrimaryImageUrl, {
    collectionId: item.collectionId,
  });

  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent">
      <Link
        href={`/objects/${item.collectionId}`}
        className="flex flex-1 items-center gap-4"
      >
        <div className="flex h-16 w-16 flex-shrink-0 overflow-hidden rounded-md bg-muted">
          {primaryImageUrl ? (
            <img
              src={primaryImageUrl}
              alt={item.title}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Building2 className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
        </div>

        <div className="flex flex-1 items-center justify-between">
          <div className="flex-1">
            <h3 className="font-medium">{item.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {item.accessionNumber}
            </p>
            {item.description && (
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {item.description}
              </p>
            )}
          </div>
          <div className="text-right">
            {item.status === "deaccessioned" ? (
              <span className="inline-flex items-center rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-600">
                <Archive className="mr-1 h-3 w-3" />
                Deaccessioned
              </span>
            ) : (
              <p className="text-xs text-muted-foreground capitalize">
                {item.status}
              </p>
            )}
          </div>
        </div>
      </Link>
      <div className="ml-4 flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/objects/${item.collectionId}`}>
            <ExternalLink className="h-4 w-4" />
          </Link>
        </Button>
        {onRemove && (
          <PermissionGate permission="collections.update">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove from Collection</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to remove "{item.title}" from this
                    collection? The object will not be deleted, only removed
                    from this collection.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onRemove}>
                    Remove
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </PermissionGate>
        )}
      </div>
    </div>
  );
}
