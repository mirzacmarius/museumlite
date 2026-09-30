"use client";

import { cn } from "@v1/ui/utils";
import Image from "next/image";
import QRCode from "qrcode";
import type * as React from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

export type LabelSize = "2x2" | "1x3";

export interface LabelData {
  accessionNumber: string;
  title: string;
  qrCodeUrl: string;
  organizationName?: string;
}

interface QRLabelGeneratorProps {
  data: LabelData;
  size?: LabelSize;
  showObjectName?: boolean;
  className?: string;
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * QR Label Generator Component
 *
 * Generates printable labels with QR codes for collection objects.
 * Supports standard label sizes:
 * - 2x2 inches: Square format with large QR code
 * - 1x3 inches: Vertical format with smaller QR code
 *
 * @example
 * ```tsx
 * <QRLabelGenerator
 *   data={{
 *     accessionNumber: "2024.001",
 *     title: "Artwork Title",
 *     qrCodeUrl: "https://app.example.com/objects/123",
 *     organizationName: "Museum Name"
 *   }}
 *   size="2x2"
 * />
 * ```
 */
export function QRLabelGenerator({
  data,
  size = "2x2",
  showObjectName = true,
  className,
  ref,
}: QRLabelGeneratorProps) {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const titleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const generateQRCode = async () => {
      try {
        // Generate QR code as data URL
        const dataUrl = await QRCode.toDataURL(data.qrCodeUrl, {
          width: size === "2x2" ? 180 : 120,
          margin: 1,
          errorCorrectionLevel: "M",
          color: {
            dark: "#000000",
            light: "#FFFFFF",
          },
        });
        setQrCodeDataUrl(dataUrl);
      } catch (error) {
        console.error("Failed to generate QR code:", error);
      }
    };

    generateQRCode();
  }, [data.qrCodeUrl, size]);

  useLayoutEffect(() => {
    const title = titleRef.current;
    if (!title || !showObjectName) return;

    const baseFontSize = size === "2x2" ? 8 : 6;
    const minimumFontSize = size === "2x2" ? 5.5 : 4.5;

    const fitTitle = () => {
      let fittedFontSize = baseFontSize;
      title.style.fontSize = `${fittedFontSize}pt`;
      while (
        (title.scrollHeight > title.clientHeight ||
          title.scrollWidth > title.clientWidth) &&
        fittedFontSize > minimumFontSize
      ) {
        fittedFontSize = Math.max(minimumFontSize, fittedFontSize - 0.5);
        title.style.fontSize = `${fittedFontSize}pt`;
      }
    };

    fitTitle();
    const observer = new ResizeObserver(fitTitle);
    observer.observe(title);
    return () => observer.disconnect();
  }, [data.title, showObjectName, size, data.organizationName]);

  // Label dimensions in pixels (at 96 DPI)
  // 2x2 inch = 192x192px, 1x3 inch = 96x288px
  const dimensions = {
    "2x2": {
      width: "2in",
      height: "2in",
      padding: "0.1in",
      qrSize: "1in",
    },
    "1x3": {
      width: "1in",
      height: "3in",
      padding: "0.1in",
      qrSize: "0.75in",
    },
  };

  const labelStyle = dimensions[size];

  return (
    <div
      ref={ref}
      className={cn(
        "relative flex flex-col items-center bg-white text-black border border-zinc-300 overflow-hidden break-inside-avoid",
        "print:border-none print:break-inside-avoid print:page-break-inside-avoid",
        className,
      )}
      style={{
        width: labelStyle.width,
        height: labelStyle.height,
        padding: labelStyle.padding,
      }}
    >
      {/* QR Code */}
      {qrCodeDataUrl && (
        <div
          className="flex-shrink-0 mb-[0.04in]"
          style={{
            width: labelStyle.qrSize,
            height: labelStyle.qrSize,
          }}
        >
          <Image
            src={qrCodeDataUrl}
            alt={`QR code for ${data.accessionNumber}`}
            className="size-full object-contain"
            width={180}
            height={180}
            unoptimized
            style={{
              imageRendering: "pixelated",
            }}
          />
        </div>
      )}

      {/* Accession Number */}
      <div
        className={cn(
          "w-full shrink-0 text-center font-mono font-bold text-black leading-tight mb-[0.04in]",
          size === "2x2" ? "text-[10pt]" : "text-[7pt]",
        )}
        style={{
          wordBreak: "break-all",
        }}
      >
        {data.accessionNumber}
      </div>

      {/* Title */}
      {showObjectName ? (
        <div
          ref={titleRef}
          className="w-full min-h-0 flex-1 overflow-hidden text-center text-black leading-tight"
          style={{
            fontSize: `${size === "2x2" ? 8 : 6}pt`,
            wordBreak: "break-word",
            hyphens: "auto",
          }}
        >
          {data.title}
        </div>
      ) : null}

      {/* Organization Name (optional, bottom) */}
      {data.organizationName && (
        <div
          className={cn(
            "w-full shrink-0 text-center text-zinc-600 leading-tight mt-[0.04in]",
            size === "2x2" ? "text-[6pt]" : "text-[5pt]",
          )}
          style={{
            wordBreak: "break-word",
          }}
        >
          {data.organizationName}
        </div>
      )}
    </div>
  );
}

QRLabelGenerator.displayName = "QRLabelGenerator";

/**
 * QR Label Sheet Component
 *
 * Container for multiple labels arranged in a printable sheet layout.
 * Automatically arranges labels in a grid based on label size and paper size.
 */
interface QRLabelSheetProps {
  labels: LabelData[];
  size?: LabelSize;
  className?: string;
  ref?: React.Ref<HTMLDivElement>;
}

export function QRLabelSheet({
  labels,
  size = "2x2",
  className,
  ref,
}: QRLabelSheetProps) {
  // Calculate grid layout based on label size
  // For 2x2 labels: 4 per row (8.5in / 2in = 4.25)
  // For 1x3 labels: 8 per row (8.5in / 1in = 8.5)
  const gridCols = size === "2x2" ? 4 : 8;

  return (
    <div
      ref={ref}
      className={cn(
        "w-full min-h-screen bg-white p-4",
        "print:p-0 print:m-0",
        className,
      )}
    >
      <div
        className={cn("grid gap-2", "print:gap-0")}
        style={{
          gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
        }}
      >
        {labels.map((label) => (
          <QRLabelGenerator
            key={`${label.accessionNumber}-${label.qrCodeUrl}`}
            data={label}
            size={size}
          />
        ))}
      </div>
    </div>
  );
}

QRLabelSheet.displayName = "QRLabelSheet";
