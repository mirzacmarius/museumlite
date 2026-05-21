"use client";

import { Button } from "@v1/ui/button";
import { Download, Tag } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { ClientDate } from "@/components/client-date";

interface PublicObjectImage {
  _id: string;
  url: string;
  isPrimary: boolean;
  caption?: string;
}

interface PublicObjectValuation {
  appraisedValue?: number | null;
  replacementValue?: number | null;
  appraiser?: string | null;
  lastAppraisalDate?: number | null;
}

export interface PublicObjectDetailData {
  accessionNumber: string;
  title: string;
  alternativeTitle?: string | null;
  creator?: string | null;
  objectType?: string | null;
  objectName?: string | null;
  culture?: string | null;
  period?: string | null;
  dateCreated?: string | null;
  materials?: string | null;
  technique?: string | null;
  dimensions?: string | null;
  description?: string | null;
  inscriptions?: string | null;
  provenance?: string | null;
  exhibitionHistory?: string | null;
  valuation?: PublicObjectValuation | null;
  creditLine?: string | null;
  tags?: string[] | null;
  organizationName: string;
  images: PublicObjectImage[];
  isHighResDownloadable?: boolean | null;
}

interface PublicObjectDetailProps {
  object: PublicObjectDetailData;
}

function PublicObjectGallery({ object }: PublicObjectDetailProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const sortedImages = [
    ...object.images.filter((image) => image.isPrimary),
    ...object.images.filter((image) => !image.isPrimary),
  ];
  const currentImage = sortedImages[selectedImageIndex];

  return (
    <div className="space-y-4">
      {currentImage ? (
        <div className="relative aspect-square overflow-hidden rounded-xl border border-white/10 bg-white/5">
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
        <div className="flex aspect-square items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/20">
          No Image Available
        </div>
      )}

      {sortedImages.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {sortedImages.map((image, index) => (
            <button
              type="button"
              key={image._id}
              onClick={() => setSelectedImageIndex(index)}
              className={`relative size-20 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
                selectedImageIndex === index
                  ? "border-white"
                  : "border-transparent opacity-60 hover:opacity-100"
              }`}
            >
              <Image
                src={image.url}
                alt={`${object.title} - Image ${index + 1}`}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}

      {object.isHighResDownloadable && currentImage ? (
        <Button asChild variant="outline" className="w-full border-white/20">
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
      ) : null}
    </div>
  );
}

function PublicObjectHeading({ object }: PublicObjectDetailProps) {
  return (
    <div>
      <p className="mb-2 text-sm text-white/40">{object.accessionNumber}</p>
      <h1 className="mb-2 text-3xl font-semibold text-white">{object.title}</h1>
      {object.alternativeTitle ? (
        <p className="text-xl text-white/60">{object.alternativeTitle}</p>
      ) : null}
      {object.creator ? (
        <p className="mt-2 text-lg text-white/80">{object.creator}</p>
      ) : null}
    </div>
  );
}

function MetadataField({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  if (!value) {
    return null;
  }

  return (
    <div>
      <dt className="mb-1 text-xs uppercase tracking-wider text-white/40">
        {label}
      </dt>
      <dd className="text-white">{value}</dd>
    </div>
  );
}

function PublicObjectMetadata({ object }: PublicObjectDetailProps) {
  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-4">
      <MetadataField label="Object Type" value={object.objectType} />
      <MetadataField label="Object Name" value={object.objectName} />
      <MetadataField label="Culture" value={object.culture} />
      <MetadataField label="Period" value={object.period} />
      <MetadataField label="Date" value={object.dateCreated} />
      <MetadataField label="Materials" value={object.materials} />
      <MetadataField label="Technique" value={object.technique} />
      <MetadataField label="Dimensions" value={object.dimensions} />
    </div>
  );
}

function TextSection({
  title,
  value,
}: {
  title: string;
  value?: string | null;
}) {
  if (!value) {
    return null;
  }

  return (
    <div>
      <h2 className="mb-2 text-xs uppercase tracking-wider text-white/40">
        {title}
      </h2>
      <p className="whitespace-pre-wrap text-white/80 leading-relaxed">
        {value}
      </p>
    </div>
  );
}

function PublicObjectValuation({ object }: PublicObjectDetailProps) {
  if (!object.valuation) {
    return null;
  }

  const { valuation } = object;

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <h2 className="mb-3 text-xs uppercase tracking-wider text-white/40">
        Valuation
      </h2>
      <div className="grid grid-cols-2 gap-4">
        {valuation.appraisedValue ? (
          <div>
            <dt className="mb-1 text-xs text-white/40">Appraised Value</dt>
            <dd className="font-medium text-white">
              ${valuation.appraisedValue.toLocaleString()}
            </dd>
          </div>
        ) : null}
        {valuation.replacementValue ? (
          <div>
            <dt className="mb-1 text-xs text-white/40">Replacement Value</dt>
            <dd className="font-medium text-white">
              ${valuation.replacementValue.toLocaleString()}
            </dd>
          </div>
        ) : null}
        {valuation.appraiser ? (
          <div>
            <dt className="mb-1 text-xs text-white/40">Appraiser</dt>
            <dd className="text-white">{valuation.appraiser}</dd>
          </div>
        ) : null}
        {valuation.lastAppraisalDate ? (
          <div>
            <dt className="mb-1 text-xs text-white/40">Last Appraisal</dt>
            <dd className="text-white">
              <ClientDate timestamp={valuation.lastAppraisalDate} />
            </dd>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PublicObjectTags({ tags }: { tags?: string[] | null }) {
  if (!tags || tags.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-sm text-white/80"
        >
          <Tag className="size-3" />
          {tag}
        </span>
      ))}
    </div>
  );
}

function PublicObjectInformation({ object }: PublicObjectDetailProps) {
  return (
    <div className="space-y-8">
      <PublicObjectHeading object={object} />
      <PublicObjectMetadata object={object} />
      <TextSection title="Description" value={object.description} />
      <TextSection title="Inscriptions" value={object.inscriptions} />
      <TextSection title="Provenance" value={object.provenance} />
      <TextSection
        title="Exhibition History"
        value={object.exhibitionHistory}
      />
      <PublicObjectValuation object={object} />
      {object.creditLine ? (
        <div className="border-white/10 border-t pt-4">
          <p className="text-white/60 italic">{object.creditLine}</p>
        </div>
      ) : null}
      <PublicObjectTags tags={object.tags} />
      <div className="border-white/10 border-t pt-4">
        <p className="text-sm text-white/40">
          From the collection of {object.organizationName}
        </p>
      </div>
    </div>
  );
}

export function PublicObjectDetail({ object }: PublicObjectDetailProps) {
  return (
    <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
      <PublicObjectGallery object={object} />
      <PublicObjectInformation object={object} />
    </div>
  );
}
