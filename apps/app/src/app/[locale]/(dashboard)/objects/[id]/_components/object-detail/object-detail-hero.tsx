"use client";

import { Button } from "@v1/ui/button";
import { ImageLightbox, type LightboxImage } from "@v1/ui/image-lightbox";
import { cn } from "@v1/ui/utils";
import {
  ArrowRightLeft,
  Calendar,
  Image as ImageIcon,
  Info,
  MapPin,
  Maximize2,
} from "lucide-react";
import Link from "next/link";
import type { ObjectDetailData } from "../types";

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
  return (
    <div className="border-b border-border/60 bg-secondary/10 p-8">
      <div className="mx-auto flex max-w-5xl items-start gap-8">
        <button
          type="button"
          className="group relative shrink-0 cursor-zoom-in"
          onClick={() => heroImage?.url && onHeroLightboxOpenChange(true)}
          aria-label={viewFullSizeLabel}
        >
          {heroImage?.url ? (
            <img
              src={heroImage.thumbnailUrl || heroImage.url}
              alt={collection.title}
              className="size-48 rounded-xl border border-border/60 bg-secondary object-cover shadow-2xl transition-transform duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex size-48 items-center justify-center rounded-xl border border-border/60 bg-secondary">
              <ImageIcon className="size-12 text-muted-foreground" />
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
            <Maximize2 className="size-6 text-white" />
          </div>
        </button>

        <ImageLightbox
          images={heroLightboxImages}
          initialIndex={0}
          isOpen={isHeroLightboxOpen}
          onClose={() => onHeroLightboxOpenChange(false)}
        />

        <div className="flex-1 space-y-4">
          {pendingMoveRequest ? (
            <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-blue-100">
                    <ArrowRightLeft className="size-4" />
                    {pendingMoveRequest.status === "awaiting_acceptance"
                      ? "Awaiting transfer acceptance"
                      : "Pending transfer approval"}
                  </div>
                  <p className="text-sm text-blue-200/80">
                    This object is{" "}
                    {pendingMoveRequest.status === "awaiting_acceptance"
                      ? "awaiting acceptance"
                      : "awaiting approval"}{" "}
                    to move to {pendingMoveRequest.targetOrganizationName}.
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link
                    href={`/objects/move-requests/${pendingMoveRequest._id}`}
                  >
                    Open transfer request
                  </Link>
                </Button>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2.5">
            <div
              className={cn(
                "rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider",
                collection.status === "active"
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {collection.status}
            </div>

            {isOnDisplay ? (
              <div className="rounded bg-emerald-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                {onDisplayLabel}
              </div>
            ) : null}

            <div className="rounded bg-secondary/60 px-2 py-1 text-[10px] font-mono text-muted-foreground">
              {collection.accessionNumber}
            </div>

            {collection.alternateAccessionNumbers?.map((number) => (
              <div
                key={number}
                className="rounded border border-border/60 bg-background/60 px-2 py-1 text-[10px] font-mono text-muted-foreground"
              >
                {number}
              </div>
            ))}
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">
            {collection.title}
          </h1>

          {collection.description ? (
            <p className="text-sm text-muted-foreground">
              {collection.description}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="size-4" />
              <span>{collection.dateCreated || unknownLabel}</span>
            </div>
            {locationString ? (
              <div
                className={cn(
                  "flex items-center gap-2",
                  isOnDisplay ? "text-emerald-400" : "text-muted-foreground",
                )}
              >
                <MapPin className="size-4" />
                <span>{locationString}</span>
              </div>
            ) : null}
            {collection.creator ? (
              <div className="flex items-center gap-2">
                <Info className="size-4" />
                <span>{collection.creator}</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
