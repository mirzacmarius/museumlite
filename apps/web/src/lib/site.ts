function readPublicAppUrl(): string {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_WEB_URL?.trim();
  if (configured) {
    return configured;
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    return `https://${vercelUrl}`;
  }

  return "http://localhost:3001";
}

export const siteConfig = {
  name: "MuseumLite",
  url: readPublicAppUrl(),
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
  contactEmail: "hello@[REDACTED].app",
} as const;

export function absoluteUrl(path: string): string {
  const base = siteConfig.url.replace(/\/$/, "");
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}
