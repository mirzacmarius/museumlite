"use client";

import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { usePermissions } from "@/components/permission-gate";

export function AdministrationGate({ children }: { children: ReactNode }) {
  const { hasPermission, isLoading } = usePermissions();
  if (isLoading) return null;
  if (!hasPermission("organization.manage_settings")) notFound();
  return children;
}
