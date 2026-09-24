"use client";

import { Button } from "@v1/ui/button";
import { Label } from "@v1/ui/label";
import { Image as ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import Image from "next/image";
import type { RefObject } from "react";
import { useScopedI18n } from "@/locales/client";

interface LocationImageFieldProps {
  name: string;
  locationImageId: string | null;
  locationImagePreviewUrl: string | null;
  existingImageUrl?: string | null;
  isUploadingImage: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
  readOnly?: boolean;
}

export function LocationImageField({
  name,
  locationImageId,
  locationImagePreviewUrl,
  existingImageUrl = null,
  isUploadingImage,
  fileInputRef,
  onUpload,
  onRemove,
  readOnly = false,
}: LocationImageFieldProps) {
  const t = useScopedI18n("locations.form");
  const locationImageUrl =
    locationImagePreviewUrl ?? (locationImageId ? existingImageUrl : null);

  return (
    <div className="grid gap-2">
      <Label>{t("locationPhotoLabel")}</Label>
      <div className="overflow-hidden rounded-xl border border-border/60 bg-secondary/20">
        <div className="relative aspect-[16/9] bg-muted/30">
          {locationImageUrl ? (
            <Image
              src={locationImageUrl}
              alt={name || "Location photo"}
              fill
              sizes="(max-width: 768px) 100vw, 400px"
              className="object-cover"
            />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground">
              <ImageIcon className="size-8" />
              <span className="text-sm">{t("locationPhotoEmpty")}</span>
            </div>
          )}
        </div>
        {!readOnly ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-4 py-3">
            <p className="text-xs text-muted-foreground">
              {t("locationPhotoHint")}
            </p>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={onUpload}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingImage}
              >
                {isUploadingImage ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 size-4" />
                )}
                {locationImageId
                  ? t("replaceLocationPhoto")
                  : t("uploadLocationPhoto")}
              </Button>
              {locationImageId ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={onRemove}
                >
                  <Trash2 className="mr-2 size-4" />
                  {t("removeLocationPhoto")}
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
