import type { Metadata } from "next";

interface Props {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;

  return {
    title: `${slug} Collection | MuseumLite`,
    description: `Explore the public collection from ${slug}. Browse artworks, artifacts, and cultural objects.`,
    openGraph: {
      title: `${slug} Collection`,
      description: `Explore the public collection from ${slug}`,
      type: "website",
    },
  };
}

export default function CollectionLayout({ children }: Props) {
  return children;
}
