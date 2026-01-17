"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";

type SelectOrganizationProps = {
  organizations: Array<{
    _id: Id<"organizations">;
    name: string;
    slug: string;
  }>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

export function SelectOrganization({
  organizations,
  selectedId,
  onSelect,
}: SelectOrganizationProps) {
  return (
    <div className="relative">
      <select
        value={selectedId ?? ""}
        onChange={(e) => onSelect(e.target.value || null)}
        className="appearance-none bg-muted/50 border border-border/60 rounded-md px-3 py-2 pr-8 text-sm text-foreground focus:border-border/60 focus:outline-none cursor-pointer"
      >
        <option value="" disabled>
          Select organization...
        </option>
        {organizations.map((org) => (
          <option key={org._id} value={org._id}>
            {org.name}
          </option>
        ))}
      </select>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}
