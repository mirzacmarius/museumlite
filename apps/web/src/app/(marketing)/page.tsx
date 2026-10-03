import { HomeFinalCta } from "@/components/marketing/home/final-cta";
import { HomeHero } from "@/components/marketing/home/hero";
import { HomePhilosophy } from "@/components/marketing/home/philosophy";
import { HomePillars } from "@/components/marketing/home/pillars";
import { HomeWorkspace } from "@/components/marketing/home/workspace";
import { SiteFooter } from "@/components/site/footer";
import { MarketingJsonLd } from "@/components/site/json-ld";
import { Nav } from "@/components/site/nav";
import { createPageMetadata } from "@/lib/metadata";
import { getWebI18n } from "@/locales/server";

export async function generateMetadata() {
  const { locale, t } = await getWebI18n();
  return createPageMetadata({
    title: `MuseumLite — ${t("site.tagline")}`,
    description: t("site.description"),
    path: "/",
    locale,
  });
}

export default function HomePage() {
  return (
    <>
      <MarketingJsonLd />
      <Nav floating />
      <main
        id="main-content"
        className="marketing-home bg-background text-foreground"
      >
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
