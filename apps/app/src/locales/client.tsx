"use client";

import { notFound } from "next/navigation";
import { createI18nClient } from "next-international/client";
import { createContext, type ReactNode, Suspense, use } from "react";
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

const { useChangeLocale: useNavigateToLocale, useCurrentLocale } =
  createLooseI18nClient(localeLoaders);

export { useCurrentLocale };

// next-international copies and filters the whole dictionary (about 8,000
// keys) on every useI18n/useScopedI18n call, which froze long lists for
// seconds (MUS-820). Translators here are built once per locale and scope.
const translationsByLocale = new Map<Locale, Promise<Translations>>();
const loadedTranslations = new Map<Locale, Translations>();

function loadTranslations(locale: Locale) {
  let translations = translationsByLocale.get(locale);
  if (!translations) {
    translations = localeLoaders[locale]().then(
      (module) => {
        const loaded = createTranslations(module.default);
        loadedTranslations.set(locale, loaded);
        return loaded;
      },
      (error: unknown) => {
        // A failed chunk load (for example after a deploy) can be retried.
        translationsByLocale.delete(locale);
        throw error;
      },
    );
    translationsByLocale.set(locale, translations);
  }
  return translations;
}

/** Loads the next locale's translations before navigating to it. */
export function useChangeLocale() {
  const navigateToLocale = useNavigateToLocale();
  return (locale: Locale) => {
    void loadTranslations(locale)
      .catch(() => undefined)
      .then(() => navigateToLocale(locale));
  };
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
  // A loaded locale renders without suspending, so switching to it shows no
  // empty frame.
  const translations =
    loadedTranslations.get(locale) ?? use(loadTranslations(locale));
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
  const translations = use(TranslationsContext);
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
