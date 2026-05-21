"use client";

import { useEffect, useState } from "react";
import {
  formatDate,
  formatDateFns,
  formatDistanceLocale,
} from "@/lib/format-date";

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

export function useClientDateFns(
  timestamp: number | null | undefined,
  format: string,
  locale: string,
) {
  const [formatted, setFormatted] = useState("");

  useEffect(() => {
    if (timestamp === null || timestamp === undefined) {
      setFormatted("");
      return;
    }

    setFormatted(formatDateFns(new Date(timestamp), format, locale));
  }, [timestamp, format, locale]);

  return formatted;
}

export function useClientTime(
  timestamp: number | null | undefined,
  locale: string | undefined,
  options?: Intl.DateTimeFormatOptions,
) {
  const [formatted, setFormatted] = useState("");

  useEffect(() => {
    if (timestamp === null || timestamp === undefined) {
      setFormatted("");
      return;
    }

    setFormatted(new Date(timestamp).toLocaleTimeString(locale, options));
  }, [timestamp, locale, options]);

  return formatted;
}

export function useClientCurrentDate(
  locale: string,
  options?: Intl.DateTimeFormatOptions,
) {
  const [formatted, setFormatted] = useState("");

  useEffect(() => {
    setFormatted(formatDate(new Date(), locale, options));
  }, [locale, options]);

  return formatted;
}

export function useClientCurrentDateFns(format: string, locale: string) {
  const [formatted, setFormatted] = useState("");

  useEffect(() => {
    setFormatted(formatDateFns(new Date(), format, locale));
  }, [format, locale]);

  return formatted;
}

export function useClientCurrentYear() {
  const [year, setYear] = useState("");

  useEffect(() => {
    setYear(String(new Date().getFullYear()));
  }, []);

  return year;
}

export function useClientNow() {
  const [now, setNow] = useState<number | undefined>();

  useEffect(() => {
    setNow(Date.now());
  }, []);

  return now;
}
