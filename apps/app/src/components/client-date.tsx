"use client";

import {
  useClientCurrentDate,
  useClientCurrentDateFns,
  useClientCurrentYear,
  useClientDate,
  useClientDateFns,
  useClientRelativeTime,
  useClientTime,
} from "@/hooks/use-client-date-format";

interface ClientDateProps {
  timestamp: number | null | undefined;
  locale: string;
  options?: Intl.DateTimeFormatOptions;
}

export function ClientDate({ timestamp, locale, options }: ClientDateProps) {
  return useClientDate(timestamp, locale, options);
}

interface ClientDateFnsProps {
  timestamp: number | null | undefined;
  format: string;
  locale: string;
}

export function ClientDateFns({
  timestamp,
  format,
  locale,
}: ClientDateFnsProps) {
  return useClientDateFns(timestamp, format, locale);
}

interface ClientTimeProps {
  timestamp: number | null | undefined;
  locale?: string;
  options?: Intl.DateTimeFormatOptions;
}

export function ClientTime({ timestamp, locale, options }: ClientTimeProps) {
  return useClientTime(timestamp, locale, options);
}

interface ClientRelativeTimeProps {
  timestamp: number | undefined;
  locale: string;
  options?: { addSuffix?: boolean };
}

export function ClientRelativeTime({
  timestamp,
  locale,
  options,
}: ClientRelativeTimeProps) {
  return useClientRelativeTime(timestamp, locale, options);
}

interface ClientCurrentDateProps {
  locale: string;
  options?: Intl.DateTimeFormatOptions;
}

export function ClientCurrentDate({ locale, options }: ClientCurrentDateProps) {
  return useClientCurrentDate(locale, options);
}

interface ClientCurrentDateFnsProps {
  format: string;
  locale: string;
}

export function ClientCurrentDateFns({
  format,
  locale,
}: ClientCurrentDateFnsProps) {
  return useClientCurrentDateFns(format, locale);
}

export function ClientCurrentYear() {
  return useClientCurrentYear();
}
