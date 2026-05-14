"use client";

import { formatDate, formatDistanceLocale } from "@/lib/format-date";
import { useEffect, useState } from "react";

export function useClientRelativeTime(
  timestamp: number | undefined,
  locale: string,
  options?: { addSuffix?: boolean },
) {
  const [formatted, setFormatted] = useState("");

  useEffect(() => {
    if (timestamp === undefined) {
      setFormatted("");
      return;
    }

    setFormatted(formatDistanceLocale(new Date(timestamp), locale, options));
  }, [timestamp, locale, options?.addSuffix]);

  return formatted;
}

export function useClientDate(
  timestamp: number | null | undefined,
  locale: string,
  options?: Intl.DateTimeFormatOptions,
) {
  const [formatted, setFormatted] = useState("");

  useEffect(() => {
    if (timestamp === null || timestamp === undefined) {
      setFormatted("");
      return;
    }

    setFormatted(formatDate(new Date(timestamp), locale, options));
  }, [timestamp, locale, options]);

  return formatted;
}
