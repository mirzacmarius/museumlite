import { api } from "@v1/backend/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;

  try {
    const organization = await fetchQuery(api.organizations.getBySlug, {
      slug,
    });

    const name = organization?.name || slug;

    return {
      title: `${name} Collection | MuseumLite`,
      description: `Explore the public collection from ${name}. Browse artworks, artifacts, and cultural objects.`,
      openGraph: {
        title: `${name} Collection`,
        description: `Explore the public collection from ${name}`,
        type: "website",
      },
    };
  } catch {
    return {
      title: `${slug} Collection | MuseumLite`,
      description:
        "Explore the public collection. Browse artworks, artifacts, and cultural objects.",
    };
  }
}

export default function CollectionLayout({ children }: Props) {
  return children;
}
