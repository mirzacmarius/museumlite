"use client";

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
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { PermissionGate } from "@/components/permission-gate";
import { useQuery, useMutation } from "convex/react";
import { Plus, X, Trash2, ExternalLink, Search } from "lucide-react";
import { useState, useMemo } from "react";
import Link from "next/link";

interface LoanItemsManagerProps {
  loanId: string;
  loanItems: Array<{
    _id: Id<"loanItems">;
    collectionId: Id<"collections">;
    accessionNumber: string;
    title: string;
    conditionOut?: string;
    conditionIn?: string;
    notes?: string;
  }>;
  organizationId: string;
  loanStatus: string;
}

export function LoanItemsManager({
  loanId,
  loanItems,
  organizationId,
  loanStatus,
}: LoanItemsManagerProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>(
    [],
  );
  const [conditionOut, setConditionOut] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const collections = useQuery(
    api.collections.list,
    organizationId && isAddDialogOpen
      ? {
          organizationId: organizationId as Id<"organizations">,
          paginationOpts: { numItems: 100, cursor: null },
          status: "active",
          search: searchQuery || undefined,
        }
      : "skip",
  );

  const addItems = useMutation(api.loans.addItems);
  const removeItems = useMutation(api.loans.removeItems);

  // Filter out collections that are already in this loan
  const availableCollections = useMemo(() => {
    if (!collections?.page) return [];
    return collections.page.filter((collection) => {
      // Don't show collections already in this loan
      return !loanItems.some(
        (item) => item.collectionId === collection._id,
      );
    });
  }, [collections, loanItems]);

  // Reset search when dialog closes
  const handleDialogOpenChange = (open: boolean) => {
    setIsAddDialogOpen(open);
    if (!open) {
      setSearchQuery("");
      setSelectedCollectionIds([]);
      setConditionOut("");
      setError(null);
    }
  };

  const canAddItems =
    loanStatus === "pending" || loanStatus === "active";
  const canRemoveItems = loanStatus === "pending";

  const handleAddItems = async () => {
    if (selectedCollectionIds.length === 0) {
      setError("Please select at least one collection");
      return;
    }

    setError(null);
    try {
      await addItems({
        loanId: loanId as Id<"loans">,
        collectionIds: selectedCollectionIds as Id<"collections">[],
        conditionOut: conditionOut || undefined,
      });
      setSelectedCollectionIds([]);
      setConditionOut("");
      setIsAddDialogOpen(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to add items to loan",
      );
    }
  };

  const handleRemoveItem = async (loanItemId: string) => {
    setError(null);
    try {
      await removeItems({
        loanId: loanId as Id<"loans">,
        loanItemIds: [loanItemId as Id<"loanItems">],
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to remove item from loan",
      );
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">
          Loan Items ({loanItems.length})
        </h3>
        {canAddItems && (
          <PermissionGate permission="loans.update">
            <Dialog open={isAddDialogOpen} onOpenChange={handleDialogOpenChange}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Items
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add Items to Loan</DialogTitle>
                  <DialogDescription>
                    Search and select collections to add to this loan
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>
                      Search and Select Collections *
                    </Label>
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
                        Loading collections...
                      </p>
                    ) : availableCollections.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {searchQuery
                          ? "No collections found matching your search"
                          : "No available collections to add"}
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
                                {isSelected && (
                                  <X className="h-4 w-4" />
                                )}
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
                                  {collection?.accessionNumber} -{" "}
                                  {collection?.title}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelectedCollectionIds(
                                      selectedCollectionIds.filter(
                                        (i) => i !== id,
                                      ),
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
                  <div className="space-y-2">
                    <Label htmlFor="conditionOut">
                      Condition Out (Optional)
                    </Label>
                    <Input
                      id="conditionOut"
                      value={conditionOut}
                      onChange={(e) => setConditionOut(e.target.value)}
                      placeholder="Condition when leaving"
                    />
                    <p className="text-xs text-muted-foreground">
                      This condition will be applied to all selected items
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsAddDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleAddItems}>
                    Add Items
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </PermissionGate>
        )}
      </div>

      {loanItems.length === 0 ? (
        <div className="rounded-lg border border-border bg-muted/50 p-8 text-center">
          <p className="text-muted-foreground">No items in this loan</p>
        </div>
      ) : (
        <div className="space-y-3">
          {loanItems.map((item) => (
            <div
              key={item._id}
              className="flex items-center justify-between rounded-lg border border-border bg-card p-4"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/collections/${item.collectionId}`}
                    className="font-medium hover:underline"
                  >
                    {item.accessionNumber}
                  </Link>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-muted-foreground">{item.title}</span>
                </div>
                {item.conditionOut && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Condition Out: {item.conditionOut}
                  </p>
                )}
                {item.conditionIn && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Condition In: {item.conditionIn}
                  </p>
                )}
                {item.notes && (
                  <p className="mt-1 text-sm">{item.notes}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/collections/${item.collectionId}`}>
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </Button>
                {canRemoveItems && (
                  <PermissionGate permission="loans.update">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove Item from Loan</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to remove this item from the loan? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleRemoveItem(item._id)}>
                            Remove Item
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </PermissionGate>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

