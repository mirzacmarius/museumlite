"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { useMemo, useState } from "react";
import { useDrainedCollectionList } from "@/hooks/use-drained-collection-list";
import { useScopedI18n } from "@/locales/client";
import type { ItemToReturn, ManagedLoanItem } from "./types";

interface UseLoanItemsManagerOptions {
  loanId: string;
  loanItems: ManagedLoanItem[];
  organizationId: string;
  loanStatus: string;
}

export function useLoanItemsManager({
  loanId,
  loanItems,
  organizationId,
  loanStatus,
}: UseLoanItemsManagerOptions) {
  const tActions = useScopedI18n("loans.actions");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isReturnDialogOpen, setIsReturnDialogOpen] = useState(false);
  const [selectedItemToReturn, setSelectedItemToReturn] =
    useState<ItemToReturn | null>(null);
  const [conditionIn, setConditionIn] = useState("");
  const [returnNotes, setReturnNotes] = useState("");
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>(
    [],
  );
  const [conditionOut, setConditionOut] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { items: collections, isComplete: isCollectionListComplete } =
    useDrainedCollectionList(
      organizationId && isAddDialogOpen
        ? {
            organizationId: organizationId as Id<"organizations">,
            status: "active",
            search: searchQuery || undefined,
          }
        : "skip",
    );

  const addItems = useMutation(api.loans.addItems);
  const removeItems = useMutation(api.loans.removeItems);
  const returnItem = useMutation(api.loans.returnItem);

  const availableCollections = useMemo(() => {
    return collections.filter((collection) => {
      return !loanItems.some((item) => item.collectionId === collection._id);
    });
  }, [collections, loanItems]);

  const handleDialogOpenChange = (open: boolean) => {
    setIsAddDialogOpen(open);
    if (!open) {
      setSearchQuery("");
      setSelectedCollectionIds([]);
      setConditionOut("");
      setError(null);
    }
  };

  const canAddItems = loanStatus === "pending" || loanStatus === "active";
  const canRemoveItems = loanStatus === "pending";
  const canReturnItems = loanStatus === "active";

  const handleAddItems = async () => {
    if (selectedCollectionIds.length === 0) {
      setError(tActions("pleaseSelectAtLeastOneCollection"));
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
        err instanceof Error ? err.message : tActions("failedToAddItems"),
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
        err instanceof Error ? err.message : tActions("failedToRemoveItem"),
      );
    }
  };

  const handleReturnItemClick = (item: ManagedLoanItem) => {
    setSelectedItemToReturn({
      id: item._id,
      accessionNumber: item.accessionNumber,
      title: item.title,
      collectionId: item.collectionId,
    });
    setConditionIn("");
    setReturnNotes("");
    setIsReturnDialogOpen(true);
  };

  const handleReturnItemConfirm = async () => {
    if (!selectedItemToReturn) return;

    setError(null);
    try {
      await returnItem({
        loanId: loanId as Id<"loans">,
        collectionId: selectedItemToReturn.collectionId as Id<"collections">,
        conditionIn: conditionIn || undefined,
        notes: returnNotes || undefined,
      });
      setIsReturnDialogOpen(false);
      setSelectedItemToReturn(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : tActions("failedToReturnItem"),
      );
    }
  };

  return {
    error,
    isAddDialogOpen,
    handleDialogOpenChange,
    canAddItems,
    canRemoveItems,
    canReturnItems,
    collections,
    isCollectionListComplete,
    availableCollections,
    searchQuery,
    setSearchQuery,
    selectedCollectionIds,
    setSelectedCollectionIds,
    conditionOut,
    setConditionOut,
    handleAddItems,
    handleRemoveItem,
    handleReturnItemClick,
    isReturnDialogOpen,
    setIsReturnDialogOpen,
    selectedItemToReturn,
    conditionIn,
    setConditionIn,
    returnNotes,
    setReturnNotes,
    handleReturnItemConfirm,
  };
}
