"use client";

import { CheckCircle, Clock, XCircle } from "lucide-react";
import { useScopedI18n } from "@/locales/client";

export function DeaccessionDetailStatusBadge({ status }: { status: string }) {
  const t = useScopedI18n("deaccessions");

  switch (status) {
    case "pending":
      return (
        <span className="inline-flex items-center rounded-full bg-blue-500/10 px-3 py-1 text-sm font-medium text-blue-600">
          <Clock className="mr-1.5 size-4" />
          {t("status.pending")}
        </span>
      );
    case "approved":
      return (
        <span className="inline-flex items-center rounded-full bg-green-500/10 px-3 py-1 text-sm font-medium text-green-600">
          <CheckCircle className="mr-1.5 size-4" />
          {t("status.approved")}
        </span>
      );
    case "rejected":
      return (
        <span className="inline-flex items-center rounded-full bg-red-500/10 px-3 py-1 text-sm font-medium text-red-600">
          <XCircle className="mr-1.5 size-4" />
          {t("status.rejected")}
        </span>
      );
    default:
      return null;
  }
}
