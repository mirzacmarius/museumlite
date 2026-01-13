import { api } from "@v1/backend/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://museumlite.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];

  try {
    const collections = await fetchQuery(api.collections.listPublicForSitemap);

    const collectionRoutes: MetadataRoute.Sitemap = collections.map((item) => ({
      url: `${BASE_URL}/collections/${item.organizationSlug}/${encodeURIComponent(item.accessionNumber)}`,
      lastModified: item.lastModifiedAt
        ? new Date(item.lastModifiedAt)
        : new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    }));

    const orgSlugs = [...new Set(collections.map((c) => c.organizationSlug))];
    const collectionListRoutes: MetadataRoute.Sitemap = orgSlugs.map(
      (slug) => ({
        url: `${BASE_URL}/collections/${slug}`,
        lastModified: new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.8,
      }),
    );

    return [...staticRoutes, ...collectionListRoutes, ...collectionRoutes];
  } catch {
    return staticRoutes;
  }
}
