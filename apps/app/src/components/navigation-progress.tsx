"use client";

import { useEffect, useState } from "react";

export function NavigationProgress() {
  const [isNavigating, setIsNavigating] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let progressInterval: NodeJS.Timeout;

    const handleStart = () => {
      setIsNavigating(true);
      setProgress(0);
      progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 10;
        });
      }, 100);
    };

    const handleComplete = () => {
      setProgress(100);
      setTimeout(() => {
        setIsNavigating(false);
        setProgress(0);
      }, 200);
      if (progressInterval) clearInterval(progressInterval);
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest("a");
      if (
        anchor?.href &&
        !anchor.target &&
        !anchor.href.startsWith("#") &&
        anchor.origin === window.location.origin &&
        anchor.pathname !== window.location.pathname
      ) {
        handleStart();
      }
    };

    const observer = new MutationObserver(() => {
      if (isNavigating) {
        handleComplete();
      }
    });

    document.addEventListener("click", handleClick);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      document.removeEventListener("click", handleClick);
      observer.disconnect();
      if (progressInterval) clearInterval(progressInterval);
    };
  }, [isNavigating]);

  if (!isNavigating) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-0.5 bg-transparent">
      <div
        className="h-full bg-primary transition-all duration-150 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
