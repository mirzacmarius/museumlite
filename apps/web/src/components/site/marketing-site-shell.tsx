"use client";

import { useLayoutEffect } from "react";

export function MarketingSiteShell({
  children,
}: {
  children: React.ReactNode;
}) {
  useLayoutEffect(() => {
    document.documentElement.classList.add("marketing-site");
    return () => {
      document.documentElement.classList.remove("marketing-site");
    };
  }, []);

  return children;
}
