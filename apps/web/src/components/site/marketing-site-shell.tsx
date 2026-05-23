"use client";

import { useEffect } from "react";

export function MarketingSiteShell({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    document.documentElement.classList.add("marketing-site");
    return () => {
      document.documentElement.classList.remove("marketing-site");
    };
  }, []);

  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: 'document.documentElement.classList.add("marketing-site");',
        }}
      />
      {children}
    </>
  );
}
