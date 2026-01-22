"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AutoSaveStatus = "idle" | "saving" | "saved" | "error";

interface UseAutoSaveOptions<T> {
  /** Data to auto-save */
  data: T;
  /** Function to save the data - should return a promise */
  onSave: (data: T) => Promise<void>;
  /** Debounce delay in ms (default: 2000) */
  debounceMs?: number;
  /** Whether auto-save is enabled (default: true) */
  enabled?: boolean;
  /** Callback when save succeeds */
  onSuccess?: () => void;
  /** Callback when save fails */
  onError?: (error: Error) => void;
  /** Compare function to detect changes (default: JSON.stringify comparison) */
  hasChanged?: (prev: T, current: T) => boolean;
}

interface UseAutoSaveReturn {
  /** Current save status */
  status: AutoSaveStatus;
  /** Last saved timestamp */
  lastSaved: Date | null;
  /** Whether there are unsaved changes */
  isDirty: boolean;
  /** Manually trigger save */
  save: () => Promise<void>;
  /** Reset dirty state (e.g., after manual save) */
  resetDirty: () => void;
  /** Error message if save failed */
  error: string | null;
}

const defaultHasChanged = <T,>(prev: T, current: T): boolean => {
  return JSON.stringify(prev) !== JSON.stringify(current);
};

export function useAutoSave<T>({
  data,
  onSave,
  debounceMs = 2000,
  enabled = true,
  onSuccess,
  onError,
  hasChanged = defaultHasChanged,
}: UseAutoSaveOptions<T>): UseAutoSaveReturn {
  const [status, setStatus] = useState<AutoSaveStatus>("idle");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialDataRef = useRef<T>(data);
  const lastSavedDataRef = useRef<T>(data);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Track if data has changed from last saved state
  useEffect(() => {
    const changed = hasChanged(lastSavedDataRef.current, data);
    setIsDirty(changed);
  }, [data, hasChanged]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const performSave = useCallback(async () => {
    if (!isMountedRef.current) return;

    setStatus("saving");
    setError(null);

    try {
      await onSave(data);

      if (!isMountedRef.current) return;

      lastSavedDataRef.current = data;
      setLastSaved(new Date());
      setStatus("saved");
      setIsDirty(false);
      onSuccess?.();

      // Reset status to idle after showing "saved" briefly
      setTimeout(() => {
        if (isMountedRef.current) {
          setStatus("idle");
        }
      }, 2000);
    } catch (err) {
      if (!isMountedRef.current) return;

      const errorMessage =
        err instanceof Error ? err.message : "Failed to save";
      setError(errorMessage);
      setStatus("error");
      onError?.(err instanceof Error ? err : new Error(errorMessage));
    }
  }, [data, onSave, onSuccess, onError]);

  // Auto-save with debounce
  useEffect(() => {
    if (!enabled || !isDirty) return;

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout for debounced save
    timeoutRef.current = setTimeout(() => {
      performSave();
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, enabled, isDirty, debounceMs, performSave]);

  const save = useCallback(async () => {
    // Clear any pending auto-save
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    await performSave();
  }, [performSave]);

  const resetDirty = useCallback(() => {
    lastSavedDataRef.current = data;
    initialDataRef.current = data;
    setIsDirty(false);
  }, [data]);

  return {
    status,
    lastSaved,
    isDirty,
    save,
    resetDirty,
    error,
  };
}
