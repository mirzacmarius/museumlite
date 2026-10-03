import { api } from "@v1/backend/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import type { Metadata } from "next";
import { Suspense } from "react";
import { getWebI18n } from "@/locales/server";
import { PublicPortalObjectPageClient } from "./public-object-page-client";

interface PageProps {
  params: Promise<{
    orgSlug: string;
    portalSlug: string;
    accessionNumber: string;
  }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const [{ orgSlug, portalSlug, accessionNumber }, { t }] = await Promise.all([
    params,
    getWebI18n(),
  ]);
  const decodedAccessionNumber = decodeURIComponent(accessionNumber);

  try {
    const object = await fetchQuery(api.collections.getPublic, {
      organizationSlug: orgSlug,
      portalSlug,
      accessionNumber: decodedAccessionNumber,
    });

    if (!object) {
      return {
        title: t("public.objectMissingMetadata"),
        description: t("public.objectPageMetadata"),
      };
    }

    return {
      title: `${object.title} | MuseumLite`,
      description: object.description ?? t("public.objectMetadata"),
      openGraph: {
        title: object.title,
        description: object.description ?? undefined,
        type: "article",
      },
    };
  } catch {
    return {
      title: `${decodedAccessionNumber} | MuseumLite`,
      description: t("public.objectMetadata"),
    };
  }
}

export default async function PublicPortalObjectPage(_props: PageProps) {
  const { t } = await getWebI18n();
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-white/60">{t("common.loadingObject")}</p>
        </div>
      }
    >
      <PublicPortalObjectPageClient />
    </Suspense>
  );
}
