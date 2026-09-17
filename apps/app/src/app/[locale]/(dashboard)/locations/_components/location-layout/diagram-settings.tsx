"use client";

import { Button } from "@v1/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import { SlidersHorizontal } from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect } from "react";
import { readDiagramState, saveDiagramState } from "./diagram-storage";

export function useDiagramSettings(storageKey: string) {
  const [direction, setDirection] = useQueryState(
    "direction",
    parseAsStringLiteral(["horizontal", "vertical"] as const).withDefault(
      "vertical",
    ),
  );
  const [items, setItems] = useQueryState(
    "items",
    parseAsStringLiteral(["list", "grid"] as const).withDefault("grid"),
  );
  const [size, setSize] = useQueryState(
    "thumbs",
    parseAsStringLiteral(["small", "large"] as const).withDefault("large"),
  );
  const [spacing, setSpacing] = useQueryState(
    "spacing",
    parseAsStringLiteral(["compact", "comfortable"] as const).withDefault(
      "comfortable",
    ),
  );
  const [lines, setLines] = useQueryState(
    "lines",
    parseAsStringLiteral([
      "smoothstep",
      "default",
      "straight",
    ] as const).withDefault("default"),
  );
  useEffect(() => {
    const saved = readDiagramState(storageKey);
    const params = new URLSearchParams(window.location.search);
    if (!params.has("direction") && saved.direction)
      void setDirection(saved.direction);
    if (!params.has("items") && saved.items) void setItems(saved.items);
    if (!params.has("thumbs") && saved.size) void setSize(saved.size);
    if (!params.has("spacing") && saved.spacing) void setSpacing(saved.spacing);
    if (!params.has("lines") && saved.lines) void setLines(saved.lines);
  }, [storageKey, setDirection, setItems, setSize, setSpacing, setLines]);
  return {
    direction,
    items,
    size,
    spacing,
    lines,
    setDirection: (value: typeof direction) => {
      saveDiagramState(storageKey, {
        items,
        size,
        spacing,
        lines,
        direction: value,
      });
      return setDirection(value);
    },
    setItems: (value: typeof items) => {
      saveDiagramState(storageKey, {
        direction,
        size,
        spacing,
        lines,
        items: value,
      });
      return setItems(value);
    },
    setSize: (value: typeof size) => {
      saveDiagramState(storageKey, {
        direction,
        items,
        spacing,
        lines,
        size: value,
      });
      return setSize(value);
    },
    setSpacing: (value: typeof spacing) => {
      saveDiagramState(storageKey, {
        direction,
        items,
        size,
        lines,
        spacing: value,
      });
      return setSpacing(value);
    },
    setLines: (value: typeof lines) => {
      saveDiagramState(storageKey, {
        direction,
        items,
        size,
        spacing,
        lines: value,
      });
      return setLines(value);
    },
  };
}

export type DiagramSettings = Pick<
  ReturnType<typeof useDiagramSettings>,
  "direction" | "items" | "size" | "spacing" | "lines"
>;

function Choice<Value extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: Value;
  options: { value: Value; label: string }[];
  onChange: (value: Value) => void;
}) {
  return (
    <fieldset className="flex items-center justify-between gap-4">
      <legend className="sr-only">{label}</legend>
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex rounded-md border border-border p-0.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-label={`${label}: ${option.label}`}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={`rounded px-2 py-1 text-[11px] ${value === option.value ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function DiagramSettingsPopover({
  settings,
}: {
  settings: ReturnType<typeof useDiagramSettings>;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-2 border-border/60 bg-card/95 text-xs shadow-md backdrop-blur-sm hover:bg-accent"
        >
          <SlidersHorizontal className="size-3.5" />
          Diagram settings
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 max-w-[calc(100vw-2rem)] space-y-3 p-4"
      >
        <Choice
          label="Direction"
          value={settings.direction}
          onChange={settings.setDirection}
          options={[
            { value: "horizontal", label: "Horizontal" },
            { value: "vertical", label: "Vertical" },
          ]}
        />
        <Choice
          label="Objects"
          value={settings.items}
          onChange={settings.setItems}
          options={[
            { value: "list", label: "List" },
            { value: "grid", label: "Grid" },
          ]}
        />
        <Choice
          label="Thumbnails"
          value={settings.size}
          onChange={settings.setSize}
          options={[
            { value: "small", label: "Small" },
            { value: "large", label: "Large" },
          ]}
        />
        <Choice
          label="Spacing"
          value={settings.spacing}
          onChange={settings.setSpacing}
          options={[
            { value: "compact", label: "Compact" },
            { value: "comfortable", label: "Relaxed" },
          ]}
        />
        <Choice
          label="Lines"
          value={settings.lines}
          onChange={settings.setLines}
          options={[
            { value: "smoothstep", label: "Elbow" },
            { value: "default", label: "Curve" },
            { value: "straight", label: "Straight" },
          ]}
        />
      </PopoverContent>
    </Popover>
  );
}
