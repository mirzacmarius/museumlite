import { cn } from "@v1/ui/utils";
import { Box, ExternalLink, Package } from "lucide-react";
import Image from "next/image";
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
  textPlacement?: "below" | "overlay";
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
  showFooter = false,
  textPlacement = "below",
}: LocationObjectThumbnailProps) {
  const isOverlay = textPlacement === "overlay";

  return (
    <Link
      href={`/objects/${object._id}`}
      className={cn(
        "group block overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all duration-300 hover:border-border/80 hover:bg-muted/30",
        className,
      )}
    >
      <div
        className={cn(
          "relative aspect-[4/5] overflow-hidden bg-muted/40",
          imageClassName,
        )}
      >
        {object.thumbnailUrl ? (
          <Image
            src={object.thumbnailUrl}
            alt={object.title}
            fill
            sizes="(max-width: 768px) 100vw, 400px"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <div className="flex size-14 items-center justify-center rounded-2xl border border-border bg-background/70 shadow-sm">
              <Package className="size-7 text-muted-foreground" />
            </div>
          </div>
        )}

        {isOverlay ? (
          <>
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3">
              <div className="min-w-0">
                <div className="truncate font-mono text-[10px] uppercase tracking-[0.18em] text-white/80">
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
              <div className="rounded-full border border-border bg-background/90 p-1 text-foreground opacity-0 transition-opacity group-hover:opacity-100">
                <ExternalLink className="size-3.5" />
              </div>
            </div>
          </>
        ) : null}
      </div>

      {!isOverlay ? (
        <div className="flex items-start justify-between gap-3 px-3 py-2.5">
          <div className="min-w-0">
            <div className="truncate font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {object.accessionNumber ?? "No accession"}
            </div>
            <div
              className={cn(
                "mt-1 line-clamp-2 text-xs font-medium leading-snug text-foreground",
                titleClassName,
              )}
            >
              {object.title}
            </div>
          </div>
          <div className="mt-0.5 shrink-0 rounded-full border border-border bg-background p-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
            <ExternalLink className="size-3.5" />
          </div>
        </div>
      ) : null}

      {showFooter ? (
        <div className="flex items-center justify-between gap-3 border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
          <span className="truncate">{formatStatus(object.status)}</span>
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Box className="size-3" />
            Open record
          </span>
        </div>
      ) : null}
    </Link>
  );
}
