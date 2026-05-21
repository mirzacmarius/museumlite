"use client";

import { useSyncExternalStore } from "react";

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
  return useClientSnapshot(
    () => {
      if (timestamp === null || timestamp === undefined) {
        return "";
      }

      return new Date(timestamp).toLocaleDateString(locale, options);
    },
    () => "",
  );
}
