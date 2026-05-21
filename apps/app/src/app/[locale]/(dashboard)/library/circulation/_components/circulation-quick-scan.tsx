"use client";

import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Search } from "lucide-react";

interface CirculationQuickScanProps {
  t: (key: string) => string;
  tCirc: (key: string) => string;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onScan: () => void;
}

export function CirculationQuickScan({
  t,
  tCirc,
  searchQuery,
  onSearchQueryChange,
  onKeyDown,
  onScan,
}: CirculationQuickScanProps) {
  return (
    <div className="border-b border-border px-6 py-4">
      <Label className="mb-2 block text-sm font-medium">
        {tCirc("scanBarcode")}
      </Label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("scanPatronOrBarcode")}
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            onKeyDown={onKeyDown}
            className="pl-9"
          />
        </div>
        <Button onClick={onScan} disabled={!searchQuery.trim()}>
          <Search className="mr-2 size-4" />
          {tCirc("lookup")}
        </Button>
      </div>
    </div>
  );
}
