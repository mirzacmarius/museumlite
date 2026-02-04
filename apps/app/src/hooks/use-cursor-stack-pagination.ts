"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export interface CursorStackPaginationOptions {
  resetKey: string;
  initialCursor?: string | null;
}

export function useCursorStackPagination({
  resetKey,
  initialCursor = null,
}: CursorStackPaginationOptions) {
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [stack, setStack] = useState<Array<string | null>>([]);

  useEffect(() => {
    setCursor(initialCursor);
    setStack([]);
  }, [initialCursor, resetKey]);

  const goNext = useCallback((nextCursor: string) => {
    setStack((prev) => [...prev, cursor]);
    setCursor(nextCursor);
  }, [cursor]);

  const goPrev = useCallback(() => {
    setStack((prev) => {
      if (prev.length === 0) return prev;
      const nextStack = prev.slice(0, -1);
      const prevCursor = prev[prev.length - 1] ?? null;
      setCursor(prevCursor);
      return nextStack;
    });
  }, []);

  const canGoPrev = useMemo(() => stack.length > 0, [stack.length]);

  const reset = useCallback(() => {
    setCursor(initialCursor);
    setStack([]);
  }, [initialCursor]);

  return {
    cursor,
    setCursor,
    goNext,
    goPrev,
    canGoPrev,
    reset,
  };
}

