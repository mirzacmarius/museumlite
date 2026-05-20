"use client";

import { useEffect, useState } from "react";

export function ClientCurrentYear() {
  const [year, setYear] = useState("");

  useEffect(() => {
    setYear(String(new Date().getFullYear()));
  }, []);

  return year;
}

interface ClientDateProps {
  timestamp: number | null | undefined;
  locale?: string;
  options?: Intl.DateTimeFormatOptions;
}

export function ClientDate({ timestamp, locale, options }: ClientDateProps) {
  const [formatted, setFormatted] = useState("");

  useEffect(() => {
    if (timestamp === null || timestamp === undefined) {
      setFormatted("");
      return;
    }

    setFormatted(new Date(timestamp).toLocaleDateString(locale, options));
  }, [timestamp, locale, options]);

  return formatted;
}
