"use client";

import type { api } from "@v1/backend/convex/_generated/api";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { cn } from "@v1/ui/utils";
import type { FunctionReturnType } from "convex/server";
import {
  ArrowRightLeft,
  Calendar,
  Image as ImageIcon,
  Info,
  MapPin,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type {
  CollectionEditTabId,
  CollectionFormData,
} from "../collection-form-shared/types";

type CollectionDoc = NonNullable<
  FunctionReturnType<typeof api.collections.get>
>;

interface HeroImage {
  url: string | null;
  thumbnailUrl?: string | null;
}

interface PendingMoveRequest {
  _id: string;
  status: string;
  targetOrganizationName: string;
}

interface CollectionEditFormHeroProps {
  collection: CollectionDoc;
  formData: CollectionFormData;
  heroImage?: HeroImage | null;
  pendingMoveRequest?: PendingMoveRequest | null;
  placeholders: (key: string) => string;
  common: (key: string) => string;
  isLocationTrackingEnabled: boolean;
  locationSummary: string;
  collectionSummary: string;
  getStatusBadgeClass: (status: CollectionDoc["status"]) => string;
  onTitleChange: (value: string) => void;
  onTabSelect: (tabId: CollectionEditTabId) => void;
}

export function CollectionEditFormHero({
  collection,
  formData,
  heroImage,
  pendingMoveRequest,
  placeholders,
  common,
  isLocationTrackingEnabled,
  locationSummary,
  collectionSummary,
  getStatusBadgeClass,
  onTitleChange,
  onTabSelect,
}: CollectionEditFormHeroProps) {
  return (
    <div className="border-b border-border/60 bg-secondary/10 px-6 py-8 sm:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 lg:flex-row lg:items-start">
        <button
          type="button"
          className="group relative shrink-0 overflow-hidden rounded-2xl border border-border/60 bg-secondary transition-colors hover:border-primary/40"
          onClick={() => onTabSelect("media")}
        >
          {heroImage?.url ? (
            <Image
              src={heroImage.thumbnailUrl || heroImage.url}
              alt={collection.title}
              width={192}
              height={192}
              className="size-48 object-cover"
            />
          ) : (
            <div className="flex size-48 items-center justify-center">
              <ImageIcon className="size-12 text-muted-foreground" />
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-zinc-950/55 px-3 py-2 text-left text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
            Open media tab
          </div>
        </button>

        <div className="flex-1 space-y-6">
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
                getStatusBadgeClass(collection.status),
              )}
            >
              {collection.status}
            </div>
            <div className="rounded bg-background/80 px-2 py-1 text-[10px] font-mono text-muted-foreground">
              {collection.accessionNumber}
            </div>
          </div>

          <div className="space-y-3">
            <Label
              htmlFor="hero-title"
              className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground"
            >
              Object title
            </Label>
            <Input
              id="hero-title"
              value={formData.title}
              onChange={(event) => onTitleChange(event.target.value)}
              placeholder={placeholders("title")}
              className="h-14 border-border/60 bg-background/90 text-xl font-semibold sm:text-2xl"
              required
            />
          </div>

          <div className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-2 xl:grid-cols-4">
            <button
              type="button"
              className="rounded-xl border border-border/50 bg-background/70 p-3 text-left transition-colors hover:border-primary/30 hover:text-foreground"
              onClick={() => onTabSelect("general")}
            >
              <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                <Info className="size-3.5" />
                Creator
              </div>
              <div className="truncate text-sm text-foreground">
                {formData.creator || "Not set"}
              </div>
            </button>
            <button
              type="button"
              className="rounded-xl border border-border/50 bg-background/70 p-3 text-left transition-colors hover:border-primary/30 hover:text-foreground"
              onClick={() => onTabSelect("general")}
            >
              <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                <Calendar className="size-3.5" />
                Date created
              </div>
              <div className="truncate text-sm text-foreground">
                {formData.dateCreated || common("unknown")}
              </div>
            </button>
            {isLocationTrackingEnabled ? (
              <>
                <button
                  type="button"
                  className="rounded-xl border border-border/50 bg-background/70 p-3 text-left transition-colors hover:border-primary/30 hover:text-foreground"
                  onClick={() => onTabSelect("placement")}
                >
                  <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    <MapPin className="size-3.5" />
                    Location
                  </div>
                  <div className="truncate text-sm text-foreground">
                    {locationSummary}
                  </div>
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-border/50 bg-background/70 p-3 text-left transition-colors hover:border-primary/30 hover:text-foreground"
                  onClick={() => onTabSelect("placement")}
                >
                  <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    <Info className="size-3.5" />
                    Collection
                  </div>
                  <div className="truncate text-sm text-foreground">
                    {collectionSummary}
                  </div>
                </button>
              </>
            ) : null}
          </div>

          <p className="text-sm text-muted-foreground">
            Edit the record using the same structure as the object detail page.
            Field changes save together. Media uploads and primary image changes
            apply immediately.
          </p>
        </div>
      </div>
    </div>
  );
}
