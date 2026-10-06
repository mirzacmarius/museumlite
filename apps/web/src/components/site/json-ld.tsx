import { absoluteUrl, siteConfig } from "@/lib/site";
import { getWebI18n } from "@/locales/server";

export async function MarketingJsonLd() {
  const { t } = await getWebI18n();
  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    url: siteConfig.url,
    logo: absoluteUrl("/icon.svg"),
    email: siteConfig.contactEmail,
  };

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    url: siteConfig.url,
    description: t("site.description"),
  };

  const software = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: siteConfig.name,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: t("site.description"),
    url: siteConfig.url,
    offers: {
      "@type": "Offer",
      url: absoluteUrl("/pricing"),
    },
  };

  return (
    <>
      <script type="application/ld+json">{JSON.stringify(organization)}</script>
      <script type="application/ld+json">{JSON.stringify(website)}</script>
      <script type="application/ld+json">{JSON.stringify(software)}</script>
    </>
  );
}
