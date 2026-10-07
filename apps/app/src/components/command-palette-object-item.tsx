"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { CommandItem } from "@v1/ui/command";
import { Box } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import * as React from "react";

export const CommandObjectItem = React.memo(
  ({
    obj,
    runCommand,
    imageUrl,
  }: {
    obj: {
      _id: Id<"collections">;
      title: string;
      accessionNumber: string;
    };
    runCommand: (command: () => unknown) => void;
    imageUrl: string | null | undefined;
  }) => {
    const { push } = useRouter();

    return (
      <CommandItem
        value={`${obj.title} ${obj.accessionNumber}`}
        onSelect={() => runCommand(() => push(`/objects/${obj._id}`))}
        className="flex items-center gap-2"
      >
        {imageUrl ? (
          <div className="relative size-7 overflow-hidden rounded-[4px] border border-border/50 shrink-0 bg-muted/20">
            <Image
              src={imageUrl}
              alt={obj.title}
              fill
              sizes="(max-width: 768px) 100vw, 400px"
              className="object-cover"
            />
          </div>
        ) : (
          <div className="flex size-7 items-center justify-center rounded-[4px] border border-border/50 bg-muted/20 shrink-0">
            <Box className="size-3.5 text-muted-foreground" />
          </div>
        )}
        <div className="flex flex-col overflow-hidden gap-0.5">
          <span className="truncate leading-none">{obj.title}</span>
          <span className="text-[10px] text-muted-foreground truncate font-mono leading-none opacity-70">
            {obj.accessionNumber}
          </span>
        </div>
      </CommandItem>
    );
  },
);

CommandObjectItem.displayName = "CommandObjectItem";
