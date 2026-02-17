"use client";

import { createI18nClient } from "next-international/client";
import type { ComponentType, ReactNode } from "react";

type Locale = "en" | "fr" | "es" | "no" | "ro";
type TranslationValues = Record<string, string | number | null | undefined>;
type Translate = (key: string, values?: TranslationValues) => string;
type UseI18n = <Scope extends string = string>(scope?: Scope) => Translate;
type UseScopedI18n = <Scope extends string = string>(
  scope?: Scope,
) => Translate;
type UseChangeLocale = () => (locale: Locale) => void;
type UseCurrentLocale = () => Locale;
type I18nProviderClientType = ComponentType<{
  children: ReactNode;
  locale: string;
}>;

const localeLoaders: Record<
  Locale,
  () => Promise<{ default: Record<string, unknown> }>
> = {
  en: () => import("./en"),
  fr: () => import("./fr"),
  es: () => import("./es"),
  no: () => import("./no"),
  ro: () => import("./ro"),
};

const createLooseI18nClient = createI18nClient as unknown as (
  loaders: Record<Locale, () => Promise<{ default: Record<string, unknown> }>>,
) => {
  useI18n: UseI18n;
  useScopedI18n: UseScopedI18n;
  I18nProviderClient: I18nProviderClientType;
  useChangeLocale: UseChangeLocale;
  useCurrentLocale: UseCurrentLocale;
};

export const {
  useI18n,
  useScopedI18n,
  I18nProviderClient,
  useChangeLocale,
  useCurrentLocale,
} = createLooseI18nClient(localeLoaders);
