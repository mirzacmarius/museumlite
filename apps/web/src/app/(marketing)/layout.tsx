import "@/marketing-styles.css";
import { DeferredSiteAnalytics } from "@/components/site/deferred-site-analytics";
import { MarketingFonts } from "@/components/site/marketing-fonts";
import { MarketingSiteRoot } from "@/components/site/marketing-site-root";
import { MarketingThemeScript } from "@/components/site/marketing-theme";
import { MarketingSiteShell } from "@/components/site/marketing-site-shell";

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <MarketingFonts>
      <MarketingThemeScript />
      <MarketingSiteRoot>
        <MarketingSiteShell>
          <a href="#main-content" className="skip-link">
            Skip to main content
          </a>
          {children}
          <DeferredSiteAnalytics />
        </MarketingSiteShell>
      </MarketingSiteRoot>
    </MarketingFonts>
  );
}
