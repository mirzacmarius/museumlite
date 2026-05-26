"use client";

import { Button } from "@v1/ui/button";
import { AlertCircle, Download, ExternalLink } from "lucide-react";

interface MediaGalleryPreviewFallbackProps {
  title: string;
  description: string;
  openLabel: string;
  downloadLabel: string;
  href?: string | null;
  variant?: "inline" | "card";
}

export function MediaGalleryPreviewFallback({
  title,
  description,
  openLabel,
  downloadLabel,
  href,
  variant = "card",
}: MediaGalleryPreviewFallbackProps) {
  if (!href) {
    return (
      <div
        className={
          variant === "card"
            ? "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center"
            : "flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
        }
      >
        <AlertCircle className="size-4 shrink-0" />
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    );
  }

  return (
    <div
      className={
        variant === "card"
          ? "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center"
          : "flex flex-col gap-2 rounded-md border border-border/60 bg-muted/30 p-3"
      }
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        <AlertCircle className="size-4 shrink-0" />
        <div className="text-left">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button type="button" size="sm" variant="outline" asChild>
          <a href={href} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-1.5 size-3.5" />
            {openLabel}
          </a>
        </Button>
        <Button type="button" size="sm" variant="secondary" asChild>
          <a href={href} download target="_blank" rel="noopener noreferrer">
            <Download className="mr-1.5 size-3.5" />
            {downloadLabel}
          </a>
        </Button>
      </div>
    </div>
  );
}
