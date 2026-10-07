"use client";

import { useSyncExternalStore } from "react";
import { useWebI18n } from "@/locales/provider";

function subscribeNoop() {
  return () => {};
}

function useClientSnapshot<T>(
  getSnapshot: () => T,
  getServerSnapshot: () => T,
): T {
  return useSyncExternalStore(subscribeNoop, getSnapshot, getServerSnapshot);
}

export function ClientCurrentYear() {
  return useClientSnapshot(
    () => String(new Date().getFullYear()),
    () => "",
  );
}

interface ClientDateProps {
  timestamp: number | null | undefined;
  locale?: string;
  options?: Intl.DateTimeFormatOptions;
}

export function ClientDate({ timestamp, locale, options }: ClientDateProps) {
  const { locale: preferredLocale } = useWebI18n();
  const dateLocale = locale ?? preferredLocale;
  return useClientSnapshot(
    () => {
      if (timestamp === null || timestamp === undefined) {
        return "";
      }

      return new Date(timestamp).toLocaleDateString(dateLocale, options);
    },
    () => "",
  );
}
