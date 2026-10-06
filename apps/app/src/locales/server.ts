import { createI18nServer } from "next-international/server";

type Locale = string;
type TranslationValues = Record<string, string | number | null | undefined>;
type Translate = (key: string, values?: TranslationValues) => string;
type GetI18n = () => Promise<Translate>;
type GetScopedI18n = <Scope extends string>(scope: Scope) => Promise<Translate>;
type GetStaticParams = () => Array<{ locale: Locale }>;

const localeLoaders: Record<
  Locale,
  () => Promise<{ default: Record<string, unknown> }>
> = {
  en: () => import("./en"),
  es: () => import("./es"),
  fr: () => import("./fr"),
  no: () => import("./no"),
  ro: () => import("./ro"),
};

const createLooseI18nServer = createI18nServer as unknown as (
  loaders: Record<Locale, () => Promise<{ default: Record<string, unknown> }>>,
) => {
  getI18n: GetI18n;
  getScopedI18n: GetScopedI18n;
  getStaticParams: GetStaticParams;
};

export const { getI18n, getScopedI18n, getStaticParams } =
  createLooseI18nServer(localeLoaders);
