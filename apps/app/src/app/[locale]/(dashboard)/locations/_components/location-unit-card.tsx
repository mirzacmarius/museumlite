import { Tooltip, TooltipContent, TooltipTrigger } from "@v1/ui/tooltip";
import { cn } from "@v1/ui/utils";
import { Package } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ComponentProps } from "react";
import type { LocationObjectThumbnail } from "./location-object-thumbnail";

interface LocationUnitCardProps {
  name: string;
  isActive?: boolean;
  objects: ComponentProps<typeof LocationObjectThumbnail>["object"][];
}

export function LocationUnitCard({
  name,
  isActive = true,
  objects,
}: LocationUnitCardProps) {
  const isEmpty = objects.length === 0;
  const countLabel = `${objects.length} object${objects.length === 1 ? "" : "s"} inside ${name}`;

  return (
    <article className="overflow-hidden rounded-lg border border-border/60 bg-card transition-colors duration-150 hover:border-indigo-500/40 focus-within:border-indigo-500 dark:border-white/10 dark:bg-zinc-900/60 dark:hover:border-white/25">
      {isEmpty ? (
        <div className="flex aspect-square flex-col items-center justify-center gap-2 bg-muted/30 text-muted-foreground dark:bg-zinc-950/60">
          <Package className="size-7" strokeWidth={1.5} />
          <span className="text-xs">No assigned objects</span>
        </div>
      ) : (
        <div className="divide-y divide-border/60 dark:divide-white/10">
          {objects.map((object) => (
            <Link
              key={object._id}
              href={`/objects/${object._id}`}
              className="group/object block focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-500"
            >
              <div className="relative aspect-square overflow-hidden bg-muted/30 dark:bg-zinc-950/60">
                {object.thumbnailUrl ? (
                  <Image
                    src={object.thumbnailUrl}
                    alt={object.title}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 280px"
                    className="object-cover transition-transform duration-300 group-hover/object:scale-105 motion-reduce:transition-none motion-reduce:group-hover/object:scale-100"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center">
                    <Package
                      className="size-7 text-muted-foreground"
                      strokeWidth={1.5}
                    />
                  </div>
                )}
                {object.status ? (
                  <span className="absolute end-2 top-2 rounded border border-white/10 bg-black/60 px-1.5 py-0.5 text-[9px] capitalize text-white backdrop-blur-sm">
                    {object.status.replaceAll("_", " ")}
                  </span>
                ) : null}
              </div>
              <div className="px-3 pb-2 pt-3">
                <h4
                  className="truncate text-xs font-medium text-foreground transition-colors duration-150 group-hover/object:text-indigo-500 dark:group-hover/object:text-indigo-300"
                  title={object.title}
                >
                  {object.title}
                </h4>
                <p
                  className="mt-1 truncate font-mono text-[10px] text-muted-foreground"
                  title={object.accessionNumber}
                >
                  {object.accessionNumber ?? "No accession"}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
      <div className="flex justify-end px-3 pb-2 pt-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={countLabel}
              className="inline-flex items-center gap-1.5 rounded text-[10px] tabular-nums text-muted-foreground outline-offset-2 focus-visible:outline focus-visible:outline-indigo-500"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "size-1.5 rounded-full",
                  isActive && !isEmpty
                    ? "bg-emerald-500"
                    : "bg-muted-foreground/40",
                )}
              />
              {objects.length}
            </button>
          </TooltipTrigger>
          <TooltipContent
            sideOffset={5}
            className="rounded-lg px-2.5 py-1 text-xs"
          >
            {countLabel}
          </TooltipContent>
        </Tooltip>
      </div>
    </article>
  );
}
