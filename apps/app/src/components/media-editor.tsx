"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, RotateCcw, RotateCw, Save, X } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactCrop, { type Crop, type PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { toast } from "sonner";

export interface MediaEditorImage {
  id: string;
  url: string;
  title?: string;
}

export interface WatermarkSettings {
  isEnabled?: boolean;
  text?: string;
  opacity?: number;
  position?:
    | "center"
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right";
}

interface MediaEditorProps {
  image: MediaEditorImage;
  isOpen: boolean;
  onClose: () => void;
  onSave?: (editedBlob: Blob, editMetadata: EditMetadata) => Promise<void>;
  watermarkSettings?: WatermarkSettings;
}

export interface EditMetadata {
  crop?: PixelCrop;
  rotation?: number;
  brightness?: number;
  contrast?: number;
  watermark?: {
    enabled: boolean;
    position?: string;
  };
}

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
  const [watermarkPosition, setWatermarkPosition] = useState<
    "center" | "top-left" | "top-right" | "bottom-left" | "bottom-right"
  >(watermarkSettings?.position ?? "bottom-right");

  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Reset state when opening
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

  // Keyboard navigation
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

  // Prevent body scroll when open
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

  const handleRotateLeft = useCallback(() => {
    setRotation((prev) => (prev - 90) % 360);
  }, []);

  const handleRotateRight = useCallback(() => {
    setRotation((prev) => (prev + 90) % 360);
  }, []);

  const applyEdits = useCallback(async () => {
    if (!imageRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const sourceImage = imageRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    // Determine canvas size based on crop or full image
    const cropWidth = completedCrop?.width || sourceImage.naturalWidth;
    const cropHeight = completedCrop?.height || sourceImage.naturalHeight;

    // Adjust canvas size for rotation
    if (rotation % 180 === 90 || rotation % 180 === -90) {
      canvas.width = cropHeight;
      canvas.height = cropWidth;
    } else {
      canvas.width = cropWidth;
      canvas.height = cropHeight;
    }

    // Save context state
    ctx.save();

    // Apply rotation
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);

    // Apply brightness and contrast filters
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;

    // Draw the cropped/rotated image
    if (completedCrop) {
      ctx.drawImage(
        sourceImage,
        completedCrop.x,
        completedCrop.y,
        completedCrop.width,
        completedCrop.height,
        0,
        0,
        canvas.width,
        canvas.height,
      );
    } else {
      ctx.drawImage(
        sourceImage,
        0,
        0,
        sourceImage.naturalWidth,
        sourceImage.naturalHeight,
        0,
        0,
        canvas.width,
        canvas.height,
      );
    }

    // Restore context state
    ctx.restore();

    // Apply watermark if enabled
    if (watermarkEnabled && watermarkSettings?.text) {
      const watermarkText = watermarkSettings.text;
      const opacity = watermarkSettings.opacity ?? 0.5;

      // Calculate font size based on canvas dimensions (2.5% of width)
      const fontSize = Math.max(16, canvas.width * 0.025);
      ctx.font = `${fontSize}px Arial`;
      ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
      ctx.strokeStyle = `rgba(0, 0, 0, ${opacity * 0.5})`;
      ctx.lineWidth = 2;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Calculate position
      const padding = 20;
      let x = canvas.width / 2;
      let y = canvas.height / 2;

      switch (watermarkPosition) {
        case "center":
          x = canvas.width / 2;
          y = canvas.height / 2;
          break;
        case "top-left":
          ctx.textAlign = "left";
          ctx.textBaseline = "top";
          x = padding;
          y = padding;
          break;
        case "top-right":
          ctx.textAlign = "right";
          ctx.textBaseline = "top";
          x = canvas.width - padding;
          y = padding;
          break;
        case "bottom-left":
          ctx.textAlign = "left";
          ctx.textBaseline = "bottom";
          x = padding;
          y = canvas.height - padding;
          break;
        case "bottom-right":
          ctx.textAlign = "right";
          ctx.textBaseline = "bottom";
          x = canvas.width - padding;
          y = canvas.height - padding;
          break;
      }

      // Draw watermark with stroke for better visibility
      ctx.strokeText(watermarkText, x, y);
      ctx.fillText(watermarkText, x, y);
    }
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
      // Apply edits to canvas
      await applyEdits();

      // Convert canvas to blob
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

      // Prepare edit metadata
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
      // Convert percentage crop to pixel crop
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-background backdrop-blur-sm"
          onClick={onClose}
        >
          {/* Top toolbar */}
          <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between bg-card/40 border-b border-border/60 backdrop-blur-xl p-4">
            <div className="flex items-center gap-4">
              {image.title && (
                <span className="text-sm font-medium text-foreground">
                  Editing: {image.title}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRotateLeft();
                }}
                className="rounded-lg p-2 text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
                aria-label="Rotate left"
              >
                <RotateCcw size={20} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRotateRight();
                }}
                className="rounded-lg p-2 text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
                aria-label="Rotate right"
              >
                <RotateCw size={20} />
              </button>
              {crop && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleApplyCrop();
                  }}
                  className="rounded-lg p-2 text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
                  aria-label="Apply crop"
                >
                  <Check size={20} />
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSave();
                }}
                disabled={isSaving}
                className="rounded-lg p-2 text-foreground/80 transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
                aria-label="Save"
              >
                <Save size={20} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="rounded-lg p-2 text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Main editing area */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="relative flex max-h-[85vh] max-w-[90vw] items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                aspect={undefined}
              >
                <img
                  ref={imageRef}
                  src={image.url}
                  alt={image.title || "Image"}
                  className="max-h-[85vh] max-w-[90vw] object-contain"
                  style={{
                    transform: `rotate(${rotation}deg)`,
                    filter: `brightness(${brightness}%) contrast(${contrast}%)`,
                  }}
                />
              </ReactCrop>
              {/* Watermark preview overlay */}
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

          {/* Bottom controls */}
          <div className="absolute bottom-0 left-0 right-0 z-10 bg-card/40 border-t border-border/60 backdrop-blur-xl p-4">
            <div className="grid grid-cols-2 gap-4 max-w-4xl mx-auto">
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="brightness"
                  className="text-xs text-muted-foreground"
                >
                  Brightness: {brightness}%
                </label>
                <input
                  id="brightness"
                  type="range"
                  min="0"
                  max="200"
                  value={brightness}
                  onChange={(e) => setBrightness(Number(e.target.value))}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="contrast"
                  className="text-xs text-muted-foreground"
                >
                  Contrast: {contrast}%
                </label>
                <input
                  id="contrast"
                  type="range"
                  min="0"
                  max="200"
                  value={contrast}
                  onChange={(e) => setContrast(Number(e.target.value))}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full"
                />
              </div>
              {watermarkSettings?.text && (
                <>
                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor="watermark-toggle"
                      className="text-xs text-muted-foreground"
                    >
                      Watermark
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="watermark-toggle"
                        type="checkbox"
                        checked={watermarkEnabled}
                        onChange={(e) => setWatermarkEnabled(e.target.checked)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 rounded border-border"
                      />
                      <span className="text-xs text-foreground">
                        {watermarkSettings.text}
                      </span>
                    </div>
                  </div>
                  {watermarkEnabled && (
                    <div className="flex flex-col gap-2">
                      <label
                        htmlFor="watermark-position"
                        className="text-xs text-muted-foreground"
                      >
                        Position
                      </label>
                      <select
                        id="watermark-position"
                        value={watermarkPosition}
                        onChange={(e) =>
                          setWatermarkPosition(
                            e.target.value as typeof watermarkPosition,
                          )
                        }
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            // Select element handles this natively, but handler satisfies linter
                          }
                        }}
                        className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                      >
                        <option value="center">Center</option>
                        <option value="top-left">Top Left</option>
                        <option value="top-right">Top Right</option>
                        <option value="bottom-left">Bottom Left</option>
                        <option value="bottom-right">Bottom Right</option>
                      </select>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Hidden canvas for applying edits */}
          <canvas ref={canvasRef} className="hidden" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
