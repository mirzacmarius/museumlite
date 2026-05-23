"use client";

import { cn } from "@v1/ui/utils";
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
  accessionFontSizePt = 9,
  className,
  ref,
}: ObjectTextLabelGeneratorProps) {
  const dimensions = LABEL_DIMENSIONS[size];
  const accessionText = `(${data.accessionNumberLabel}: ${data.accessionNumber})`;

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
      <p
        className="mt-auto shrink-0 leading-tight text-black"
        style={{ fontSize: `${accessionFontSizePt}pt` }}
      >
        {accessionText}
      </p>
    </div>
  );
}

ObjectTextLabelGenerator.displayName = "ObjectTextLabelGenerator";
