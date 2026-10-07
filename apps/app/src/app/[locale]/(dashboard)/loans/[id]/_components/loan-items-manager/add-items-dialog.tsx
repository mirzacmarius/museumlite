"use client";

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
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Plus, Search, X } from "lucide-react";
import { PermissionGate } from "@/components/permission-gate";
import { useI18n, useScopedI18n } from "@/locales/client";
import type { useLoanItemsManager } from "./use-loan-items-manager";

type LoanItemsManagerState = ReturnType<typeof useLoanItemsManager>;

interface AddItemsDialogProps {
  manager: LoanItemsManagerState;
}

export function AddItemsDialog({ manager }: AddItemsDialogProps) {
  const tRoot = useI18n();
  const t = useScopedI18n("loans.placeholders");
  const tActions = useScopedI18n("loans.actions");

  if (!manager.canAddItems) {
    return null;
  }

  return (
    <PermissionGate permission="loans.update">
      <Dialog
        open={manager.isAddDialogOpen}
        onOpenChange={manager.handleDialogOpenChange}
      >
        <DialogTrigger asChild>
          <Button size="sm">
            <Plus className="mr-2 size-4" />
            {tRoot("loans.actions.addItems")}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{tRoot("loans.actions.addItemsToLoan")}</DialogTitle>
            <DialogDescription>
              {tRoot("loans.actions.searchSelectCollections")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>
                {tRoot("untranslatedRecords.loans.items.searchCollections")}
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t("searchCollections")}
                  value={manager.searchQuery}
                  onChange={(e) => manager.setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              {!manager.isCollectionListComplete &&
              manager.collections.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {tRoot("untranslatedRecords.loans.items.loadingCollections")}
                </p>
              ) : manager.availableCollections.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {manager.searchQuery
                    ? tActions("noCollectionsFound")
                    : tActions("noAvailableCollections")}
                </p>
              ) : (
                <div className="max-h-[200px] space-y-1 overflow-y-auto rounded-md border border-border p-2">
                  {manager.availableCollections.map((collection) => {
                    const isSelected = manager.selectedCollectionIds.includes(
                      collection._id,
                    );
                    return (
                      <button
                        key={collection._id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            manager.setSelectedCollectionIds((prev) =>
                              prev.filter((id) => id !== collection._id),
                            );
                          } else {
                            manager.setSelectedCollectionIds((prev) => [
                              ...prev,
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
                          {isSelected && <X className="size-4" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              {manager.selectedCollectionIds.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    {tRoot("loans.actions.selectedCount", {
                      count: manager.selectedCollectionIds.length,
                    })}
                    :
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {manager.selectedCollectionIds.map((id) => {
                      const collection = manager.collections.find(
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
                              manager.setSelectedCollectionIds(
                                manager.selectedCollectionIds.filter(
                                  (i) => i !== id,
                                ),
                              )
                            }
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="size-3" />
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
                {tRoot("untranslatedRecords.loans.items.conditionOutOptional")}
              </Label>
              <Input
                id="conditionOut"
                value={manager.conditionOut}
                onChange={(e) => manager.setConditionOut(e.target.value)}
                placeholder={t("conditionOut")}
              />
              <p className="text-xs text-muted-foreground">
                {tRoot("untranslatedRecords.loans.items.conditionHint")}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => manager.handleDialogOpenChange(false)}
            >
              {tRoot("loans.actions.cancel")}
            </Button>
            <Button onClick={manager.handleAddItems}>
              {tRoot("loans.actions.addItems")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PermissionGate>
  );
}
