"use client";

import { createContext, use } from "react";
import type { WebLocale, WebMessageKey } from "./messages";
import { formatWebMessage, webMessages } from "./messages";

interface WebLocaleContextValue {
  locale: WebLocale;
  t: (key: WebMessageKey, values?: Record<string, string | number>) => string;
}

const WebLocaleContext = createContext<WebLocaleContextValue | null>(null);

export function WebLocaleProvider({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: WebLocale;
}) {
  const t = (key: WebMessageKey, values?: Record<string, string | number>) =>
    formatWebMessage(webMessages[locale][key], values);

  return (
    <WebLocaleContext.Provider value={{ locale, t }}>
      {children}
    </WebLocaleContext.Provider>
  );
}

export function useWebI18n(): WebLocaleContextValue {
  const context = use(WebLocaleContext);
  if (!context) {
    throw new Error("useWebI18n must be used inside WebLocaleProvider");
  }
  return context;
}
