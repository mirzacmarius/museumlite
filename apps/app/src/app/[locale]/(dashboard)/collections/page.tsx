"use client";

import { Header } from "@/app/[locale]/(dashboard)/_components/header";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { useQuery } from "convex/react";
import { Building2, Folder, FolderPlus, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function CollectionsPage() {
  const { currentOrganizationId, organizations, isLoading } = useOrganization();
  const [search, setSearch] = useState("");

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!organizations || organizations.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-secondary px-6 py-8 dark:bg-black">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-8 dark:bg-black">
          <Building2 className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">No Organization Found</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              You need to create an organization to start managing collections.
            </p>
          </div>
          <Button asChild>
            <Link href="/organizations/new">
              <Plus className="mr-2 h-4 w-4" />
              Create Organization
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-secondary px-6 py-8 dark:bg-black">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-8 dark:bg-black">
          <Building2 className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">Select an Organization</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Please select an organization to view collections.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Header
        title="Collections"
        description="Organize your objects into collections"
      />
      <div className="flex h-full w-full bg-secondary px-6 py-8 dark:bg-black">
        <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
          <div className="flex w-full flex-col rounded-lg border border-border bg-card dark:bg-black">
            <div className="flex w-full items-center justify-between rounded-lg p-6">
              <div className="flex flex-col gap-2">
                <h2 className="text-xl font-medium text-primary">
                  Collections
                </h2>
                <p className="text-sm font-normal text-primary/60">
                  Manage your object collections
                </p>
              </div>
              <PermissionGate permission="collections.create">
                <Button asChild>
                  <Link href="/collections/new">
                    <FolderPlus className="mr-2 h-4 w-4" />
                    New Collection
                  </Link>
                </Button>
              </PermissionGate>
            </div>
            <div className="flex w-full px-6">
              <div className="w-full border-b border-border" />
            </div>

            <div className="p-6">
              <div className="mb-6 flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search collections..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <CollectionGroupsList
                organizationId={currentOrganizationId}
                search={search}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function CollectionGroupsList({
  organizationId,
  search,
}: {
  organizationId: Id<"organizations">;
  search: string;
}) {
  const groups = useQuery(api.collectionGroups.list, {
    organizationId,
    search: search || undefined,
  });

  if (groups === undefined) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">No collections found</p>
        <PermissionGate permission="collections.create">
          <Button asChild>
            <Link href="/collections/new">
              <FolderPlus className="mr-2 h-4 w-4" />
              Create Your First Collection
            </Link>
          </Button>
        </PermissionGate>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {groups.map((group) => (
        <Link
          key={group._id}
          href={`/collections/${group._id}`}
          className="group flex flex-col rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent hover:border-primary/50"
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <Folder className="h-5 w-5 text-primary/60 group-hover:text-primary" />
              <h3 className="font-medium line-clamp-1">{group.name}</h3>
            </div>
            <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {group.itemsCount || 0} items
            </span>
          </div>
          {group.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-4 flex-1">
              {group.description}
            </p>
          )}
          <div className="mt-auto text-xs text-muted-foreground">
            Created {new Date(group.createdAt).toLocaleDateString()}
          </div>
        </Link>
      ))}
    </div>
  );
}
