import { api } from "@v1/backend/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import type { Metadata } from "next";
import { Suspense } from "react";
import { getWebI18n } from "@/locales/server";
import { PublicObjectPageClient } from "./public-object-page-client";

interface PageProps {
  params: Promise<{ slug: string; accessionNumber: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const [{ slug, accessionNumber }, { t }] = await Promise.all([
    params,
    getWebI18n(),
  ]);
  const decodedAccessionNumber = decodeURIComponent(accessionNumber);

  try {
    const object = await fetchQuery(api.collections.getPublic, {
      organizationSlug: slug,
      accessionNumber: decodedAccessionNumber,
    });

    if (!object) {
      return {
        title: t("public.objectMissingMetadata"),
      };
    }

    const description = object.description
      ? object.description.slice(0, 160)
      : `${object.title}${object.creator ? ` — ${object.creator}` : ""}${object.dateCreated ? `, ${object.dateCreated}` : ""}`;

    const primaryImage = object.images.find(
      (img: {
        _id: string;
        url: string;
        isPrimary: boolean;
        caption?: string;
      }) => img.isPrimary,
    );

    return {
      title: `${object.title} | ${object.organizationName}`,
      description,
      openGraph: {
        title: object.title,
        description,
        type: "article",
        images: primaryImage
          ? [
              {
                url: primaryImage.url,
                alt: object.title,
              },
            ]
          : undefined,
      },
      twitter: {
        card: primaryImage ? "summary_large_image" : "summary",
        title: object.title,
        description,
        images: primaryImage ? [primaryImage.url] : undefined,
      },
    };
  } catch {
    return {
      title: `${t("public.objectMetadataTitle")} | MuseumLite`,
      description: t("public.objectMetadata"),
    };
  }
}

export default async function PublicObjectPage() {
  const { t } = await getWebI18n();
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
          <p className="text-white/60">{t("common.loadingObject")}</p>
        </div>
      }
    >
      <PublicObjectPageClient />
    </Suspense>
  );
}
