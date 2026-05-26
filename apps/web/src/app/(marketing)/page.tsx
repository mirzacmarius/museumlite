import { HomeFinalCta } from "@/components/marketing/home/final-cta";
import { HomeHero } from "@/components/marketing/home/hero";
import { HomePhilosophy } from "@/components/marketing/home/philosophy";
import { HomePillars } from "@/components/marketing/home/pillars";
import { HomeWorkspace } from "@/components/marketing/home/workspace";
import { SiteFooter } from "@/components/site/footer";
import { MarketingJsonLd } from "@/components/site/json-ld";
import { Nav } from "@/components/site/nav";
import { createPageMetadata } from "@/lib/metadata";
import { siteConfig } from "@/lib/site";

export const metadata = createPageMetadata({
  title: `${siteConfig.name} — ${siteConfig.tagline}`,
  description: siteConfig.description,
  path: "/",
});

export default function HomePage() {
  return (
    <>
      <MarketingJsonLd />
      <Nav floating />
      <main id="main-content" className="marketing-home bg-background text-foreground">
        <HomeHero />
        <HomePhilosophy />
        <HomeWorkspace />
        <HomePillars />
        <HomeFinalCta />
        <SiteFooter />
      </main>
    </>
  );
}
