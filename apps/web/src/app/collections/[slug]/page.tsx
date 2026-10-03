import { api } from "@v1/backend/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import type { Metadata } from "next";
import { getWebI18n } from "@/locales/server";
import { PublicCollectionPageClient } from "./public-collection-page-client";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const [{ slug }, { t }] = await Promise.all([params, getWebI18n()]);

  try {
    const organization = await fetchQuery(api.organizations.getBySlug, {
      slug,
    });

    const name = organization?.name || slug;

    return {
      title: `${name} ${t("public.collection")} | MuseumLite`,
      description: t("public.collectionMetadata"),
      openGraph: {
        title: `${name} ${t("public.collection")}`,
        description: t("public.collectionMetadata"),
        type: "website",
      },
    };
  } catch {
    return {
      title: `${slug} ${t("public.collection")} | MuseumLite`,
      description: t("public.collectionMetadata"),
    };
  }
}

export default function PublicCollectionPage() {
  return <PublicCollectionPageClient />;
}
