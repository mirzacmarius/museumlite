"use client";

import { Badge } from "@v1/ui/badge";
import { cn } from "@v1/ui/utils";
import type { MediaDisplayKind } from "./media-gallery-utils";

interface MediaGalleryFileTypeBadgeProps {
  kind: MediaDisplayKind;
  label: string;
  className?: string;
}

const kindStyles: Record<MediaDisplayKind, string> = {
  image: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  video: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  pdf: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  document: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  model3d: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  embed3d: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  unsupported: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
};

export function MediaGalleryFileTypeBadge({
  kind,
  label,
  className,
}: MediaGalleryFileTypeBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "pointer-events-none border px-1.5 py-0 text-[10px] font-medium uppercase tracking-wide",
        kindStyles[kind],
        className,
      )}
    >
      {label}
    </Badge>
  );
}
