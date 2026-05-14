"use client";

import { PermissionGate } from "@/components/permission-gate";
import { pluralize } from "@/lib/utils/pluralize";
import { useScopedI18n } from "@/locales/client";
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
import { Checkbox } from "@v1/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { Label } from "@v1/ui/label";
import { cn } from "@v1/ui/utils";
import { useMutation, useQuery } from "convex/react";
import { CheckCircle, Info, Truck, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

interface LoanApprovalWorkflowProps {
  loanId: string;
  loanStatus: string;
}

export function LoanApprovalWorkflow({
  loanId,
  loanStatus,
}: LoanApprovalWorkflowProps) {
  const t = useScopedI18n("loans.actions");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isReturnDialogOpen, setIsReturnDialogOpen] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(
    new Set(),
  );
  const [pendingReturnItemIds, setPendingReturnItemIds] = useState<string[]>(
    [],
  );

  const approveLoan = useMutation(api.loans.approve);
  const dispatchLoan = useMutation(api.loans.dispatch);
  const returnLoan = useMutation(api.loans.returnLoan);
  const cancelLoan = useMutation(api.loans.cancel);

  // Get loan details to check item count
  const loan = useQuery(api.loans.get, {
    loanId: loanId as Id<"loans">,
  });

  const loanItems = loan?.items || [];
  const hasMultipleItems = loanItems.length > 1;

  // Reset selected items when both dialogs are closed
  useEffect(() => {
    if (!isReturnDialogOpen && !isConfirmDialogOpen) {
      setSelectedItemIds(new Set());
      setPendingReturnItemIds([]);
    } else if (!isReturnDialogOpen && isConfirmDialogOpen) {
      // When moving from selection to confirmation, only reset selectedItemIds
      // Keep pendingReturnItemIds intact
      setSelectedItemIds(new Set());
    }
  }, [isReturnDialogOpen, isConfirmDialogOpen]);

  // Filter out returned items from selection when loan items update or dialog opens
  useEffect(() => {
    if (loanItems.length > 0 && isReturnDialogOpen) {
      setSelectedItemIds((prev) => {
        const newSet = new Set(prev);
        let changed = false;
        loanItems.forEach(
          (item: { _id: Id<"loanItems">; conditionIn?: string }) => {
            // An item is returned if conditionIn exists and is not empty
            // Use safe check that handles undefined, null, and empty strings
            const hasConditionIn =
              item.conditionIn != null &&
              String(item.conditionIn).trim().length > 0;
            if (hasConditionIn && newSet.has(item._id)) {
              newSet.delete(item._id);
              changed = true;
            }
          },
        );
        return changed ? newSet : prev;
      });
    }
  }, [loanItems, isReturnDialogOpen]);

  if (loanStatus === "pending") {
    const handleApprove = async () => {
      setIsSubmitting(true);
      setError(null);
      try {
        await approveLoan({
          loanId: loanId as Id<"loans">,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : t("failedToApprove"));
      } finally {
        setIsSubmitting(false);
      }
    };

    const handleCancel = async () => {
      setIsSubmitting(true);
      setError(null);
      try {
        await cancelLoan({
          loanId: loanId as Id<"loans">,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : t("failedToCancel"));
      } finally {
        setIsSubmitting(false);
      }
    };

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-medium">{t("loanActions")}</h3>
        {error && (
          <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <div className="flex gap-4">
          <PermissionGate permission="loans.approve">
            <Button
              onClick={handleApprove}
              disabled={isSubmitting}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="mr-2 size-4" />
              {t("approveLoan")}
            </Button>
          </PermissionGate>
          <PermissionGate permission="loans.update">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button disabled={isSubmitting} variant="destructive">
                  <XCircle className="mr-2 size-4" />
                  {t("cancelLoan")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("cancelLoan")}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("cancelLoanConfirm")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("keepLoan")}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleCancel}>
                    {t("cancelLoan")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </PermissionGate>
        </div>
      </div>
    );
  }

  if (loanStatus === "active") {
    const handleDispatch = async () => {
      setIsSubmitting(true);
      setError(null);
      try {
        await dispatchLoan({
          loanId: loanId as Id<"loans">,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : t("failedToDispatch"));
      } finally {
        setIsSubmitting(false);
      }
    };

    const handleReturnClick = () => {
      if (hasMultipleItems && loanItems.length > 0) {
        // Open dialog for item selection - start with nothing selected
        // Explicitly filter out already returned items
        const nonReturnedItems = loanItems
          .filter((item: { _id: Id<"loanItems">; conditionIn?: string }) => {
            // An item is returned if conditionIn exists and is not empty
            return !(item.conditionIn && item.conditionIn.trim().length > 0);
          })
          .map((item: { _id: Id<"loanItems"> }) => item._id);
        setSelectedItemIds(new Set());
        setIsReturnDialogOpen(true);
      } else {
        // Single item or no items - return directly
        handleReturn([]);
      }
    };

    const handleProceedToConfirm = () => {
      if (selectedItemIds.size === 0) {
        setError(t("selectAtLeastOne"));
        return;
      }
      // Store selected items first (before closing dialog to prevent reset)
      const itemsToReturn = Array.from(selectedItemIds);
      setPendingReturnItemIds(itemsToReturn);
      // Then close selection dialog and open confirmation
      setIsReturnDialogOpen(false);
      setIsConfirmDialogOpen(true);
    };

    const handleReturn = async (itemIdsToReturn: string[] = []) => {
      setIsSubmitting(true);
      setError(null);
      try {
        await returnLoan({
          loanId: loanId as Id<"loans">,
          loanItemIds:
            itemIdsToReturn.length > 0
              ? (itemIdsToReturn as Id<"loanItems">[])
              : undefined, // If empty, return all items
        });
        // Close dialogs and clear state
        setIsReturnDialogOpen(false);
        setIsConfirmDialogOpen(false);
        setSelectedItemIds(new Set());
        setPendingReturnItemIds([]);
        // The query will automatically refresh, and the useEffect will filter out returned items
      } catch (err) {
        setError(err instanceof Error ? err.message : t("failedToReturn"));
        setIsConfirmDialogOpen(false);
      } finally {
        setIsSubmitting(false);
      }
    };

    const isFullReturn = pendingReturnItemIds.length === loanItems.length;
    const isPartialReturn =
      pendingReturnItemIds.length > 0 &&
      pendingReturnItemIds.length < loanItems.length;

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-medium">{t("loanActions")}</h3>
        {error && (
          <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <div className="flex gap-4">
          <PermissionGate permission="loans.update">
            <Button
              onClick={handleDispatch}
              disabled={isSubmitting}
              className="bg-cyan-600 hover:bg-cyan-700"
            >
              <Truck className="mr-2 size-4" />
              {t("dispatchLoan")}
            </Button>
          </PermissionGate>
          <PermissionGate permission="loans.update">
            {hasMultipleItems ? (
              <>
                <Button
                  onClick={handleReturnClick}
                  disabled={isSubmitting}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <CheckCircle className="mr-2 size-4" />
                  {t("markAsReturned")}
                </Button>
                <Dialog
                  open={isReturnDialogOpen}
                  onOpenChange={setIsReturnDialogOpen}
                >
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>{t("returnLoanItems")}</DialogTitle>
                      <DialogDescription>
                        {t("selectItemsToReturnDesc")}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-sm font-medium">
                            {t("selectItemsToReturn")}
                          </Label>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              const nonReturnedItems = loanItems
                                .filter(
                                  (item: {
                                    _id: Id<"loanItems">;
                                    conditionIn?: string;
                                  }) => {
                                    // An item is returned if conditionIn exists and is not empty
                                    return !(
                                      item.conditionIn &&
                                      item.conditionIn.trim().length > 0
                                    );
                                  },
                                )
                                .map(
                                  (item: { _id: Id<"loanItems"> }) => item._id,
                                );
                              setSelectedItemIds(new Set(nonReturnedItems));
                            }}
                          >
                            {t("selectAllItems")}
                          </Button>
                        </div>
                        {loanItems.some(
                          (item: { conditionIn?: string }) =>
                            item.conditionIn != null &&
                            String(item.conditionIn).trim().length > 0,
                        ) && (
                          <div className="flex items-start gap-2 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3 text-sm">
                            <Info className="size-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 text-blue-800 dark:text-blue-200">
                              <p className="font-medium mb-1">
                                {t("someItemsReturned")}
                              </p>
                              <p className="text-xs">
                                {t("returnedItemsInfo")}
                              </p>
                            </div>
                          </div>
                        )}
                        <div className="border rounded-lg divide-y max-h-[400px] overflow-y-auto">
                          {loanItems.map(
                            (item: {
                              _id: Id<"loanItems">;
                              accessionNumber: string;
                              title: string;
                              conditionIn?: string;
                            }) => {
                              // An item is returned if conditionIn exists (not undefined, not null, not empty string)
                              // Use a safe check that handles undefined/null/empty string
                              const hasConditionIn =
                                item.conditionIn != null &&
                                String(item.conditionIn).trim().length > 0;
                              const isReturned = hasConditionIn;

                              return (
                                <div
                                  key={item._id}
                                  className={cn(
                                    "flex items-center space-x-3 p-3",
                                    isReturned
                                      ? "opacity-50 bg-muted/40 border-l-4 border-l-blue-500"
                                      : "hover:bg-muted/50",
                                  )}
                                >
                                  <Checkbox
                                    id={`item-${item._id}`}
                                    checked={
                                      selectedItemIds.has(item._id) &&
                                      !isReturned
                                    }
                                    disabled={isReturned}
                                    onCheckedChange={(checked) => {
                                      if (isReturned) {
                                        // Double-check: if item is returned, don't allow selection
                                        return;
                                      }
                                      const newSet = new Set(selectedItemIds);
                                      if (checked) {
                                        newSet.add(item._id);
                                      } else {
                                        newSet.delete(item._id);
                                      }
                                      setSelectedItemIds(newSet);
                                    }}
                                  />
                                  <Label
                                    htmlFor={`item-${item._id}`}
                                    className={cn(
                                      "flex-1",
                                      isReturned
                                        ? "cursor-not-allowed"
                                        : "cursor-pointer",
                                    )}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span
                                        className={cn(
                                          "font-medium",
                                          isReturned && "line-through",
                                        )}
                                      >
                                        {item.accessionNumber}
                                      </span>
                                      {isReturned && (
                                        <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded">
                                          {t("returned")}
                                        </span>
                                      )}
                                    </div>
                                    <div
                                      className={cn(
                                        "text-sm",
                                        isReturned
                                          ? "text-muted-foreground"
                                          : "text-muted-foreground",
                                      )}
                                    >
                                      {item.title}
                                    </div>
                                    {isReturned && item.conditionIn && (
                                      <div className="text-xs text-muted-foreground mt-1">
                                        {t("conditionInLabel")}:{" "}
                                        {item.conditionIn}
                                      </div>
                                    )}
                                  </Label>
                                </div>
                              );
                            },
                          )}
                        </div>
                        {selectedItemIds.size === 0 && (
                          <p className="text-sm text-destructive">
                            {t("selectAtLeastOne")}
                          </p>
                        )}
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsReturnDialogOpen(false);
                          setSelectedItemIds(new Set());
                        }}
                      >
                        {t("cancel")}
                      </Button>
                      <Button
                        onClick={handleProceedToConfirm}
                        disabled={selectedItemIds.size === 0}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {t("continueAction")}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <AlertDialog
                  open={isConfirmDialogOpen}
                  onOpenChange={setIsConfirmDialogOpen}
                >
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {isFullReturn
                          ? t("confirmFullReturn")
                          : t("confirmPartialReturn")}
                      </AlertDialogTitle>
                      <AlertDialogDescription asChild>
                        <div className="space-y-2">
                          {isFullReturn ? (
                            <>
                              <div className="font-medium">
                                {t("fullReturnTitle", {
                                  count: loanItems.length,
                                  items: pluralize(loanItems.length, "item"),
                                })}
                              </div>
                              <div>{t("fullReturnDescription")}</div>
                            </>
                          ) : (
                            <>
                              <div className="font-medium">
                                {t("partialReturnTitle", {
                                  returnCount: pendingReturnItemIds.length,
                                  totalCount: loanItems.length,
                                  items: pluralize(loanItems.length, "item"),
                                })}
                              </div>
                              <div>
                                {t("partialReturnDescription")}{" "}
                                {t("remainingItems", {
                                  count:
                                    loanItems.length -
                                    pendingReturnItemIds.length,
                                  items: pluralize(
                                    loanItems.length -
                                      pendingReturnItemIds.length,
                                    "item",
                                  ),
                                })}
                              </div>
                            </>
                          )}
                          <div className="pt-2 text-sm text-muted-foreground">
                            {t("confirmProceed")}
                          </div>
                        </div>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel
                        onClick={() => {
                          setIsConfirmDialogOpen(false);
                          setIsReturnDialogOpen(true);
                        }}
                      >
                        {t("goBack")}
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleReturn(pendingReturnItemIds)}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {isSubmitting
                          ? t("returning")
                          : isFullReturn
                            ? t("returnAllItems")
                            : t("confirmPartialReturn")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    disabled={isSubmitting}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <CheckCircle className="mr-2 size-4" />
                    {t("markAsReturned")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("markAsReturned")}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("markAsReturnedConfirm")}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleReturn([])}>
                      {t("markAsReturned")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </PermissionGate>
        </div>
      </div>
    );
  }

  if (loanStatus === "dispatched") {
    const handleReturnClick = () => {
      if (hasMultipleItems && loanItems.length > 0) {
        // Open dialog for item selection - start with nothing selected
        // Explicitly filter out already returned items
        const nonReturnedItems = loanItems
          .filter((item: { _id: Id<"loanItems">; conditionIn?: string }) => {
            // An item is returned if conditionIn exists and is not empty
            return !(item.conditionIn && item.conditionIn.trim().length > 0);
          })
          .map((item: { _id: Id<"loanItems"> }) => item._id);
        setSelectedItemIds(new Set());
        setIsReturnDialogOpen(true);
      } else {
        // Single item or no items - return directly
        handleReturn([]);
      }
    };

    const handleProceedToConfirm = () => {
      if (selectedItemIds.size === 0) {
        setError(t("selectAtLeastOne"));
        return;
      }
      // Store selected items first (before closing dialog to prevent reset)
      const itemsToReturn = Array.from(selectedItemIds);
      setPendingReturnItemIds(itemsToReturn);
      // Then close selection dialog and open confirmation
      setIsReturnDialogOpen(false);
      setIsConfirmDialogOpen(true);
    };

    const handleReturn = async (itemIdsToReturn: string[] = []) => {
      setIsSubmitting(true);
      setError(null);
      try {
        await returnLoan({
          loanId: loanId as Id<"loans">,
          loanItemIds:
            itemIdsToReturn.length > 0
              ? (itemIdsToReturn as Id<"loanItems">[])
              : undefined, // If empty, return all items
        });
        // Close dialogs and clear state
        setIsReturnDialogOpen(false);
        setIsConfirmDialogOpen(false);
        setSelectedItemIds(new Set());
        setPendingReturnItemIds([]);
        // The query will automatically refresh, and the useEffect will filter out returned items
      } catch (err) {
        setError(err instanceof Error ? err.message : t("failedToReturn"));
        setIsConfirmDialogOpen(false);
      } finally {
        setIsSubmitting(false);
      }
    };

    const isFullReturn = pendingReturnItemIds.length === loanItems.length;
    const isPartialReturn =
      pendingReturnItemIds.length > 0 &&
      pendingReturnItemIds.length < loanItems.length;

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-medium">{t("loanActions")}</h3>
        {error && (
          <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <PermissionGate permission="loans.update">
          {hasMultipleItems ? (
            <>
              <Button
                onClick={handleReturnClick}
                disabled={isSubmitting}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <CheckCircle className="mr-2 size-4" />
                {t("markAsReturned")}
              </Button>
              <Dialog
                open={isReturnDialogOpen}
                onOpenChange={setIsReturnDialogOpen}
              >
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>{t("returnLoanItems")}</DialogTitle>
                    <DialogDescription>
                      {t("selectItemsToReturnDesc")}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-sm font-medium">
                          {t("selectItemsToReturn")}
                        </Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => {
                            const nonReturnedItems = loanItems
                              .filter(
                                (item: {
                                  _id: Id<"loanItems">;
                                  conditionIn?: string;
                                }) => {
                                  // An item is returned if conditionIn exists and is not empty
                                  return !(
                                    item.conditionIn &&
                                    item.conditionIn.trim().length > 0
                                  );
                                },
                              )
                              .map(
                                (item: { _id: Id<"loanItems"> }) => item._id,
                              );
                            setSelectedItemIds(new Set(nonReturnedItems));
                          }}
                        >
                          {t("selectAllItems")}
                        </Button>
                      </div>
                      {loanItems.some(
                        (item: { conditionIn?: string }) =>
                          item.conditionIn != null &&
                          String(item.conditionIn).trim().length > 0,
                      ) && (
                        <div className="flex items-start gap-2 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3 text-sm">
                          <Info className="size-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 text-blue-800 dark:text-blue-200">
                            <p className="font-medium mb-1">
                              {t("someItemsReturned")}
                            </p>
                            <p className="text-xs">{t("returnedItemsInfo")}</p>
                          </div>
                        </div>
                      )}
                      <div className="border rounded-lg divide-y max-h-[400px] overflow-y-auto">
                        {loanItems.map(
                          (item: {
                            _id: Id<"loanItems">;
                            accessionNumber: string;
                            title: string;
                            conditionIn?: string;
                          }) => {
                            // An item is returned if conditionIn exists (not undefined, not null, not empty string)
                            // Use a safe check that handles undefined/null/empty string
                            const hasConditionIn =
                              item.conditionIn != null &&
                              String(item.conditionIn).trim().length > 0;
                            const isReturned = hasConditionIn;

                            return (
                              <div
                                key={item._id}
                                className={cn(
                                  "flex items-center space-x-3 p-3",
                                  isReturned
                                    ? "opacity-50 bg-muted/40 border-l-4 border-l-blue-500"
                                    : "hover:bg-muted/50",
                                )}
                              >
                                <Checkbox
                                  id={`item-${item._id}`}
                                  checked={
                                    selectedItemIds.has(item._id) && !isReturned
                                  }
                                  disabled={isReturned}
                                  onCheckedChange={(checked) => {
                                    if (isReturned) {
                                      // Double-check: if item is returned, don't allow selection
                                      return;
                                    }
                                    const newSet = new Set(selectedItemIds);
                                    if (checked) {
                                      newSet.add(item._id);
                                    } else {
                                      newSet.delete(item._id);
                                    }
                                    setSelectedItemIds(newSet);
                                  }}
                                />
                                <Label
                                  htmlFor={`item-${item._id}`}
                                  className={cn(
                                    "flex-1",
                                    isReturned
                                      ? "cursor-not-allowed"
                                      : "cursor-pointer",
                                  )}
                                >
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={cn(
                                        "font-medium",
                                        isReturned && "line-through",
                                      )}
                                    >
                                      {item.accessionNumber}
                                    </span>
                                    {isReturned && (
                                      <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded">
                                        {t("returned")}
                                      </span>
                                    )}
                                  </div>
                                  <div
                                    className={cn(
                                      "text-sm",
                                      isReturned
                                        ? "text-muted-foreground"
                                        : "text-muted-foreground",
                                    )}
                                  >
                                    {item.title}
                                  </div>
                                  {isReturned && item.conditionIn && (
                                    <div className="text-xs text-muted-foreground mt-1">
                                      {t("conditionInLabel")}:{" "}
                                      {item.conditionIn}
                                    </div>
                                  )}
                                </Label>
                              </div>
                            );
                          },
                        )}
                      </div>
                      {selectedItemIds.size === 0 && (
                        <p className="text-sm text-destructive">
                          {t("selectAtLeastOne")}
                        </p>
                      )}
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsReturnDialogOpen(false);
                        setSelectedItemIds(new Set());
                      }}
                    >
                      {t("cancel")}
                    </Button>
                    <Button
                      onClick={handleProceedToConfirm}
                      disabled={selectedItemIds.size === 0}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {t("continueAction")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <AlertDialog
                open={isConfirmDialogOpen}
                onOpenChange={setIsConfirmDialogOpen}
              >
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {isFullReturn
                        ? t("confirmFullReturn")
                        : t("confirmPartialReturn")}
                    </AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="space-y-2">
                        {isFullReturn ? (
                          <>
                            <div className="font-medium">
                              {t("fullReturnTitle", {
                                count: loanItems.length,
                                items: pluralize(loanItems.length, "item"),
                              })}
                            </div>
                            <div>{t("fullReturnDescription")}</div>
                          </>
                        ) : (
                          <>
                            <div className="font-medium">
                              {t("partialReturnTitle", {
                                returnCount: pendingReturnItemIds.length,
                                totalCount: loanItems.length,
                                items: pluralize(loanItems.length, "item"),
                              })}
                            </div>
                            <div>
                              {t("partialReturnDescription")}{" "}
                              {t("remainingItems", {
                                count:
                                  loanItems.length -
                                  pendingReturnItemIds.length,
                                items: pluralize(
                                  loanItems.length -
                                    pendingReturnItemIds.length,
                                  "item",
                                ),
                              })}
                            </div>
                          </>
                        )}
                        <div className="pt-2 text-sm text-muted-foreground">
                          {t("confirmProceed")}
                        </div>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel
                      onClick={() => {
                        setIsConfirmDialogOpen(false);
                        setIsReturnDialogOpen(true);
                      }}
                    >
                      {t("goBack")}
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleReturn(pendingReturnItemIds)}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {isSubmitting
                        ? t("returning")
                        : isFullReturn
                          ? t("returnAllItems")
                          : t("confirmPartialReturn")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  disabled={isSubmitting}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <CheckCircle className="mr-2 size-4" />
                  {t("markAsReturned")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("markAsReturned")}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("markAsReturnedConfirm")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleReturn([])}>
                    {t("markAsReturned")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </PermissionGate>
      </div>
    );
  }

  return null;
}
