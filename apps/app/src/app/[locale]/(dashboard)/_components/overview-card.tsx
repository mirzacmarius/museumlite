import { SlidingNumber } from "@v1/ui/sliding-number";
import { cn } from "@v1/ui/utils";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { CARD_CLASS_NAME } from "./my-work-sections";

export const OVERVIEW_CARD_MIN_WIDTH_PX = 176;
export const OVERVIEW_CARD_GAP_PX = 8;
const TWO_PER_ROW_WIDTH = `calc(50% - ${OVERVIEW_CARD_GAP_PX / 2}px)`;

export const OVERVIEW_CARD_GRID_STYLE = {
  gridTemplateColumns: `repeat(auto-fill, minmax(min(${OVERVIEW_CARD_MIN_WIDTH_PX}px, ${TWO_PER_ROW_WIDTH}), 1fr))`,
  gap: OVERVIEW_CARD_GAP_PX,
} satisfies CSSProperties;

export interface OverviewCardProps {
  href: string;
  title: string;
  value: string;
  icon: LucideIcon;
  accentClassName: string;
}

export function OverviewCard({
  href,
  title,
  value,
  icon: Icon,
  accentClassName,
}: OverviewCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        CARD_CLASS_NAME,
        "flex-col justify-between gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <span className="flex min-h-8 min-w-0 items-start gap-1.5">
        <Icon
          className={cn("size-4 shrink-0", accentClassName)}
          aria-hidden="true"
        />
        <span className="min-w-0 break-words text-xs leading-4 text-muted-foreground">
          {title}
        </span>
      </span>{" "}
      <SlidingNumber
        value={value}
        className="text-xl font-semibold leading-7 text-foreground"
      />
    </Link>
  );
}
