"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { useMemo, useState } from "react";
import { useCustodyConflictMessage } from "@/hooks/use-custody-conflict-message";
import { useLoanObjectErrorMessage } from "@/hooks/use-loan-object-error-message";
import {
  type SelectableObject,
  useObjectSearchSelection,
} from "@/hooks/use-object-search-selection";
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
  const loanObjectErrorMessage = useLoanObjectErrorMessage();
  const custodyConflictMessage = useCustodyConflictMessage();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isReturnDialogOpen, setIsReturnDialogOpen] = useState(false);
  const [selectedItemToReturn, setSelectedItemToReturn] =
    useState<ItemToReturn | null>(null);
  const [conditionIn, setConditionIn] = useState("");
  const [returnNotes, setReturnNotes] = useState("");
  // Selected objects keep their labels when a new search replaces the results.
  const [selectedObjects, setSelectedObjects] = useState<SelectableObject[]>(
    [],
  );
  const [conditionOut, setConditionOut] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const picker = useObjectSearchSelection({
    organizationId: organizationId
      ? (organizationId as Id<"organizations">)
      : undefined,
    query: searchQuery,
    status: "active",
    enabled: isAddDialogOpen,
  });
  const selectedCollectionIds = useMemo(
    () => selectedObjects.map((object) => object._id),
    [selectedObjects],
  );
  const toggleSelection = (object: SelectableObject) =>
    setSelectedObjects((current) =>
      current.some((selected) => selected._id === object._id)
        ? current.filter((selected) => selected._id !== object._id)
        : [...current, object],
    );

  const addItems = useMutation(api.loans.addItems);
  const removeItems = useMutation(api.loans.removeItems);
  const returnItem = useMutation(api.loans.returnItem);

  const availableCollections = useMemo(() => {
    return picker.items.filter((collection) => {
      return !loanItems.some((item) => item.collectionId === collection._id);
    });
  }, [picker.items, loanItems]);

  const handleDialogOpenChange = (open: boolean) => {
    setIsAddDialogOpen(open);
    if (!open) {
      setSearchQuery("");
      setSelectedObjects([]);
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
        collectionIds: selectedCollectionIds,
        conditionOut: conditionOut || undefined,
      });
      setSelectedObjects([]);
      setConditionOut("");
      setIsAddDialogOpen(false);
    } catch (err) {
      setError(loanObjectErrorMessage(err) ?? tActions("failedToAddItems"));
    }
  };

  const handleRemoveItem = async (loanItemId: string) => {
    setError(null);
    try {
      await removeItems({
        loanId: loanId as Id<"loans">,
        loanItemIds: [loanItemId as Id<"loanItems">],
      });
    } catch {
      setError(tActions("failedToRemoveItem"));
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
      setError(custodyConflictMessage(err, tActions("failedToReturnItem")));
    }
  };

  return {
    error,
    isAddDialogOpen,
    handleDialogOpenChange,
    canAddItems,
    canRemoveItems,
    canReturnItems,
    picker,
    availableCollections,
    searchQuery,
    setSearchQuery,
    selectedObjects,
    toggleSelection,
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
