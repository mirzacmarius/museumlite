"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { notFound, useParams } from "next/navigation";
import type { ReactNode } from "react";

export default function AccountLayout({ children }: { children: ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const canAccess = useQuery(api.accounts.canAccessDetail, {
    accountId: id as Id<"accounts">,
  });
  if (canAccess === undefined) return null;
  if (!canAccess) notFound();
  return children;
}
