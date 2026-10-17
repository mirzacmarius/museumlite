import { Suspense } from "react";
import MediaLoading from "./loading";
import { MediaPageData } from "./media-page-data";

type MediaPageProps = {
  searchParams: Promise<Record<string, string | Array<string> | undefined>>;
};

export default function MediaPage({ searchParams }: MediaPageProps) {
  return (
    <Suspense fallback={<MediaLoading />}>
      <MediaPageData searchParams={searchParams} />
    </Suspense>
  );
}
