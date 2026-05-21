"use client";

import { AnimatePresence, m } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { cn } from "../utils";

function isUnoptimizedSrc(src: string) {
  return src.startsWith("blob:") || src.startsWith("data:");
}

export interface LightboxImage {
  id: string;
  url: string;
  thumbnailUrl?: string;
  title?: string;
  caption?: string;
}

interface ImageLightboxProps {
  images: LightboxImage[];
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
  onDownload?: (image: LightboxImage) => void;
}

export function ImageLightbox({
  images,
  initialIndex = 0,
  isOpen,
  onClose,
  onDownload,
}: ImageLightboxProps) {
  const [isZoomed, setIsZoomed] = useState(false);

  if (!isOpen) return null;

  return (
    <ImageLightboxPanel
      key={initialIndex}
      images={images}
      initialIndex={initialIndex}
      isZoomed={isZoomed}
      setIsZoomed={setIsZoomed}
      onClose={onClose}
      onDownload={onDownload}
    />
  );
}

function ImageLightboxPanel({
  images,
  initialIndex,
  isZoomed,
  setIsZoomed,
  onClose,
  onDownload,
}: {
  images: LightboxImage[];
  initialIndex: number;
  isZoomed: boolean;
  setIsZoomed: (value: boolean) => void;
  onClose: () => void;
  onDownload?: (image: LightboxImage) => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const currentImage = images[currentIndex];
  const hasMultiple = images.length > 1;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          onClose();
          break;
        case "ArrowLeft":
          if (hasMultiple) {
            setCurrentIndex((prev) =>
              prev > 0 ? prev - 1 : images.length - 1,
            );
          }
          break;
        case "ArrowRight":
          if (hasMultiple) {
            setCurrentIndex((prev) =>
              prev < images.length - 1 ? prev + 1 : 0,
            );
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasMultiple, images.length, onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  }, [images.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  }, [images.length]);

  const handleDownload = useCallback(() => {
    if (onDownload && currentImage) {
      onDownload(currentImage);
    } else if (currentImage) {
      // Default download behavior
      const link = document.createElement("a");
      link.href = currentImage.url;
      link.download = currentImage.title || "image";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, [currentImage, onDownload]);

  if (!currentImage) return null;

  return (
    <AnimatePresence>
      <m.div
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
            {hasMultiple && (
              <span className="text-sm text-muted-foreground">
                {currentIndex + 1} / {images.length}
              </span>
            )}
            {currentImage.title && (
              <span className="text-sm font-medium text-foreground">
                {currentImage.title}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsZoomed(!isZoomed);
              }}
              className="rounded-lg p-2 text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
              aria-label={isZoomed ? "Zoom out" : "Zoom in"}
            >
              {isZoomed ? <ZoomOut size={20} /> : <ZoomIn size={20} />}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDownload();
              }}
              className="rounded-lg p-2 text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Download image"
            >
              <Download size={20} />
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

        {/* Main image */}
        <m.div
          key={currentImage.id}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className={cn(
            "relative flex h-[85vh] w-[90vw] max-h-[85vh] max-w-[90vw] items-center justify-center",
            isZoomed && "cursor-zoom-out",
            !isZoomed && "cursor-zoom-in",
          )}
          onClick={(e) => {
            e.stopPropagation();
            setIsZoomed(!isZoomed);
          }}
        >
          <Image
            src={currentImage.url}
            alt={currentImage.title || "Image"}
            fill
            sizes="90vw"
            unoptimized={isUnoptimizedSrc(currentImage.url)}
            className={cn(
              "rounded-lg object-contain transition-transform duration-300",
              isZoomed ? "scale-150" : "scale-100",
            )}
          />
        </m.div>

        {/* Navigation arrows */}
        {hasMultiple && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goToPrevious();
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-card/40 border border-border/60 backdrop-blur-xl p-3 text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Previous image"
            >
              <ChevronLeft size={24} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goToNext();
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-card/40 border border-border/60 backdrop-blur-xl p-3 text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Next image"
            >
              <ChevronRight size={24} />
            </button>
          </>
        )}

        {/* Bottom caption */}
        {currentImage.caption && (
          <div className="absolute bottom-0 left-0 right-0 bg-card/40 border-t border-border/60 backdrop-blur-xl p-4 text-center">
            <p className="text-sm text-foreground/90">{currentImage.caption}</p>
          </div>
        )}

        {/* Thumbnail strip for multiple images */}
        {hasMultiple && images.length <= 12 && (
          <div className="absolute bottom-16 left-1/2 flex -translate-x-1/2 gap-2 rounded-lg bg-card/40 border border-border/60 backdrop-blur-xl p-2">
            {images.map((img, idx) => (
              <button
                key={img.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(idx);
                }}
                className={cn(
                  "relative size-12 overflow-hidden rounded border-2 transition-all",
                  idx === currentIndex
                    ? "border-white"
                    : "border-transparent opacity-60 hover:opacity-100",
                )}
              >
                <Image
                  src={img.thumbnailUrl || img.url}
                  alt={img.title || `Thumbnail ${idx + 1}`}
                  fill
                  sizes="48px"
                  unoptimized={isUnoptimizedSrc(img.thumbnailUrl || img.url)}
                  className="object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </m.div>
    </AnimatePresence>
  );
}

// Convenience hook for managing lightbox state
export function useLightbox(images: LightboxImage[]) {
  const [isOpen, setIsOpen] = useState(false);
  const [initialIndex, setInitialIndex] = useState(0);

  const openLightbox = useCallback((index: number) => {
    setInitialIndex(index);
    setIsOpen(true);
  }, []);

  const closeLightbox = useCallback(() => {
    setIsOpen(false);
  }, []);

  return {
    isOpen,
    initialIndex,
    openLightbox,
    closeLightbox,
    images,
  };
}
