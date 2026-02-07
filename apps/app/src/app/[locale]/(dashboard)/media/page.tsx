import { Suspense } from "react";
import MediaLoading from "./loading";
import { MediaPageData } from "./media-page-data";

type MediaPageProps = {
  searchParams: Promise<Record<string, string | Array<string> | undefined>>;
};

export default async function MediaPage({ searchParams }: MediaPageProps) {
  const resolvedSearchParams = await searchParams;

  return (
    <Suspense fallback={<MediaLoading />}>
      <MediaPageData searchParams={resolvedSearchParams} />
    </Suspense>
  );
}
