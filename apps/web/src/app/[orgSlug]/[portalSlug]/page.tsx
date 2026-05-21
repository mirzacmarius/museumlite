import { api } from "@v1/backend/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import type { Metadata } from "next";
import { PublicPortalPageClient } from "./public-portal-page-client";

interface PageProps {
  params: Promise<{ orgSlug: string; portalSlug: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { orgSlug, portalSlug } = await params;

  try {
    const organization = await fetchQuery(api.organizations.getBySlug, {
      slug: orgSlug,
    });

    const name = organization?.name ?? orgSlug;

    return {
      title: `${name} Portal | MuseumLite`,
      description: `Browse the public collection portal for ${name}.`,
      openGraph: {
        title: `${name} — ${portalSlug}`,
        description: `Public collection portal for ${name}`,
        type: "website",
      },
    };
  } catch {
    return {
      title: `${orgSlug} Portal | MuseumLite`,
      description: "Browse the public collection portal.",
    };
  }
}

export default function PublicPortalPage(_props: PageProps) {
  return <PublicPortalPageClient />;
}
