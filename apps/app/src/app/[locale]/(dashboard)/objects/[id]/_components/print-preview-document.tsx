"use client";

import { PrintPreviewCoreSections } from "./print-preview-core-sections";
import { PrintPreviewExtendedSections } from "./print-preview-extended-sections";
import type { CollectionData, HeroImageData, LocationPathItem } from "./types";

interface PrintPreviewDocumentProps {
  collection: CollectionData;
  heroImage: HeroImageData | null;
  locationPath: LocationPathItem[] | undefined;
  locale: string;
}

export function PrintPreviewDocument({
  collection,
  heroImage,
  locationPath,
  locale,
}: PrintPreviewDocumentProps) {
  return (
    <div className="space-y-5 bg-white text-black p-6 print:p-[15mm] print:space-y-4 print:break-inside-avoid-page">
      <PrintPreviewCoreSections collection={collection} heroImage={heroImage} />
      <PrintPreviewExtendedSections
        collection={collection}
        locationPath={locationPath}
        locale={locale}
      />
    </div>
  );
}
