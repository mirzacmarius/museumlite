"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useCallback } from "react";
import { clearRecoveredInputs } from "@/lib/record-form-recovery";

/** Signs out and removes unsaved form input kept on this device. */
export function useSignOut() {
  const { signOut } = useAuthActions();
  return useCallback(() => {
    clearRecoveredInputs();
    return signOut();
  }, [signOut]);
}
