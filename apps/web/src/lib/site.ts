export const siteConfig = {
  name: "MuseumLite",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "https://museumlite.com",
  description:
    "Museum collection management software — catalogue objects, plan exhibitions, and track conservation in one workspace built for registrars and curators.",
  tagline: "Museum collection management, reimagined.",
  ogImage: "/marketing/og-default.jpg",
  keywords: [
    "museum collection management software",
    "museum software",
    "collection management system",
    "museum database",
    "art collection software",
    "gallery management",
    "accession software",
    "artifact cataloguing",
    "museum CMS",
  ],
  contactEmail: "hello@museumlite.app",
} as const;

export function absoluteUrl(path: string): string {
  const base = siteConfig.url.replace(/\/$/, "");
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}
