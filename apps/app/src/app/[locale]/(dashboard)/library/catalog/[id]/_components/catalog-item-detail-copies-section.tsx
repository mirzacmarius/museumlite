"use client";

import { useScopedI18n } from "@/locales/client";
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
import { Copy, Loader2, MapPin, Plus, Trash2 } from "lucide-react";
import { CatalogItemCopyStatusBadge } from "./catalog-item-detail-ui";
import type { CatalogItemDetailViewProps } from "./catalog-item-detail-view-props";

export function CatalogItemDetailCopiesSection({
  item,
  copies,
  getConditionLabel,
  handleDeleteCopy,
  setIsAddCopyOpen,
}: Pick<
  CatalogItemDetailViewProps,
  | "item"
  | "copies"
  | "getConditionLabel"
  | "handleDeleteCopy"
  | "setIsAddCopyOpen"
>) {
  const tDetail = useScopedI18n("library.catalog.detail");
  const tCommon = useScopedI18n("common");

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border p-6">
        <div>
          <h2 className="text-lg font-medium">{tDetail("copies")}</h2>
          <p className="text-sm text-muted-foreground">
            {tDetail("totalAvailable", {
              total: item.totalCopies,
              available: item.availableCopies,
            })}
          </p>
        </div>
        <Button onClick={() => setIsAddCopyOpen(true)}>
          <Plus className="mr-2 size-4" />
          {tDetail("addCopy")}
        </Button>
      </div>
      <div className="p-6">
        {copies === undefined ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : copies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Copy className="size-12 text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">
              {tDetail("noCopiesYet")}
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setIsAddCopyOpen(true)}
            >
              <Plus className="mr-2 size-4" />
              {tDetail("addFirstCopy")}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {copies.map((copy) => (
              <div
                key={copy._id}
                className="flex items-center justify-between rounded-lg border border-border p-4"
              >
                <div className="flex items-center gap-4">
                  <div>
                    <p className="font-mono text-sm font-medium">
                      {copy.barcode}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                      <span>
                        {tDetail("copyNumber")}
                        {copy.copyNumber}
                      </span>
                      <span>|</span>
                      <span className="capitalize">
                        {getConditionLabel(copy.condition)}
                      </span>
                      {copy.shelfLocation ? (
                        <>
                          <span>|</span>
                          <MapPin className="size-3" />
                          <span>{copy.shelfLocation}</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <CatalogItemCopyStatusBadge status={copy.status} />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={copy.status === "checked_out"}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {tDetail("deleteCopyTitle")}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {tDetail("deleteCopyDescription", {
                            barcode: copy.barcode,
                          })}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>
                          {tCommon("cancel")}
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeleteCopy(copy._id)}
                        >
                          {tCommon("delete")}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
