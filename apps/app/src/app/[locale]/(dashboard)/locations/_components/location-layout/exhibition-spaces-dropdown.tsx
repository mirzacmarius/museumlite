"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@v1/ui/dropdown-menu";
import { Check, ChevronDown } from "lucide-react";
import type { ExhibitionSpaceOption } from "../../location-view-helpers";

interface ExhibitionSpacesDropdownProps {
  exhibitionSpaceOptions: ExhibitionSpaceOption[];
  selectedLocationId: Id<"locations"> | null;
  triggerLabel: string;
  onSelectLocation: (id: Id<"locations">) => void;
}

export function ExhibitionSpacesDropdown({
  exhibitionSpaceOptions,
  selectedLocationId,
  triggerLabel,
  onSelectLocation,
}: ExhibitionSpacesDropdownProps) {
  if (exhibitionSpaceOptions.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Exhibition spaces"
          className="inline-flex min-w-0 max-w-[16rem] items-center gap-1 rounded-md px-1 py-0.5 text-left font-medium text-foreground transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="min-w-56 max-h-80 overflow-y-auto"
      >
        <DropdownMenuLabel>Exhibition Spaces</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {exhibitionSpaceOptions.map((option) => {
          const isSelected = option.location._id === selectedLocationId;

          return (
            <DropdownMenuItem
              key={option.location._id}
              onClick={() => onSelectLocation(option.location._id)}
              className="cursor-pointer"
              style={{ paddingLeft: `${option.depth * 12 + 8}px` }}
            >
              <span className="flex w-full min-w-0 items-center justify-between gap-3">
                <span className="truncate">{option.location.name}</span>
                {isSelected ? (
                  <Check className="size-3.5 shrink-0 text-foreground" />
                ) : null}
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
