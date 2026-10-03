import { UiLocaleProvider } from "@v1/ui/locale";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { siteConfig } from "@/lib/site";
import { resolveWebLocale, WEB_LOCALE_COOKIE } from "@/locales/messages";
import { WebLocaleProvider } from "@/locales/provider";
import { getWebI18n } from "@/locales/server";
import { webUiMessages } from "@/locales/ui-messages";

export async function generateMetadata(): Promise<Metadata> {
  const { locale, t } = await getWebI18n();
  const title = `${siteConfig.name} — ${t("site.tagline")}`;
  const description = t("site.description");

  return {
    metadataBase: new URL(siteConfig.url),
    title: { default: title, template: `%s | ${siteConfig.name}` },
    description,
    keywords: t("site.keywords").split(", "),
    authors: [{ name: siteConfig.name }],
    alternates: { canonical: siteConfig.url },
    openGraph: {
      title,
      description,
      url: siteConfig.url,
      siteName: siteConfig.name,
      locale: {
        en: "en_US",
        fr: "fr_FR",
        es: "es_ES",
        no: "nb_NO",
        ro: "ro_RO",
      }[locale],
      type: "website",
      images: [
        {
          url: siteConfig.ogImage,
          width: 1200,
          height: 630,
          alt: `${siteConfig.name} — ${t("site.tagline")}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [siteConfig.ogImage],
    },
    robots: { index: true, follow: true },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const localeValue = (await cookies()).get(WEB_LOCALE_COOKIE)?.value;
  const locale = resolveWebLocale(localeValue);

  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <WebLocaleProvider locale={locale}>
          <UiLocaleProvider locale={locale} messages={webUiMessages[locale]}>
            {children}
          </UiLocaleProvider>
        </WebLocaleProvider>
      </body>
    </html>
  );
}
