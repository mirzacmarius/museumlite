"use client";

import { motion } from "framer-motion";
import type { RefObject } from "react";
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
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="relative flex max-h-[85vh] max-w-[90vw] items-center justify-center"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="relative">
        <ReactCrop crop={crop} onChange={onCropChange} aspect={undefined}>
          {/* biome-ignore lint/performance/noImgElement: react-image-crop requires a native img ref */}
          <img
            ref={imageRef}
            src={imageUrl}
            alt={imageTitle || "Image"}
            className="max-h-[85vh] max-w-[90vw] object-contain"
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
    </motion.div>
  );
}
