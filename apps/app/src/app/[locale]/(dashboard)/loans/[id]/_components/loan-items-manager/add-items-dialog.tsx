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
import { ObjectPickerResults } from "@/components/object-picker-results";
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
              <ObjectPickerResults
                objects={manager.availableCollections}
                selectedIds={
                  new Set(manager.selectedObjects.map((object) => object._id))
                }
                onToggle={manager.toggleSelection}
                picker={manager.picker}
                loadingLabel={tRoot(
                  "untranslatedRecords.loans.items.loadingCollections",
                )}
                emptyLabel={
                  manager.searchQuery
                    ? tActions("noCollectionsFound")
                    : tActions("noAvailableCollections")
                }
              />
              {manager.selectedObjects.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    {tRoot("loans.actions.selectedCount", {
                      count: manager.selectedObjects.length,
                    })}
                    :
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {manager.selectedObjects.map((collection) => (
                      <div
                        key={collection._id}
                        className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-sm"
                      >
                        <span>
                          {collection.accessionNumber} - {collection.title}
                        </span>
                        <button
                          type="button"
                          onClick={() => manager.toggleSelection(collection)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    ))}
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
