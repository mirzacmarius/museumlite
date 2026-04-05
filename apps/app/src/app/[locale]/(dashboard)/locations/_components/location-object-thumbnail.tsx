"use client";

import {
  EntityPreview,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@v1/ui/hover-card";
import { cn } from "@v1/ui/utils";
import { Box, ExternalLink, Package } from "lucide-react";
import Link from "next/link";

interface LocationObjectThumbnailProps {
  object: {
    _id: string;
    title: string;
    accessionNumber?: string;
    status?: string;
    thumbnailUrl?: string | null;
  };
  className?: string;
  imageClassName?: string;
  titleClassName?: string;
  metadataLabel?: string;
  metadataValue?: string;
  showFooter?: boolean;
}

function formatStatus(status?: string) {
  if (!status) {
    return "Unknown";
  }

  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function LocationObjectThumbnail({
  object,
  className,
  imageClassName,
  titleClassName,
  metadataLabel,
  metadataValue,
  showFooter = false,
}: LocationObjectThumbnailProps) {
  const metadata = [
    {
      label: "Accession",
      value: object.accessionNumber ?? "Unassigned",
    },
    {
      label: "Status",
      value: formatStatus(object.status),
    },
  ];

  if (metadataLabel && metadataValue) {
    metadata.push({
      label: metadataLabel,
      value: metadataValue,
    });
  }

  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <Link
          href={`/objects/${object._id}`}
          className={cn(
            "group relative block overflow-hidden rounded-xl border border-white/10 bg-zinc-950/80 transition-all duration-300 hover:border-white/20 hover:bg-zinc-900",
            className,
          )}
        >
          <div
            className={cn(
              "relative flex aspect-[4/5] items-end overflow-hidden bg-gradient-to-br from-zinc-900 via-zinc-950 to-black",
              imageClassName,
            )}
          >
            {object.thumbnailUrl ? (
              <img
                src={object.thumbnailUrl}
                alt={object.title}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-[0_0_40px_rgba(255,255,255,0.06)]">
                  <Package className="h-7 w-7 text-zinc-300" />
                </div>
              </div>
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3">
              <div className="min-w-0">
                <div className="truncate text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-400">
                  {object.accessionNumber ?? "No accession"}
                </div>
                <div
                  className={cn(
                    "truncate text-sm font-medium text-white",
                    titleClassName,
                  )}
                >
                  {object.title}
                </div>
              </div>
              <div className="rounded-full border border-white/10 bg-black/60 p-1 text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100">
                <ExternalLink className="h-3.5 w-3.5" />
              </div>
            </div>
          </div>

          {showFooter ? (
            <div className="flex items-center justify-between gap-3 border-t border-white/5 px-3 py-2 text-[11px] text-zinc-400">
              <span className="truncate">{formatStatus(object.status)}</span>
              <span className="inline-flex items-center gap-1 text-zinc-500">
                <Box className="h-3 w-3" />
                Hover for details
              </span>
            </div>
          ) : null}
        </Link>
      </HoverCardTrigger>

      <HoverCardContent
        align="start"
        className="w-80 border-white/10 bg-zinc-950/95 p-0 text-zinc-100 shadow-2xl backdrop-blur-xl"
      >
        <EntityPreview
          title={object.title}
          subtitle={object.accessionNumber ?? "Unassigned accession"}
          image={object.thumbnailUrl ?? undefined}
          metadata={metadata}
          className="p-4"
        />
      </HoverCardContent>
    </HoverCard>
  );
}
