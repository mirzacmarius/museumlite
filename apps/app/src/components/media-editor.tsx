"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Crop, PixelCrop } from "react-image-crop";
import { toast } from "sonner";
import { applyMediaEditsToCanvas } from "./media-editor-canvas-utils";
import { MediaEditorControls } from "./media-editor-controls";
import { MediaEditorToolbar } from "./media-editor-toolbar";
import type {
  EditMetadata,
  MediaEditorProps,
  WatermarkPosition,
} from "./media-editor-types";
import { MediaEditorViewport } from "./media-editor-viewport";

export type {
  EditMetadata,
  MediaEditorImage,
  MediaEditorProps,
  WatermarkSettings,
} from "./media-editor-types";

export function MediaEditor({
  image,
  isOpen,
  onClose,
  onSave,
  watermarkSettings,
}: MediaEditorProps) {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [rotation, setRotation] = useState(0);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [isSaving, setIsSaving] = useState(false);
  const [watermarkEnabled, setWatermarkEnabled] = useState(
    watermarkSettings?.isEnabled ?? false,
  );
  const [watermarkPosition, setWatermarkPosition] = useState<WatermarkPosition>(
    watermarkSettings?.position ?? "bottom-right",
  );

  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (isOpen) {
      setCrop(undefined);
      setCompletedCrop(undefined);
      setRotation(0);
      setBrightness(100);
      setContrast(100);
      setIsSaving(false);
      setWatermarkEnabled(watermarkSettings?.isEnabled ?? false);
      setWatermarkPosition(watermarkSettings?.position ?? "bottom-right");
    }
  }, [isOpen, image.id, watermarkSettings]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const applyEdits = useCallback(async () => {
    if (!imageRef.current || !canvasRef.current) return;

    await applyMediaEditsToCanvas({
      canvas: canvasRef.current,
      sourceImage: imageRef.current,
      completedCrop,
      rotation,
      brightness,
      contrast,
      watermarkEnabled,
      watermarkSettings,
      watermarkPosition,
    });
  }, [
    completedCrop,
    rotation,
    brightness,
    contrast,
    watermarkEnabled,
    watermarkSettings,
    watermarkPosition,
  ]);

  const handleSave = useCallback(async () => {
    if (!canvasRef.current || !onSave) return;

    setIsSaving(true);

    try {
      await applyEdits();

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvasRef.current?.toBlob(
          (b) => {
            if (b) resolve(b);
            else reject(new Error("Failed to create blob"));
          },
          "image/png",
          0.95,
        );
      });

      const editMetadata: EditMetadata = {
        crop: completedCrop,
        rotation: rotation !== 0 ? rotation : undefined,
        brightness: brightness !== 100 ? brightness : undefined,
        contrast: contrast !== 100 ? contrast : undefined,
        watermark:
          watermarkEnabled && watermarkSettings?.text
            ? {
                enabled: true,
                position: watermarkPosition,
              }
            : undefined,
      };

      await onSave(blob, editMetadata);

      toast.success("Image saved successfully");
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save edited image",
      );
    } finally {
      setIsSaving(false);
    }
  }, [
    applyEdits,
    completedCrop,
    rotation,
    brightness,
    contrast,
    watermarkEnabled,
    watermarkSettings,
    watermarkPosition,
    onSave,
    onClose,
  ]);

  const handleApplyCrop = useCallback(() => {
    if (crop && imageRef.current) {
      const pixelCrop: PixelCrop = {
        x: (crop.x * imageRef.current.naturalWidth) / 100,
        y: (crop.y * imageRef.current.naturalHeight) / 100,
        width: (crop.width! * imageRef.current.naturalWidth) / 100,
        height: (crop.height! * imageRef.current.naturalHeight) / 100,
        unit: "px",
      };
      setCompletedCrop(pixelCrop);
      setCrop(undefined);
    }
  }, [crop]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-background backdrop-blur-sm"
          onClick={onClose}
        >
          <MediaEditorToolbar
            image={image}
            hasCrop={Boolean(crop)}
            isSaving={isSaving}
            onRotateLeft={() => setRotation((prev) => (prev - 90) % 360)}
            onRotateRight={() => setRotation((prev) => (prev + 90) % 360)}
            onApplyCrop={handleApplyCrop}
            onSave={handleSave}
            onClose={onClose}
          />

          <MediaEditorViewport
            imageUrl={image.url}
            imageTitle={image.title}
            crop={crop}
            rotation={rotation}
            brightness={brightness}
            contrast={contrast}
            watermarkEnabled={watermarkEnabled}
            watermarkSettings={watermarkSettings}
            watermarkPosition={watermarkPosition}
            imageRef={imageRef}
            onCropChange={setCrop}
          />

          <MediaEditorControls
            brightness={brightness}
            contrast={contrast}
            watermarkEnabled={watermarkEnabled}
            watermarkText={watermarkSettings?.text}
            watermarkPosition={watermarkPosition}
            onBrightnessChange={setBrightness}
            onContrastChange={setContrast}
            onWatermarkEnabledChange={setWatermarkEnabled}
            onWatermarkPositionChange={setWatermarkPosition}
          />

          <canvas ref={canvasRef} className="hidden" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
