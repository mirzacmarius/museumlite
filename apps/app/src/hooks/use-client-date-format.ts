"use client";

import { useSyncExternalStore } from "react";
import {
  formatDate,
  formatDateFns,
  formatDistanceLocale,
} from "@/lib/format-date";

function subscribeNoop() {
  return () => {};
}

function useClientSnapshot<T>(
  getSnapshot: () => T,
  getServerSnapshot: () => T,
): T {
  return useSyncExternalStore(subscribeNoop, getSnapshot, getServerSnapshot);
}

export function useClientRelativeTime(
  timestamp: number | undefined,
  locale: string,
  options?: { addSuffix?: boolean },
) {
  return useClientSnapshot(
    () =>
      timestamp === undefined
        ? ""
        : formatDistanceLocale(new Date(timestamp), locale, options),
    () => "",
  );
}

export function useClientDate(
  timestamp: number | null | undefined,
  locale: string,
  options?: Intl.DateTimeFormatOptions,
) {
  return useClientSnapshot(
    () => {
      if (timestamp === null || timestamp === undefined) {
        return "";
      }

      return formatDate(new Date(timestamp), locale, options);
    },
    () => "",
  );
}

export function useClientDateFns(
  timestamp: number | null | undefined,
  format: string,
  locale: string,
) {
  return useClientSnapshot(
    () => {
      if (timestamp === null || timestamp === undefined) {
        return "";
      }

      return formatDateFns(new Date(timestamp), format, locale);
    },
    () => "",
  );
}

export function useClientTime(
  timestamp: number | null | undefined,
  locale: string | undefined,
  options?: Intl.DateTimeFormatOptions,
) {
  return useClientSnapshot(
    () => {
      if (timestamp === null || timestamp === undefined) {
        return "";
      }

      return new Date(timestamp).toLocaleTimeString(locale, options);
    },
    () => "",
  );
}

export function useClientCurrentDate(
  locale: string,
  options?: Intl.DateTimeFormatOptions,
) {
  return useClientSnapshot(
    () => formatDate(new Date(), locale, options),
    () => "",
  );
}

export function useClientCurrentDateFns(format: string, locale: string) {
  return useClientSnapshot(
    () => formatDateFns(new Date(), format, locale),
    () => "",
  );
}

export function useClientCurrentYear() {
  return useClientSnapshot(
    () => String(new Date().getFullYear()),
    () => "",
  );
}

let cachedClientNow: number | undefined;

function getClientNowSnapshot(): number | undefined {
  if (cachedClientNow === undefined) {
    cachedClientNow = Date.now();
  }

  return cachedClientNow;
}

export function useClientNow() {
  return useClientSnapshot(getClientNowSnapshot, () => undefined);
}
