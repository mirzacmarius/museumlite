"use client";

import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Image as ImageIcon } from "lucide-react";
import Image from "next/image";
import type {
  CollectionEditTabId,
  CollectionFormData,
} from "../collection-form-shared/types";

interface HeroImagePreview {
  previewUrl: string;
  file: File;
}

interface ObjectRequestFormHeroProps {
  formData: CollectionFormData;
  heroImage?: HeroImagePreview | null;
  pageBadge: string;
  isDraftCurrent: boolean;
  hasSavedFieldDraft: boolean;
  placeholders: (key: string) => string;
  onTitleChange: (value: string) => void;
  onTabSelect: (tabId: CollectionEditTabId) => void;
}

export function ObjectRequestFormHero({
  formData,
  heroImage,
  pageBadge,
  isDraftCurrent,
  hasSavedFieldDraft,
  placeholders,
  onTitleChange,
  onTabSelect,
}: ObjectRequestFormHeroProps) {
  return (
    <div className="border-b border-border/60 bg-secondary/10 px-6 py-8 sm:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 lg:flex-row lg:items-start">
        <button
          type="button"
          className="group relative shrink-0 overflow-hidden rounded-2xl border border-border/60 bg-secondary transition-colors hover:border-primary/40"
          onClick={() => onTabSelect("media")}
        >
          {heroImage ? (
            <Image
              src={heroImage.previewUrl}
              alt={heroImage.file.name}
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
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-500">
              {pageBadge}
            </div>
            <div className="rounded bg-background/80 px-2 py-1 text-[10px] font-mono text-muted-foreground">
              {isDraftCurrent
                ? "Draft saved"
                : hasSavedFieldDraft
                  ? "Draft outdated"
                  : "Not created yet"}
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

          <p className="text-sm text-muted-foreground">
            Build the record using the same tab structure as object detail and
            edit. Draft saves keep this object in the accession draft workflow
            until you explicitly submit it for approval. Images and documents
            stay local until you submit the object request for approval.
          </p>
        </div>
      </div>
    </div>
  );
}
