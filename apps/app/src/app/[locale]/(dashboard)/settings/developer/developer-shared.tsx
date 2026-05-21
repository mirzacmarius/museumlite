"use client";

import { useClientDate } from "@/hooks/use-client-date-format";
import { useCurrentLocale } from "@/locales/client";

export function ClientDateText({ timestamp }: { timestamp?: number }) {
  const locale = useCurrentLocale();
  return useClientDate(timestamp, locale);
}
