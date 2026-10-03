"use client";

import { Button } from "@v1/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@v1/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import { useScopedI18n } from "@/locales/client";

interface CatalogFilterOption<Value extends string> {
  value: Value;
  label: string;
  depth?: number;
  keywords?: string[];
}

interface CatalogFilterSelectProps<Value extends string> {
  label: string;
  value: Value;
  options: CatalogFilterOption<Value>[];
  onChange: (value: Value) => void;
}

export function CatalogFilterSelect<Value extends string>({
  label,
  value,
  options,
  onChange,
}: CatalogFilterSelectProps<Value>) {
  const [open, setOpen] = useState(false);
  const common = useScopedI18n("common");
  const selected = options.find((option) => option.value === value);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] items-center gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            aria-label={`${label}: ${selected?.label ?? common("loading")}`}
            className="h-7 min-w-0 justify-between gap-2 rounded-md border-border/60 bg-muted/60 px-2.5 text-xs font-normal shadow-sm dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
          >
            <span className="truncate" title={selected?.label}>
              {selected?.label ?? common("loading")}
            </span>
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={6}
          className="w-80 max-w-[calc(100vw-2rem)] overflow-hidden p-0"
        >
          <Command className="bg-transparent">
            <CommandInput
              aria-label={`${common("search")} ${label}`}
              placeholder={common("search")}
            />
            <CommandList className="max-h-64">
              <CommandEmpty>{common("noResults")}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => {
                  const depth = option.depth ?? 0;
                  return (
                    <CommandItem
                      key={option.value}
                      value={option.value || "__any__"}
                      keywords={[option.label, ...(option.keywords ?? [])]}
                      onSelect={() => {
                        onChange(option.value);
                        setOpen(false);
                      }}
                      className="items-center gap-2 rounded-md py-1.5 text-xs"
                    >
                      <span
                        className="min-w-0 flex-1 truncate"
                        style={{ paddingInlineStart: `${depth * 12}px` }}
                        title={option.label}
                      >
                        {option.label}
                      </span>
                      {value === option.value ? (
                        <Check className="size-3.5 shrink-0 text-indigo-400" />
                      ) : null}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
