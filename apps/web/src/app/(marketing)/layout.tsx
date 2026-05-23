import "@/marketing-styles.css";
import { DeferredSiteAnalytics } from "@/components/site/deferred-site-analytics";
import { MarketingSiteRoot } from "@/components/site/marketing-site-root";
import { MarketingSiteShell } from "@/components/site/marketing-site-shell";

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <MarketingSiteRoot>
      <MarketingSiteShell>
        {children}
        <DeferredSiteAnalytics />
      </MarketingSiteShell>
    </MarketingSiteRoot>
  );
}
