import "@/marketing-styles.css";
import { DeferredSiteAnalytics } from "@/components/site/deferred-site-analytics";
import { MarketingSiteShell } from "@/components/site/marketing-site-shell";

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <MarketingSiteShell>
      {children}
      <DeferredSiteAnalytics />
    </MarketingSiteShell>
  );
}
