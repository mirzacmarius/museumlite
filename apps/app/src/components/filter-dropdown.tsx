"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@v1/ui/dropdown-menu";
import { cn } from "@v1/ui/utils";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

export interface FilterOption {
  label: string;
  value: string;
  icon?: ReactNode;
  color?: string;
}

interface FilterDropdownProps {
  label: string;
  icon?: ReactNode;
  value?: string | null;
  options: FilterOption[];
  onChange: (value: string | null) => void;
  className?: string;
}

export function FilterDropdown({
  label,
  icon,
  value,
  options,
  onChange,
  className,
}: FilterDropdownProps) {
  return (
    <div className={cn("relative", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 text-xs text-zinc-300 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-md hover:border-zinc-700 hover:bg-zinc-800/80 transition-all group shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-zinc-700"
          >
            {icon && (
              <span className="text-zinc-500 group-hover:text-zinc-400">
                {icon}
              </span>
            )}
            <span>{label}</span>
            <ChevronDown className="w-3 h-3 text-zinc-600 group-hover:text-zinc-500 ml-1" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-48 bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl p-1 gap-0.5 ring-1 ring-white/5"
        >
          {options.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => onChange(option.value)}
              className={cn(
                "w-full text-left px-2 py-1.5 text-xs rounded-md transition-colors cursor-pointer flex items-center gap-2 focus:bg-zinc-900 focus:text-zinc-200",
                value === option.value
                  ? "bg-zinc-900 text-zinc-200"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900",
              )}
            >
              {option.color && (
                <span
                  className={cn("w-1.5 h-1.5 rounded-full", option.color)}
                />
              )}
              {option.icon && (
                <span className="text-zinc-500">{option.icon}</span>
              )}
              {option.label}
            </DropdownMenuItem>
          ))}
          {value && (
            <>
              <DropdownMenuSeparator className="bg-zinc-800/50 my-1 mx-1" />
              <DropdownMenuItem
                onClick={() => onChange(null)}
                className="w-full text-left px-2 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 focus:bg-zinc-900 focus:text-zinc-300 rounded-md transition-colors cursor-pointer"
              >
                Clear filter
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
