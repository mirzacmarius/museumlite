import "@/marketing-styles.css";
import { cn } from "@v1/ui/utils";
import { DeferredSiteAnalytics } from "@/components/site/deferred-site-analytics";
import {
  marketingFontClassName,
  marketingSansFont,
} from "@/lib/marketing-fonts";

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div
      className={cn(
        "marketing-site min-h-screen antialiased",
        marketingFontClassName,
        marketingSansFont.className,
      )}
    >
      {children}
      <DeferredSiteAnalytics />
    </div>
  );
}
