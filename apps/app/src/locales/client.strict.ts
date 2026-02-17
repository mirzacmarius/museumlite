"use client";

import { createI18nClient } from "next-international/client";

export const {
  useI18n: strictUseI18n,
  useScopedI18n: strictUseScopedI18n,
  I18nProviderClient: strictI18nProviderClient,
  useChangeLocale: strictUseChangeLocale,
  useCurrentLocale: strictUseCurrentLocale,
} = createI18nClient({
  en: () => import("./en"),
  fr: () => import("./fr"),
  es: () => import("./es"),
  no: () => import("./no"),
  ro: () => import("./ro"),
});
