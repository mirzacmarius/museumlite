"use client";

import { useCallback, useState } from "react";

interface UseFormNavigationGuardOptions {
  hasUnsavedChanges: boolean;
  onNavigate: (href: string) => void;
  onSaveBeforeNavigate: () => Promise<boolean>;
}

export function useFormNavigationGuard({
  hasUnsavedChanges,
  onNavigate,
  onSaveBeforeNavigate,
}: UseFormNavigationGuardOptions) {
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(
    null,
  );

  const handleNavigate = useCallback(
    (href: string) => {
      if (hasUnsavedChanges) {
        setPendingNavigation(href);
        setShowUnsavedDialog(true);
        return;
      }

      onNavigate(href);
    },
    [hasUnsavedChanges, onNavigate],
  );

  const handleDiscardAndNavigate = useCallback(() => {
    if (pendingNavigation) {
      onNavigate(pendingNavigation);
    }
    setShowUnsavedDialog(false);
    setPendingNavigation(null);
  }, [onNavigate, pendingNavigation]);

  const handleSaveAndNavigate = useCallback(async () => {
    const didSave = await onSaveBeforeNavigate();
    if (!didSave) {
      return false;
    }

    if (pendingNavigation) {
      onNavigate(pendingNavigation);
    }
    setPendingNavigation(null);
    return true;
  }, [onNavigate, onSaveBeforeNavigate, pendingNavigation]);

  return {
    showUnsavedDialog,
    setShowUnsavedDialog,
    handleNavigate,
    handleDiscardAndNavigate,
    handleSaveAndNavigate,
  };
}
