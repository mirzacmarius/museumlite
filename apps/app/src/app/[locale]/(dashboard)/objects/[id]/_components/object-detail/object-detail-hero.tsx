"use client";

import { Button } from "@v1/ui/button";
import { ImageLightbox, type LightboxImage } from "@v1/ui/image-lightbox";
import { cn } from "@v1/ui/utils";
import {
  ArrowRightLeft,
  Calendar,
  Image as ImageIcon,
  MapPin,
  Maximize2,
  UserRound,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { getCollectionStatusLabel } from "@/lib/record-enum-labels";
import { useI18n } from "@/locales/client";
import type { ObjectDetailData } from "../types";

const chipClass =
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium";

interface PendingMoveRequest {
  _id: string;
  status: string;
  targetOrganizationName: string;
}

interface ObjectDetailHeroProps {
  collection: NonNullable<ObjectDetailData["collection"]>;
  heroImage: ObjectDetailData["heroImage"];
  heroLightboxImages: LightboxImage[];
  isHeroLightboxOpen: boolean;
  onHeroLightboxOpenChange: (open: boolean) => void;
  pendingMoveRequest?: PendingMoveRequest | null;
  locationString: string | null;
  isOnDisplay: boolean;
  viewFullSizeLabel: string;
  onDisplayLabel: string;
  unknownLabel: string;
}

export function ObjectDetailHero({
  collection,
  heroImage,
  heroLightboxImages,
  isHeroLightboxOpen,
  onHeroLightboxOpenChange,
  pendingMoveRequest,
  locationString,
  isOnDisplay,
  viewFullSizeLabel,
  onDisplayLabel,
  unknownLabel,
}: ObjectDetailHeroProps) {
  const tRoot = useI18n();
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const primaryImageIndex = heroLightboxImages.findIndex(
    (image) => image.id === heroImage?._id,
  );
  const selectedImageIndex = heroLightboxImages.findIndex(
    (image) => image.id === selectedImageId,
  );
  const activeImageIndex =
    selectedImageIndex >= 0
      ? selectedImageIndex
      : Math.max(primaryImageIndex, 0);
  const activeImage = heroLightboxImages[activeImageIndex];
  const heroPreviewUrl =
    activeImage?.thumbnailUrl ||
    activeImage?.url ||
    heroImage?.thumbnailUrl ||
    heroImage?.url;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-4 sm:px-6 sm:pt-8 sm:pb-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-8">
        <div className="shrink-0">
          {heroPreviewUrl ? (
            <button
              type="button"
              className="group relative block cursor-zoom-in rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              onClick={() => onHeroLightboxOpenChange(true)}
              aria-label={viewFullSizeLabel}
            >
              <Image
                src={heroPreviewUrl}
                alt={activeImage?.title || collection.title}
                width={176}
                height={176}
                className="size-36 rounded-xl border border-border/60 bg-secondary object-cover shadow-sm sm:size-44"
              />
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                <Maximize2 className="size-6 text-white" />
              </div>
            </button>
          ) : (
            <div className="flex size-20 items-center justify-center rounded-xl border border-dashed border-border bg-muted/40 sm:size-44">
              <ImageIcon
                className="size-8 text-muted-foreground/60 sm:size-10"
                aria-hidden
              />
            </div>
          )}

          {heroLightboxImages.length > 1 ? (
            <div className="mt-3 flex max-w-44 gap-2 overflow-x-auto pb-1">
              {heroLightboxImages.map((image, index) => (
                <button
                  key={image.id}
                  type="button"
                  aria-label={tRoot(
                    "untranslatedRecords.objects.media.showImage",
                    {
                      index: index + 1,
                      title: image.title || collection.title,
                    },
                  )}
                  aria-current={activeImageIndex === index ? "true" : undefined}
                  className={`relative size-12 shrink-0 overflow-hidden rounded-md border transition-colors ${
                    activeImageIndex === index
                      ? "border-primary ring-1 ring-primary"
                      : "border-border/60 hover:border-primary/50"
                  }`}
                  onClick={() => setSelectedImageId(image.id)}
                >
                  <Image
                    src={image.thumbnailUrl || image.url}
                    alt=""
                    fill
                    sizes="48px"
                    className="object-cover"
                  />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <ImageLightbox
          images={heroLightboxImages}
          initialIndex={activeImageIndex}
          isOpen={isHeroLightboxOpen}
          onClose={() => onHeroLightboxOpenChange(false)}
        />

        <div className="min-w-0 flex-1 space-y-3">
          {pendingMoveRequest ? (
            <div className="rounded-xl border border-status-info/30 bg-status-info/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-status-info-foreground dark:text-blue-100">
                    <ArrowRightLeft className="size-4" />
                    {pendingMoveRequest.status === "awaiting_acceptance"
                      ? tRoot(
                          "untranslatedRecords.objects.transfer.awaitingAcceptance",
                        )
                      : tRoot(
                          "untranslatedRecords.objects.transfer.pendingApproval",
                        )}
                  </div>
                  <p className="text-sm text-status-info-foreground dark:text-blue-200/80">
                    {tRoot("untranslatedRecords.objects.move.thisObject")}{" "}
                    {pendingMoveRequest.status === "awaiting_acceptance"
                      ? tRoot(
                          "untranslatedRecords.objects.transfer.awaitingAcceptanceShort",
                        )
                      : tRoot(
                          "untranslatedRecords.objects.transfer.awaitingApprovalShort",
                        )}{" "}
                    {tRoot("untranslatedRecords.objects.move.toMove")}{" "}
                    {pendingMoveRequest.targetOrganizationName}.
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link
                    href={`/objects/move-requests/${pendingMoveRequest._id}`}
                  >
                    {tRoot("untranslatedRecords.objects.move.openTransfer")}
                  </Link>
                </Button>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2.5">
            <div
              className={cn(
                chipClass,
                collection.status === "active"
                  ? "border-status-success/30 bg-status-success/10 text-status-success-foreground dark:text-emerald-400"
                  : "border-border bg-muted text-muted-foreground",
              )}
            >
              {getCollectionStatusLabel(collection.status, tRoot)}
            </div>

            {isOnDisplay ? (
              <div
                className={cn(
                  chipClass,
                  "border-status-success/30 bg-status-success/10 text-status-success-foreground dark:text-emerald-400",
                )}
              >
                {onDisplayLabel}
              </div>
            ) : null}

            <div
              className={cn(
                chipClass,
                "break-all border-border bg-muted/60 font-mono text-muted-foreground",
              )}
            >
              {collection.accessionNumber}
            </div>

            {collection.alternateAccessionNumbers?.map((number) => (
              <div
                key={number}
                className={cn(
                  chipClass,
                  "border-dashed border-border font-mono text-muted-foreground",
                )}
              >
                {number}
              </div>
            ))}
          </div>

          <h1 className="break-words text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            {collection.title}
          </h1>

          {collection.description ? (
            <p className="max-w-3xl break-words text-sm leading-relaxed text-muted-foreground">
              {collection.description}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="size-4" />
              <span>{collection.dateCreated || unknownLabel}</span>
            </div>
            {locationString ? (
              <div
                className={cn(
                  "flex items-center gap-2",
                  isOnDisplay
                    ? "text-status-success-foreground dark:text-emerald-400"
                    : "text-muted-foreground",
                )}
              >
                <MapPin className="size-4 shrink-0" />
                <span className="break-words">{locationString}</span>
              </div>
            ) : null}
            {collection.creator ? (
              <div className="flex items-center gap-2">
                <UserRound className="size-4" />
                <span>{collection.creator}</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
