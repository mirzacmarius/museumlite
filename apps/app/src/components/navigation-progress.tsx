"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useReducer, useRef } from "react";

interface NavigationProgressState {
  isNavigating: boolean;
  progress: number;
}

type NavigationProgressAction =
  | { type: "start" }
  | { type: "tick"; increment: number }
  | { type: "complete" }
  | { type: "reset" };

function navigationProgressReducer(
  state: NavigationProgressState,
  action: NavigationProgressAction,
): NavigationProgressState {
  switch (action.type) {
    case "start":
      return { isNavigating: true, progress: 0 };
    case "tick":
      return {
        ...state,
        progress:
          state.progress >= 90
            ? state.progress
            : state.progress + action.increment,
      };
    case "complete":
      return { ...state, progress: 100 };
    case "reset":
      return { isNavigating: false, progress: 0 };
  }
}

export function NavigationProgress() {
  const pathname = usePathname();
  const [state, dispatch] = useReducer(navigationProgressReducer, {
    isNavigating: false,
    progress: 0,
  });
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const resetTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pathnameAtNavigationStartRef = useRef(pathname);

  const clearProgressInterval = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  const clearResetTimeout = useCallback(() => {
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = null;
    }
  }, []);

  const finishNavigation = useCallback(() => {
    clearProgressInterval();
    clearResetTimeout();
    dispatch({ type: "complete" });
    resetTimeoutRef.current = setTimeout(() => {
      dispatch({ type: "reset" });
      resetTimeoutRef.current = null;
    }, 200);
  }, [clearProgressInterval, clearResetTimeout]);

  useEffect(() => {
    if (!state.isNavigating) {
      return;
    }

    if (pathname !== pathnameAtNavigationStartRef.current) {
      finishNavigation();
    }
  }, [finishNavigation, pathname, state.isNavigating]);

  useEffect(() => {
    const startNavigation = () => {
      clearResetTimeout();
      clearProgressInterval();
      pathnameAtNavigationStartRef.current = pathname;
      dispatch({ type: "start" });
      progressIntervalRef.current = setInterval(() => {
        dispatch({ type: "tick", increment: Math.random() * 10 });
      }, 100);
    };

    const onDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest("a");
      if (
        anchor?.href &&
        !anchor.target &&
        !anchor.href.startsWith("#") &&
        anchor.origin === window.location.origin &&
        anchor.pathname !== window.location.pathname
      ) {
        startNavigation();
      }
    };

    document.addEventListener("click", onDocumentClick);

    return () => {
      document.removeEventListener("click", onDocumentClick);
      clearProgressInterval();
      clearResetTimeout();
    };
  }, [clearProgressInterval, clearResetTimeout, pathname]);

  if (!state.isNavigating) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-0.5 bg-transparent">
      <div
        className="h-full bg-primary transition-all duration-150 ease-out"
        style={{ width: `${state.progress}%` }}
      />
    </div>
  );
}
