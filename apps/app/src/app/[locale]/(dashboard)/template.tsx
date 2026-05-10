"use client";

import type { ReactNode } from "react";

interface TemplateProps {
  children: ReactNode;
}

export default function DashboardTemplate({ children }: TemplateProps) {
  return <div className="h-full min-h-0">{children}</div>;
}
