import { LayoutGrid, List } from "lucide-react";
import { cn } from "@v1/ui/utils";

export type ViewType = "list" | "grid";

interface ViewToggleProps {
  view: ViewType;
  onViewChange: (view: ViewType) => void;
  className?: string;
}

export function ViewToggle({ view, onViewChange, className }: ViewToggleProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-md p-0.5",
        className,
      )}
    >
      <button
        onClick={() => onViewChange("list")}
        className={cn(
          "p-1.5 rounded transition-colors",
          view === "list"
            ? "bg-zinc-800 text-zinc-200 shadow-sm border border-zinc-700"
            : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800",
        )}
      >
        <List className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => onViewChange("grid")}
        className={cn(
          "p-1.5 rounded transition-colors",
          view === "grid"
            ? "bg-zinc-800 text-zinc-200 shadow-sm border border-zinc-700"
            : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800",
        )}
      >
        <LayoutGrid className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
