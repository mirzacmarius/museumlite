"use client";

import { api } from "@v1/backend/convex/_generated/api";
import { Button } from "@v1/ui/button";
import { useQuery } from "convex/react";
import { ArrowLeft, Download, Tag } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

export default function PublicObjectPage() {
  const params = useParams();
  const orgSlug = params.orgSlug as string;
  const portalSlug = params.portalSlug as string;
  const accessionNumber = decodeURIComponent(params.accessionNumber as string);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const basePath = `/${orgSlug}/${portalSlug}`;

  const object = useQuery(api.collections.getPublic, {
    organizationSlug: orgSlug,
    accessionNumber,
  });

  if (object === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-white/60">Loading...</p>
      </div>
    );
  }

  if (object === null) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold text-white mb-2">Object Not Found</h1>
        <p className="text-white/60 mb-6">
          This object may not be publicly available
        </p>
        <Button asChild variant="outline" className="border-white/20">
          <Link href={basePath}>
            <ArrowLeft className="mr-2 size-4" />
            Back to Collection
          </Link>
        </Button>
      </div>
    );
  }

  const sortedImages = [
    ...object.images.filter(
      (img: {
        _id: string;
        url: string;
        isPrimary: boolean;
        caption?: string;
      }) => img.isPrimary,
    ),
    ...object.images.filter(
      (img: {
        _id: string;
        url: string;
        isPrimary: boolean;
        caption?: string;
      }) => !img.isPrimary,
    ),
  ];
  const currentImage = sortedImages[selectedImageIndex];

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8">
          <Link
            href={basePath}
            className="inline-flex items-center text-white/60 hover:text-white transition-colors"
          >
            <ArrowLeft className="mr-2 size-4" />
            Back to Collection
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div className="space-y-4">
            {currentImage ? (
              <div className="aspect-square relative rounded-xl overflow-hidden bg-white/5 border border-white/10">
                <Image
                  src={currentImage.url}
                  alt={object.title}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  className="object-contain"
                  priority
                />
              </div>
            ) : (
              <div className="aspect-square flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white/20">
                No Image Available
              </div>
            )}

            {sortedImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {sortedImages.map((img, index) => (
                  <button
                    type="button"
                    key={img._id}
                    onClick={() => setSelectedImageIndex(index)}
                    className={`relative size-20 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-colors ${
                      selectedImageIndex === index
                        ? "border-white"
                        : "border-transparent opacity-60 hover:opacity-100"
                    }`}
                  >
                    <Image
                      src={img.url}
                      alt={`${object.title} - Image ${index + 1}`}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            )}

            {object.isHighResDownloadable && currentImage && (
              <Button
                asChild
                variant="outline"
                className="w-full border-white/20"
              >
                <a
                  href={currentImage.url}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Download className="mr-2 size-4" />
                  Download High Resolution
                </a>
              </Button>
            )}
          </div>

          <div className="space-y-8">
            <div>
              <p className="text-white/40 text-sm mb-2">
                {object.accessionNumber}
              </p>
              <h1 className="text-3xl font-bold text-white mb-2">
                {object.title}
              </h1>
              {object.alternativeTitle && (
                <p className="text-xl text-white/60">
                  {object.alternativeTitle}
                </p>
              )}
              {object.creator && (
                <p className="text-lg text-white/80 mt-2">{object.creator}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              {object.objectType && (
                <div>
                  <dt className="text-xs uppercase tracking-wider text-white/40 mb-1">
                    Object Type
                  </dt>
                  <dd className="text-white">{object.objectType}</dd>
                </div>
              )}
              {object.objectName && (
                <div>
                  <dt className="text-xs uppercase tracking-wider text-white/40 mb-1">
                    Object Name
                  </dt>
                  <dd className="text-white">{object.objectName}</dd>
                </div>
              )}
              {object.culture && (
                <div>
                  <dt className="text-xs uppercase tracking-wider text-white/40 mb-1">
                    Culture
                  </dt>
                  <dd className="text-white">{object.culture}</dd>
                </div>
              )}
              {object.period && (
                <div>
                  <dt className="text-xs uppercase tracking-wider text-white/40 mb-1">
                    Period
                  </dt>
                  <dd className="text-white">{object.period}</dd>
                </div>
              )}
              {object.dateCreated && (
                <div>
                  <dt className="text-xs uppercase tracking-wider text-white/40 mb-1">
                    Date
                  </dt>
                  <dd className="text-white">{object.dateCreated}</dd>
                </div>
              )}
              {object.materials && (
                <div>
                  <dt className="text-xs uppercase tracking-wider text-white/40 mb-1">
                    Materials
                  </dt>
                  <dd className="text-white">{object.materials}</dd>
                </div>
              )}
              {object.technique && (
                <div>
                  <dt className="text-xs uppercase tracking-wider text-white/40 mb-1">
                    Technique
                  </dt>
                  <dd className="text-white">{object.technique}</dd>
                </div>
              )}
              {object.dimensions && (
                <div>
                  <dt className="text-xs uppercase tracking-wider text-white/40 mb-1">
                    Dimensions
                  </dt>
                  <dd className="text-white">{object.dimensions}</dd>
                </div>
              )}
            </div>

            {object.description && (
              <div>
                <h2 className="text-xs uppercase tracking-wider text-white/40 mb-2">
                  Description
                </h2>
                <p className="text-white/80 leading-relaxed whitespace-pre-wrap">
                  {object.description}
                </p>
              </div>
            )}

            {object.inscriptions && (
              <div>
                <h2 className="text-xs uppercase tracking-wider text-white/40 mb-2">
                  Inscriptions
                </h2>
                <p className="text-white/80 leading-relaxed whitespace-pre-wrap">
                  {object.inscriptions}
                </p>
              </div>
            )}

            {object.provenance && (
              <div>
                <h2 className="text-xs uppercase tracking-wider text-white/40 mb-2">
                  Provenance
                </h2>
                <p className="text-white/80 leading-relaxed whitespace-pre-wrap">
                  {object.provenance}
                </p>
              </div>
            )}

            {object.exhibitionHistory && (
              <div>
                <h2 className="text-xs uppercase tracking-wider text-white/40 mb-2">
                  Exhibition History
                </h2>
                <p className="text-white/80 leading-relaxed whitespace-pre-wrap">
                  {object.exhibitionHistory}
                </p>
              </div>
            )}

            {object.valuation && (
              <div className="rounded-lg bg-white/5 border border-white/10 p-4">
                <h2 className="text-xs uppercase tracking-wider text-white/40 mb-3">
                  Valuation
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  {object.valuation.appraisedValue && (
                    <div>
                      <dt className="text-xs text-white/40 mb-1">
                        Appraised Value
                      </dt>
                      <dd className="text-white font-medium">
                        ${object.valuation.appraisedValue.toLocaleString()}
                      </dd>
                    </div>
                  )}
                  {object.valuation.replacementValue && (
                    <div>
                      <dt className="text-xs text-white/40 mb-1">
                        Replacement Value
                      </dt>
                      <dd className="text-white font-medium">
                        ${object.valuation.replacementValue.toLocaleString()}
                      </dd>
                    </div>
                  )}
                  {object.valuation.appraiser && (
                    <div>
                      <dt className="text-xs text-white/40 mb-1">Appraiser</dt>
                      <dd className="text-white">
                        {object.valuation.appraiser}
                      </dd>
                    </div>
                  )}
                  {object.valuation.lastAppraisalDate && (
                    <div>
                      <dt className="text-xs text-white/40 mb-1">
                        Last Appraisal
                      </dt>
                      <dd className="text-white">
                        {new Date(
                          object.valuation.lastAppraisalDate,
                        ).toLocaleDateString()}
                      </dd>
                    </div>
                  )}
                </div>
              </div>
            )}

            {object.creditLine && (
              <div className="pt-4 border-t border-white/10">
                <p className="text-white/60 italic">{object.creditLine}</p>
              </div>
            )}

            {object.tags && object.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {object.tags.map((tag: string) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/10 text-white/80 text-sm"
                  >
                    <Tag className="size-3" />
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <div className="pt-4 border-t border-white/10">
              <p className="text-sm text-white/40">
                From the collection of {object.organizationName}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
