"use client";

import { m } from "framer-motion";
import Image from "next/image";
import type { RefObject } from "react";
import { useEffect, useState } from "react";
import ReactCrop, { type Crop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import type {
  WatermarkPosition,
  WatermarkSettings,
} from "./media-editor-types";

interface MediaEditorViewportProps {
  imageUrl: string;
  imageTitle?: string;
  crop?: Crop;
  rotation: number;
  brightness: number;
  contrast: number;
  watermarkEnabled: boolean;
  watermarkSettings?: WatermarkSettings;
  watermarkPosition: WatermarkPosition;
  imageRef: RefObject<HTMLImageElement | null>;
  onCropChange: (crop: Crop) => void;
}

export function MediaEditorViewport({
  imageUrl,
  imageTitle,
  crop,
  rotation,
  brightness,
  contrast,
  watermarkEnabled,
  watermarkSettings,
  watermarkPosition,
  imageRef,
  onCropChange,
}: MediaEditorViewportProps) {
  const [imageDimensions, setImageDimensions] = useState({
    width: 1200,
    height: 800,
  });

  useEffect(() => {
    setImageDimensions({ width: 1200, height: 800 });
  }, [imageUrl]);

  return (
    <m.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="relative flex max-h-[85vh] max-w-[90vw] items-center justify-center"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="relative">
        <ReactCrop crop={crop} onChange={onCropChange} aspect={undefined}>
          <Image
            ref={imageRef}
            src={imageUrl}
            alt={imageTitle || "Image"}
            width={imageDimensions.width}
            height={imageDimensions.height}
            sizes="90vw"
            priority
            onLoad={(event) => {
              const { naturalWidth, naturalHeight } = event.currentTarget;
              setImageDimensions((current) =>
                current.width === naturalWidth &&
                current.height === naturalHeight
                  ? current
                  : { width: naturalWidth, height: naturalHeight },
              );
            }}
            className="h-auto max-h-[85vh] w-auto max-w-[90vw] object-contain"
            style={{
              transform: `rotate(${rotation}deg)`,
              filter: `brightness(${brightness}%) contrast(${contrast}%)`,
            }}
          />
        </ReactCrop>
        {watermarkEnabled && watermarkSettings?.text && (
          <div
            className="pointer-events-none absolute inset-0 flex"
            style={{
              transform: `rotate(${rotation}deg)`,
              alignItems:
                watermarkPosition === "top-left" ||
                watermarkPosition === "top-right"
                  ? "flex-start"
                  : watermarkPosition === "bottom-left" ||
                      watermarkPosition === "bottom-right"
                    ? "flex-end"
                    : "center",
              justifyContent:
                watermarkPosition === "top-left" ||
                watermarkPosition === "bottom-left"
                  ? "flex-start"
                  : watermarkPosition === "top-right" ||
                      watermarkPosition === "bottom-right"
                    ? "flex-end"
                    : "center",
              padding: "20px",
            }}
          >
            <div
              className="text-white font-medium"
              style={{
                opacity: watermarkSettings.opacity ?? 0.5,
                textShadow: "1px 1px 2px rgba(0, 0, 0, 0.5)",
                fontSize: "clamp(14px, 2.5vw, 24px)",
              }}
            >
              {watermarkSettings.text}
            </div>
          </div>
        )}
      </div>
    </m.div>
  );
}
