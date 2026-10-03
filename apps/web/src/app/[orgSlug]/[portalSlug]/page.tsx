import { api } from "@v1/backend/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import type { Metadata } from "next";
import { getWebI18n } from "@/locales/server";
import { PublicPortalPageClient } from "./public-portal-page-client";

interface PageProps {
  params: Promise<{ orgSlug: string; portalSlug: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const [{ orgSlug, portalSlug }, { t }] = await Promise.all([
    params,
    getWebI18n(),
  ]);

  try {
    const organization = await fetchQuery(api.organizations.getBySlug, {
      slug: orgSlug,
      portalSlug,
    });

    const name = organization?.name ?? orgSlug;

    return {
      title: `${t("public.portalTitle", { name })} | MuseumLite`,
      description: t("public.portalMetadata"),
      openGraph: {
        title: t("public.portalTitle", { name }),
        description: t("public.portalMetadata"),
        type: "website",
      },
    };
  } catch {
    return {
      title: `${t("public.portalTitle", { name: orgSlug })} | MuseumLite`,
      description: t("public.portalMetadata"),
    };
  }
}

export default function PublicPortalPage(_props: PageProps) {
  return <PublicPortalPageClient />;
}
