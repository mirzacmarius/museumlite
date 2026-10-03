type SupportedLocale = "en" | "fr" | "es" | "no" | "ro";

const autoFormatters: Record<SupportedLocale, Intl.RelativeTimeFormat> = {
  en: new Intl.RelativeTimeFormat("en", { numeric: "auto" }),
  fr: new Intl.RelativeTimeFormat("fr", { numeric: "auto" }),
  es: new Intl.RelativeTimeFormat("es", { numeric: "auto" }),
  no: new Intl.RelativeTimeFormat("nb", { numeric: "auto" }),
  ro: new Intl.RelativeTimeFormat("ro", { numeric: "auto" }),
};

const shortFormatters: Record<SupportedLocale, Intl.RelativeTimeFormat> = {
  en: new Intl.RelativeTimeFormat("en", { numeric: "always", style: "short" }),
  fr: new Intl.RelativeTimeFormat("fr", { numeric: "always", style: "short" }),
  es: new Intl.RelativeTimeFormat("es", { numeric: "always", style: "short" }),
  no: new Intl.RelativeTimeFormat("nb", { numeric: "always", style: "short" }),
  ro: new Intl.RelativeTimeFormat("ro", { numeric: "always", style: "short" }),
};

export function getRelativeTimeFormatter(
  locale: string,
  style: "auto" | "short" = "auto",
): Intl.RelativeTimeFormat {
  const formatters = style === "short" ? shortFormatters : autoFormatters;
  if (
    locale === "fr" ||
    locale === "es" ||
    locale === "no" ||
    locale === "ro"
  ) {
    return formatters[locale];
  }
  return formatters.en;
}
