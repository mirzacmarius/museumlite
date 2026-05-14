"use client";

import { useCallback, useState } from "react";

export interface CursorStackPaginationOptions {
  resetKey: string;
  initialCursor?: string | null;
}

interface CursorStackPaginationState {
  resetKey: string;
  initialCursor: string | null;
  cursor: string | null;
  stack: Array<string | null>;
}

export function useCursorStackPagination({
  resetKey,
  initialCursor = null,
}: CursorStackPaginationOptions) {
  const [state, setState] = useState<CursorStackPaginationState>({
    resetKey,
    initialCursor,
    cursor: initialCursor,
    stack: [],
  });

  const isReset =
    state.resetKey !== resetKey || state.initialCursor !== initialCursor;
  const cursor = isReset ? initialCursor : state.cursor;
  const stack = isReset ? [] : state.stack;
  const canGoPrev = stack.length > 0;

  const goNext = useCallback(
    (nextCursor: string) => {
      setState({
        resetKey,
        initialCursor,
        cursor: nextCursor,
        stack: [...stack, cursor],
      });
    },
    [cursor, initialCursor, resetKey, stack],
  );

  const goPrev = useCallback(() => {
    setState((prev) => {
      const currentStack =
        prev.resetKey !== resetKey || prev.initialCursor !== initialCursor
          ? []
          : prev.stack;

      if (currentStack.length === 0) {
        return {
          resetKey,
          initialCursor,
          cursor: initialCursor,
          stack: [],
        };
      }

      return {
        resetKey,
        initialCursor,
        cursor: currentStack[currentStack.length - 1] ?? null,
        stack: currentStack.slice(0, -1),
      };
    });
  }, [initialCursor, resetKey]);

  const reset = useCallback(() => {
    setState({
      resetKey,
      initialCursor,
      cursor: initialCursor,
      stack: [],
    });
  }, [initialCursor, resetKey]);

  const setCursor = useCallback(
    (nextCursor: string | null) => {
      setState((prev) => ({
        resetKey,
        initialCursor,
        cursor: nextCursor,
        stack:
          prev.resetKey !== resetKey || prev.initialCursor !== initialCursor
            ? []
            : prev.stack,
      }));
    },
    [initialCursor, resetKey],
  );

  return {
    cursor,
    setCursor,
    goNext,
    goPrev,
    canGoPrev,
    reset,
  };
}
