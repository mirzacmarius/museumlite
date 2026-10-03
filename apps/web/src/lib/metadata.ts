import type { Metadata } from "next";
import { siteConfig } from "@/lib/site";

type PageMetadataInput = {
  title: string;
  description: string;
  path: string;
  locale?: string;
  noIndex?: boolean;
};

export function createPageMetadata({
  title,
  description,
  path,
  locale = "en",
  noIndex = false,
}: PageMetadataInput): Metadata {
  const canonical = path === "/" ? siteConfig.url : `${siteConfig.url}${path}`;

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: siteConfig.name,
      locale:
        { en: "en_US", fr: "fr_FR", es: "es_ES", no: "nb_NO", ro: "ro_RO" }[
          locale
        ] ?? "en_US",
      type: "website",
      images: [
        {
          url: siteConfig.ogImage,
          width: 1200,
          height: 630,
          alt: siteConfig.name,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [siteConfig.ogImage],
    },
    ...(noIndex ? { robots: { index: false, follow: false } } : {}),
  };
}
