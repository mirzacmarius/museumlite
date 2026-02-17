import { createI18nServer } from "next-international/server";

export const {
  getI18n: strictGetI18n,
  getScopedI18n: strictGetScopedI18n,
  getStaticParams: strictGetStaticParams,
} = createI18nServer({
  en: () => import("./en"),
  es: () => import("./es"),
  fr: () => import("./fr"),
  no: () => import("./no"),
  ro: () => import("./ro"),
});
