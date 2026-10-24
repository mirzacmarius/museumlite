"use client";

import { cn } from "@v1/ui/utils";
import Image from "next/image";
import QRCode from "qrcode";
import type * as React from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useI18n } from "@/locales/client";

export type LabelSize = "2x2" | "3x1" | "1x1";

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
 * Supports standard label sizes, width by height:
 * - 2x2 inches: Square format with large QR code
 * - 3x1 inches: Wide format with the QR code beside the text
 * - 1x1 inches: Compact square format
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
  size = "1x1",
  showObjectName = true,
  className,
  ref,
}: QRLabelGeneratorProps) {
  const translate = useI18n();
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const titleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const generateQRCode = async () => {
      try {
        // Generate QR code as data URL
        const dataUrl = await QRCode.toDataURL(data.qrCodeUrl, {
          width: size === "1x1" ? 150 : 180,
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

    const baseFontSize = size === "2x2" ? 8 : size === "3x1" ? 7 : 5.5;
    const minimumFontSize = size === "2x2" ? 5.5 : size === "3x1" ? 5 : 4;

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

  // Label dimensions are specified in physical inches for print output.
  const dimensions = {
    "2x2": {
      width: "2in",
      height: "2in",
      padding: "0.1in",
      qrSize: "1in",
    },
    "3x1": {
      width: "3in",
      height: "1in",
      padding: "0.1in",
      qrSize: "0.8in",
    },
    "1x1": {
      width: "1in",
      height: "1in",
      padding: "0.04in",
      qrSize: "0.48in",
    },
  };

  const labelStyle = dimensions[size];
  const isWide = size === "3x1";
  const textAlign = isWide ? "text-left" : "text-center";

  return (
    <div
      ref={ref}
      className={cn(
        "relative flex items-center bg-white text-black border border-zinc-300 overflow-hidden break-inside-avoid",
        isWide ? "flex-row gap-[0.1in]" : "flex-col",
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
          className="shrink-0"
          style={{
            width: labelStyle.qrSize,
            height: labelStyle.qrSize,
            marginBottom: isWide ? 0 : size === "1x1" ? "0.015in" : "0.04in",
          }}
        >
          <Image
            src={qrCodeDataUrl}
            alt={translate("untranslatedComponents.labels.qrCodeForAccession", {
              accession: data.accessionNumber,
            })}
            className="size-full object-contain"
            width={180}
            height={180}
            unoptimized
            style={{ imageRendering: "pixelated" }}
          />
        </div>
      )}

      {/* Text: under the QR code, or beside it on a wide label */}
      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col",
          isWide ? "justify-center self-stretch" : "w-full",
        )}
      >
        {/* Accession Number */}
        <div
          className={cn(
            "w-full shrink-0 font-mono font-bold text-black leading-tight",
            textAlign,
            size === "2x2"
              ? "mb-[0.04in] text-[10pt]"
              : size === "3x1"
                ? "mb-[0.04in] text-[9pt]"
                : "mb-[0.015in] text-[4.5pt]",
          )}
          style={{ wordBreak: "break-all" }}
        >
          {data.accessionNumber}
        </div>

        {/* Title */}
        {showObjectName ? (
          <div
            ref={titleRef}
            className={cn(
              "w-full min-h-0 flex-1 overflow-hidden text-black leading-tight",
              textAlign,
            )}
            style={{
              fontSize: `${size === "2x2" ? 8 : size === "3x1" ? 7 : 5}pt`,
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
              "w-full shrink-0 text-zinc-600 leading-tight",
              textAlign,
              size === "1x1" ? "mt-[0.015in]" : "mt-[0.04in]",
              size === "2x2"
                ? "text-[6pt]"
                : size === "3x1"
                  ? "text-[5.5pt]"
                  : "text-[3.5pt]",
            )}
            style={{
              wordBreak: "break-word",
              ...(size === "1x1"
                ? {
                    lineHeight: 1,
                    maxHeight: "0.12in",
                    overflow: "hidden",
                  }
                : {}),
            }}
          >
            {data.organizationName}
          </div>
        )}
      </div>
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
  size = "1x1",
  className,
  ref,
}: QRLabelSheetProps) {
  // Labels per row across an 8.5in sheet: 1in labels 8, 2in labels 4,
  // 3in labels 2.
  const gridCols = size === "2x2" ? 4 : size === "3x1" ? 2 : 8;

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
