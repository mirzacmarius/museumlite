import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site";
import { getWebI18n } from "@/locales/server";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { t } = await getWebI18n();
  return {
    name: siteConfig.name,
    short_name: siteConfig.name,
    description: t("site.description"),
    start_url: "/",
    display: "standalone",
    background_color: "#1f1c18",
    theme_color: "#c9a227",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/favicon.ico",
        sizes: "48x48",
        type: "image/x-icon",
      },
    ],
  };
}
