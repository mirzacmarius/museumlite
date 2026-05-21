"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { useState } from "react";
import type {
  CheckinResult,
  SelectedCopy,
  SelectedPatron,
} from "./circulation-types";

interface UseLibraryCirculationOptions {
  patronLookup: SelectedPatron | null | undefined;
  copyLookup: SelectedCopy | null | undefined;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
}

export function useLibraryCirculation({
  patronLookup,
  copyLookup,
  searchQuery,
  setSearchQuery,
}: UseLibraryCirculationOptions) {
  const [selectedPatron, setSelectedPatron] = useState<SelectedPatron | null>(
    null,
  );
  const [selectedCopy, setSelectedCopy] = useState<SelectedCopy | null>(null);
  const [isCheckoutDialogOpen, setIsCheckoutDialogOpen] = useState(false);
  const [isCheckinDialogOpen, setIsCheckinDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkinResult, setCheckinResult] = useState<CheckinResult | null>(
    null,
  );

  const checkout = useMutation(api.library.circulation.checkout);
  const checkin = useMutation(api.library.circulation.checkin);
  const renew = useMutation(api.library.circulation.renew);

  const handleScan = async () => {
    if (!searchQuery.trim()) return;

    if (patronLookup) {
      setSelectedPatron(patronLookup);
      setIsCheckoutDialogOpen(true);
      return;
    }

    if (copyLookup?.copy) {
      if (copyLookup.circulation) {
        setSelectedCopy(copyLookup);
        setIsCheckinDialogOpen(true);
      } else {
        setSelectedCopy(copyLookup);
        setIsCheckoutDialogOpen(true);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      void handleScan();
    }
  };

  const handleCheckout = async (
    accountId: Id<"accounts">,
    copyId: Id<"itemCopies">,
  ) => {
    setIsProcessing(true);
    try {
      await checkout({ accountId, copyId });
      setIsCheckoutDialogOpen(false);
      setSelectedPatron(null);
      setSelectedCopy(null);
      setSearchQuery("");
    } catch (error) {
      console.error("Checkout failed:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCheckin = async (circulationId: Id<"circulations">) => {
    setIsProcessing(true);
    try {
      const result = await checkin({ circulationId });
      setCheckinResult(result);
    } catch (error) {
      console.error("Checkin failed:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRenew = async (circulationId: Id<"circulations">) => {
    setIsProcessing(true);
    try {
      await renew({ circulationId });
    } catch (error) {
      console.error("Renewal failed:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const resetCheckinFlow = () => {
    setIsCheckinDialogOpen(false);
    setSelectedCopy(null);
    setCheckinResult(null);
    setSearchQuery("");
  };

  const resetCheckoutFlow = () => {
    setIsCheckoutDialogOpen(false);
    setSelectedPatron(null);
    setSelectedCopy(null);
  };

  const cancelCheckinDialog = () => {
    setIsCheckinDialogOpen(false);
    setSelectedCopy(null);
  };

  return {
    searchQuery,
    setSearchQuery,
    selectedPatron,
    selectedCopy,
    isCheckoutDialogOpen,
    setIsCheckoutDialogOpen,
    isCheckinDialogOpen,
    setIsCheckinDialogOpen,
    isProcessing,
    checkinResult,
    handleScan,
    handleKeyDown,
    handleCheckout,
    handleCheckin,
    handleRenew,
    resetCheckinFlow,
    resetCheckoutFlow,
    cancelCheckinDialog,
  };
}
