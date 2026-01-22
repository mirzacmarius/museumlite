import { api } from "@v1/backend/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ slug: string; accessionNumber: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, accessionNumber } = await params;
  const decodedAccessionNumber = decodeURIComponent(accessionNumber);

  try {
    const object = await fetchQuery(api.collections.getPublic, {
      organizationSlug: slug,
      accessionNumber: decodedAccessionNumber,
    });

    if (!object) {
      return {
        title: "Object Not Found | MuseumLite",
      };
    }

    const description = object.description
      ? object.description.slice(0, 160)
      : `${object.title}${object.creator ? ` by ${object.creator}` : ""}${object.dateCreated ? `, ${object.dateCreated}` : ""}`;

    const primaryImage = object.images.find(
      (img: { _id: string; url: string; isPrimary: boolean; caption?: string }) =>
        img.isPrimary,
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
      title: "Object | MuseumLite",
    };
  }
}

export default function ObjectLayout({ children }: Props) {
  return children;
}
