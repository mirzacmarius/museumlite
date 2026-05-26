"use client";

import { useLayoutEffect } from "react";
import { MarketingThemeProvider } from "./marketing-theme";

export function MarketingSiteShell({
  children,
}: {
  children: React.ReactNode;
}) {
  useLayoutEffect(() => {
    document.documentElement.classList.add("marketing-site");
    return () => {
      document.documentElement.classList.remove("marketing-site");
      document.documentElement.classList.remove("marketing-theme-light");
    };
  }, []);

  return <MarketingThemeProvider>{children}</MarketingThemeProvider>;
}
