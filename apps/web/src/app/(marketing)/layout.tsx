import "@/marketing-styles.css";
import { DeferredSiteAnalytics } from "@/components/site/deferred-site-analytics";
import { MarketingFonts } from "@/components/site/marketing-fonts";
import { MarketingSiteRoot } from "@/components/site/marketing-site-root";
import { MarketingSiteShell } from "@/components/site/marketing-site-shell";
import { MarketingThemeScript } from "@/components/site/marketing-theme";
import { getWebI18n } from "@/locales/server";

export default async function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { t } = await getWebI18n();
  return (
    <MarketingFonts>
      <MarketingThemeScript />
      <MarketingSiteRoot>
        <MarketingSiteShell>
          <a href="#main-content" className="skip-link">
            {t("common.skipToMain")}
          </a>
          {children}
          <DeferredSiteAnalytics />
        </MarketingSiteShell>
      </MarketingSiteRoot>
    </MarketingFonts>
  );
}
