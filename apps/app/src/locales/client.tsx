"use client";

import { notFound } from "next/navigation";
import { createI18nClient } from "next-international/client";
import {
  createContext,
  type ReactNode,
  Suspense,
  use,
  useContext,
} from "react";
import {
  createTranslations,
  type Dictionary,
  type Translate,
  type Translations,
} from "./translator";

type Locale = "en" | "fr" | "es" | "no" | "ro";
type UseChangeLocale = () => (locale: Locale) => void;
type UseCurrentLocale = () => Locale;

const localeLoaders: Record<Locale, () => Promise<{ default: Dictionary }>> = {
  en: () => import("./en"),
  fr: () => import("./fr"),
  es: () => import("./es"),
  no: () => import("./no"),
  ro: () => import("./ro"),
};

const createLooseI18nClient = createI18nClient as unknown as (
  loaders: Record<Locale, () => Promise<{ default: Dictionary }>>,
) => {
  useChangeLocale: UseChangeLocale;
  useCurrentLocale: UseCurrentLocale;
};

export const { useChangeLocale, useCurrentLocale } =
  createLooseI18nClient(localeLoaders);

// next-international copies and filters the whole dictionary (about 8,000
// keys) on every useI18n/useScopedI18n call, which froze long lists for
// seconds (MUS-820). Translators here are built once per locale and scope.
const translationsByLocale = new Map<Locale, Promise<Translations>>();

function loadTranslations(locale: Locale) {
  let translations = translationsByLocale.get(locale);
  if (!translations) {
    translations = localeLoaders[locale]().then((module) =>
      createTranslations(module.default),
    );
    translationsByLocale.set(locale, translations);
  }
  return translations;
}

function isLocale(locale: string): locale is Locale {
  return Object.hasOwn(localeLoaders, locale);
}

const TranslationsContext = createContext<Translations | null>(null);

function TranslationsProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  const translations = use(loadTranslations(locale));
  return (
    <TranslationsContext.Provider value={translations}>
      {children}
    </TranslationsContext.Provider>
  );
}

export function I18nProviderClient({
  locale,
  fallback,
  children,
}: {
  locale: string;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  if (!isLocale(locale)) notFound();
  return (
    <Suspense fallback={fallback}>
      <TranslationsProvider locale={locale}>{children}</TranslationsProvider>
    </Suspense>
  );
}

function useTranslations() {
  const translations = useContext(TranslationsContext);
  if (!translations) {
    throw new Error("Translations are used outside I18nProviderClient");
  }
  return translations;
}

export function useI18n(): Translate {
  return useTranslations().translator();
}

export function useScopedI18n<Scope extends string>(scope: Scope): Translate {
  return useTranslations().translator(scope);
}
