"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { useQuery } from "convex/react";
import { Building2 } from "lucide-react";

interface SiteSelectorProps {
  organizationId: string;
  value?: string | null;
  onValueChange: (value: string | null) => void;
  placeholder?: string;
  showAllSitesOption?: boolean;
}

export function SiteSelector({
  organizationId,
  value,
  onValueChange,
  placeholder = "Select a site",
  showAllSitesOption = true,
}: SiteSelectorProps) {
  const sites = useQuery(
    api.sites.list,
    organizationId
      ? {
          organizationId: organizationId as Id<"organizations">,
          activeOnly: true,
        }
      : "skip",
  );

  if (sites === undefined) {
    return (
      <Select value={value ?? undefined} disabled>
        <SelectTrigger>
          <SelectValue placeholder="Loading sites..." />
        </SelectTrigger>
      </Select>
    );
  }

  const selectedSite = sites.find((s) => s._id === value);

  return (
    <Select
      value={value ?? "__all__"}
      onValueChange={(val) => onValueChange(val === "__all__" ? null : val)}
    >
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder={placeholder}>
          {value === null || value === undefined ? (
            <div className="flex items-center gap-2">
              <Building2 className="size-4" />
              <span>All Sites</span>
            </div>
          ) : selectedSite ? (
            <div className="flex items-center gap-2">
              <Building2 className="size-4" />
              <span>{selectedSite.name}</span>
            </div>
          ) : (
            placeholder
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {showAllSitesOption && (
          <SelectItem value="__all__">
            <div className="flex items-center gap-2">
              <Building2 className="size-4" />
              <span>All Sites</span>
            </div>
          </SelectItem>
        )}
        {sites.map((site) => (
          <SelectItem key={site._id} value={site._id}>
            <div className="flex items-center gap-2">
              <Building2 className="size-4" />
              <span>{site.name}</span>
              {site.isPrimary && (
                <span className="text-xs text-muted-foreground">(Primary)</span>
              )}
            </div>
          </SelectItem>
        ))}
        {sites.length === 0 && !showAllSitesOption && (
          <div className="px-2 py-6 text-center text-sm text-muted-foreground">
            No sites available
          </div>
        )}
      </SelectContent>
    </Select>
  );
}
