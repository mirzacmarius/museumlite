import { api } from "@v1/backend/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import type { Metadata } from "next";
import { Suspense } from "react";
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
  const { orgSlug, portalSlug, accessionNumber } = await params;
  const decodedAccessionNumber = decodeURIComponent(accessionNumber);

  try {
    const object = await fetchQuery(api.collections.getPublic, {
      organizationSlug: orgSlug,
      portalSlug,
      accessionNumber: decodedAccessionNumber,
    });

    if (!object) {
      return {
        title: "Object Not Found | MuseumLite",
        description: "This object may not be publicly available.",
      };
    }

    return {
      title: `${object.title} | MuseumLite`,
      description:
        object.description ?? `View ${object.title} in the collection.`,
      openGraph: {
        title: object.title,
        description: object.description ?? undefined,
        type: "article",
      },
    };
  } catch {
    return {
      title: `${decodedAccessionNumber} | MuseumLite`,
      description: "View object in the public collection portal.",
    };
  }
}

export default function PublicPortalObjectPage(_props: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-white/60">Loading object…</p>
        </div>
      }
    >
      <PublicPortalObjectPageClient />
    </Suspense>
  );
}
