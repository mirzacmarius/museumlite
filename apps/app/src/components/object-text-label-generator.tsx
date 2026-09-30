"use client";

import { cn } from "@v1/ui/utils";
import QRCode from "qrcode";
import type * as React from "react";

export type ObjectTextLabelSize = "small" | "medium" | "large";

export interface ObjectTextLabelData {
  objectName: string;
  description: string;
  accessionNumber: string;
  accessionNumberLabel: string;
}

export interface ObjectTextLabelOptions {
  size?: ObjectTextLabelSize;
  showBorder?: boolean;
  showQrCode?: boolean;
  qrCodeUrl?: string;
  qrCodeAlt?: string;
  accessionFontSizePt?: number;
}

interface ObjectTextLabelGeneratorProps extends ObjectTextLabelOptions {
  data: ObjectTextLabelData;
  className?: string;
  ref?: React.Ref<HTMLDivElement>;
}

const LABEL_DIMENSIONS: Record<
  ObjectTextLabelSize,
  { width: string; height: string; padding: string }
> = {
  small: { width: "3in", height: "2in", padding: "0.2in" },
  medium: { width: "4in", height: "2.5in", padding: "0.25in" },
  large: { width: "5in", height: "3in", padding: "0.3in" },
};

export function ObjectTextLabelGenerator({
  data,
  size = "medium",
  showBorder = true,
  showQrCode = false,
  qrCodeUrl = "",
  qrCodeAlt = "QR code",
  accessionFontSizePt = 9,
  className,
  ref,
}: ObjectTextLabelGeneratorProps) {
  const dimensions = LABEL_DIMENSIONS[size];
  const accessionText = `(${data.accessionNumberLabel}: ${data.accessionNumber})`;
  const qrCode =
    showQrCode && qrCodeUrl
      ? QRCode.create(qrCodeUrl, { errorCorrectionLevel: "M" })
      : null;
  const qrCodeSize = qrCode?.modules.size ?? 0;
  const qrCodePath = qrCode
    ? Array.from({ length: qrCodeSize }, (_, row) =>
        Array.from({ length: qrCodeSize }, (_, column) =>
          qrCode.modules.get(row, column)
            ? `M${column + 4},${row + 4}h1v1h-1z`
            : "",
        ).join(""),
      ).join("")
    : "";

  return (
    <div
      ref={ref}
      className={cn(
        "relative flex flex-col bg-white text-black overflow-hidden break-inside-avoid font-sans",
        "print:break-inside-avoid print:page-break-inside-avoid",
        showBorder ? "border border-black" : "border border-transparent",
        className,
      )}
      style={{
        width: dimensions.width,
        height: dimensions.height,
        padding: dimensions.padding,
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-1">
        <p
          className="font-bold leading-tight text-black"
          style={{ fontSize: size === "large" ? "14pt" : "12pt" }}
        >
          {data.objectName}
        </p>
        {data.description ? (
          <p
            className="flex-1 whitespace-pre-wrap leading-snug text-black"
            style={{ fontSize: size === "small" ? "9pt" : "10pt" }}
          >
            {data.description}
          </p>
        ) : null}
      </div>
      <div className="mt-auto flex min-w-0 shrink-0 items-center gap-[0.08in]">
        {qrCode ? (
          <svg
            aria-label={qrCodeAlt}
            className="size-[0.65in] shrink-0"
            role="img"
            viewBox={`0 0 ${qrCodeSize + 8} ${qrCodeSize + 8}`}
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect width="100%" height="100%" fill="white" />
            <path d={qrCodePath} fill="black" />
          </svg>
        ) : null}
        <p
          className="min-w-0 flex-1 whitespace-normal break-words leading-tight text-black"
          style={{ fontSize: `${accessionFontSizePt}pt` }}
        >
          {accessionText}
        </p>
      </div>
    </div>
  );
}

ObjectTextLabelGenerator.displayName = "ObjectTextLabelGenerator";
