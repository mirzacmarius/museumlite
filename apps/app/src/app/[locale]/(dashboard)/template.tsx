"use client";

import type { ReactNode } from "react";

interface TemplateProps {
  children: ReactNode;
}

/**
 * Next mounts a new template when navigation changes the dashboard's page,
 * and shows a revisited page again from hidden, which replays its CSS
 * animation; either way the page fades and rises in.
 */
export default function DashboardTemplate({ children }: TemplateProps) {
  return (
    <div className="h-full min-h-0 animate-in fade-in-0 slide-in-from-bottom-2 duration-300 ease-out">
      {children}
    </div>
  );
}
