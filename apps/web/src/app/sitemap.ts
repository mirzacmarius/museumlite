import { api } from "@v1/backend/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/site";

const BASE_URL = siteConfig.url;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const marketingPaths = ["/features", "/pricing", "/about", "/contact"] as const;
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    ...marketingPaths.map((path) => ({
      url: `${BASE_URL}${path}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];

  try {
    const collections = await fetchQuery(api.collections.listPublicForSitemap);

    const collectionRoutes: MetadataRoute.Sitemap = collections.map(
      (item: {
        organizationSlug: string;
        urlSlug: string;
        title: string;
        lastModifiedAt?: number;
      }) => ({
        url: `${BASE_URL}/collections/${item.organizationSlug}/${encodeURIComponent(item.urlSlug)}`,
        lastModified: item.lastModifiedAt
          ? new Date(item.lastModifiedAt)
          : new Date(),
        changeFrequency: "monthly" as const,
        priority: 0.6,
      }),
    );

    const orgSlugs = [
      ...new Set(
        collections.map(
          (c: {
            organizationSlug: string;
            urlSlug: string;
            title: string;
            lastModifiedAt?: number;
          }) => c.organizationSlug,
        ),
      ),
    ];
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
