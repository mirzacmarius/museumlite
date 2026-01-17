"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { useCallback, useState } from "react";

import { ExportCSVButton } from "@/components/export-csv-button";
import { PermissionGate } from "@/components/permission-gate";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { FileUp, Plus, Search } from "lucide-react";
import Link from "next/link";
import { AccessionKanban } from "./accession-kanban";
import { AccessionsStats } from "./accessions-stats";
import { SelectOrganization } from "./select-organization";

type AccessionsPageClientProps = {
  organizations: Array<{
    _id: Id<"organizations">;
    name: string;
    slug: string;
    type?: string;
    role?: unknown;
    _creationTime?: number;
  }>;
  preloadedAccessions: unknown;
  accessionsStats?: {
    pending: number;
    approved: number;
  } | null;
};

export function AccessionsPageClient({
  organizations,
  preloadedAccessions,
  accessionsStats,
}: AccessionsPageClientProps) {
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(
    organizations[0]?._id ?? null,
  );
  const [searchQuery, setSearchQuery] = useState("");

  const organizationId = selectedOrgId
    ? (selectedOrgId as Id<"organizations">)
    : undefined;

  const exportAccessions = useMutation(api.imports.exportAccessions);

  const handleExport = useCallback(async () => {
    if (!organizationId) return [];
    return exportAccessions({ organizationId });
  }, [exportAccessions, organizationId]);

  if (!organizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-xl border border-border/60 bg-card p-8">
          <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div className="text-center">
            <h3 className="text-lg font-semibold text-foreground">
              Select an Organization
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Please select an organization to view accessions.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="mb-6 flex items-end justify-between px-6">
        <div className="flex items-center gap-6">
          {organizations.length > 1 && (
            <SelectOrganization
              organizations={organizations}
              selectedId={selectedOrgId}
              onSelect={setSelectedOrgId}
            />
          )}
          <AccessionsStats stats={accessionsStats} />
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search accessions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 border-border/60 bg-muted/50 pl-9 text-sm placeholder:text-muted-foreground"
            />
          </div>
          <PermissionGate permission="collections.read">
            <ExportCSVButton onExport={handleExport} filename="accessions" />
          </PermissionGate>
          <PermissionGate permission="collections.create">
            <Button asChild variant="outline">
              <Link href="/accessions/import">
                <FileUp className="mr-2 h-4 w-4" />
                Import CSV
              </Link>
            </Button>
          </PermissionGate>
          <PermissionGate permission="collections.create">
            <Button
              asChild
              className="bg-indigo-600 text-white shadow-[0_0_15px_-3px_rgba(99,102,241,0.3)] hover:bg-indigo-500"
            >
              <Link href="/accessions/new">
                <Plus className="mr-2 h-4 w-4" />
                New Accession
              </Link>
            </Button>
          </PermissionGate>
        </div>
      </div>

      <AccessionKanban
        organizationId={organizationId}
        searchQuery={searchQuery}
        preloadedAccessions={preloadedAccessions}
      />
    </div>
  );
}
