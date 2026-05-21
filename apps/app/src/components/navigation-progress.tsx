"use client";

import { useEffect, useReducer, useRef } from "react";

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
  const [state, dispatch] = useReducer(navigationProgressReducer, {
    isNavigating: false,
    progress: 0,
  });
  const isNavigatingRef = useRef(state.isNavigating);

  useEffect(() => {
    isNavigatingRef.current = state.isNavigating;
  }, [state.isNavigating]);

  useEffect(() => {
    let progressInterval: NodeJS.Timeout;

    const startNavigation = () => {
      dispatch({ type: "start" });
      progressInterval = setInterval(() => {
        dispatch({ type: "tick", increment: Math.random() * 10 });
      }, 100);
    };

    const completeNavigation = () => {
      dispatch({ type: "complete" });
      setTimeout(() => {
        dispatch({ type: "reset" });
      }, 200);
      if (progressInterval) clearInterval(progressInterval);
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

    const observer = new MutationObserver(() => {
      if (isNavigatingRef.current) {
        completeNavigation();
      }
    });

    document.addEventListener("click", onDocumentClick);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      document.removeEventListener("click", onDocumentClick);
      observer.disconnect();
      if (progressInterval) clearInterval(progressInterval);
    };
  }, []);

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
