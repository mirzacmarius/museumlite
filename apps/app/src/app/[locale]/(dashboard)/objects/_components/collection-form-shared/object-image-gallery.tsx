"use client";

import { Button } from "@v1/ui/button";
import { Camera, Image as ImageIcon, Upload } from "lucide-react";
import Image from "next/image";
import type React from "react";
import type { RefObject } from "react";

import { useI18n } from "@/locales/client";
export interface ObjectImageGalleryItem {
  id: string;
  src: string;
  thumbnailSrc?: string | null;
  alt: string;
  isPrimary?: boolean;
}

interface ObjectImageGalleryProps {
  images: ObjectImageGalleryItem[];
  fileInputRef: RefObject<HTMLInputElement | null>;
  cameraInputRef: RefObject<HTMLInputElement | null>;
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export function ObjectImageGallery({
  images,
  fileInputRef,
  cameraInputRef,
  onFileSelect,
}: ObjectImageGalleryProps) {
  const tRoot = useI18n();
  const primaryImage = images.find((image) => image.isPrimary);
  const activeImage = primaryImage ?? images[0];

  return (
    <div className="w-full max-w-sm shrink-0 lg:w-80 lg:max-w-none">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={onFileSelect}
        className="hidden"
        multiple
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onFileSelect}
        className="hidden"
      />
      <div className="group relative aspect-square w-full overflow-hidden rounded-2xl border border-border/60 bg-secondary transition-colors hover:border-primary/40">
        {activeImage ? (
          <Image
            src={activeImage.src}
            alt={activeImage.alt}
            fill
            sizes="320px"
            className="object-cover"
          />
        ) : (
          <div
            className="flex size-full items-center justify-center"
            aria-hidden="true"
          >
            <ImageIcon className="size-12 text-muted-foreground" />
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 z-10 flex gap-1.5 p-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 min-w-0 flex-1 gap-1 px-2 text-[10px]"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="size-3.5 shrink-0" />
            {tRoot("accounts.detail.upload")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 min-w-0 flex-1 gap-1 px-2 text-[10px]"
            onClick={() => cameraInputRef.current?.click()}
          >
            <Camera className="size-3.5 shrink-0" />
            {tRoot("untranslatedRecords.objects.form.takePhoto")}
          </Button>
        </div>
      </div>
    </div>
  );
}
