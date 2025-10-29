"use client";

import { Header } from "@/app/[locale]/(dashboard)/_components/header";
import { api } from "@v1/backend/convex/_generated/api";
import { Button } from "@v1/ui/button";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { useQuery } from "convex/react";
import { Plus, Building2, MapPin } from "lucide-react";
import Link from "next/link";

export default function CollectionsPage() {
  const { currentOrganizationId, organizations, isLoading } = useOrganization();

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!organizations || organizations.length === 0) {
    return (
      <>
        <Header
          title="Collections"
          description="Manage your collection objects"
        />
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
      </>
    );
  }

  if (!currentOrganizationId) {
    return (
      <>
        <Header
          title="Collections"
          description="Manage your collection objects"
        />
        <div className="flex h-full w-full items-center justify-center bg-secondary px-6 py-8 dark:bg-black">
          <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-8 dark:bg-black">
            <Building2 className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <h3 className="text-lg font-semibold">Select an Organization</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Please select an organization from the dropdown above to view collections.
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header
        title="Collections"
        description="Manage your collection objects"
      />
      <div className="flex h-full w-full bg-secondary px-6 py-8 dark:bg-black">
        <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
          <div className="flex w-full flex-col rounded-lg border border-border bg-card dark:bg-black">
            <div className="flex w-full items-center justify-between rounded-lg p-6">
              <div className="flex flex-col gap-2">
                <h2 className="text-xl font-medium text-primary">
                  Collection Objects
                </h2>
                <p className="text-sm font-normal text-primary/60">
                  Browse and manage your collection
                </p>
              </div>
              <PermissionGate permission="collections.create">
                <Button asChild>
                  <Link href="/collections/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Object
                  </Link>
                </Button>
              </PermissionGate>
            </div>
            <div className="flex w-full px-6">
              <div className="w-full border-b border-border" />
            </div>
            <CollectionList organizationId={currentOrganizationId} />
          </div>
        </div>
      </div>
    </>
  );
}

function CollectionList({
  organizationId,
}: {
  organizationId: string;
}) {
  const collections = useQuery(
    api.collections.list,
    organizationId
      ? {
          organizationId: organizationId as any,
          paginationOpts: { numItems: 50, cursor: null },
        }
      : "skip",
  );

  if (collections === undefined) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (collections.page.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">No collections found</p>
        <PermissionGate permission="collections.create">
          <Button asChild>
            <Link href="/collections/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Object
            </Link>
          </Button>
        </PermissionGate>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="space-y-4">
        {collections.page.map((item) => (
          <CollectionListItem
            key={item._id}
            item={item}
            organizationId={organizationId}
          />
        ))}
      </div>
    </div>
  );
}

function CollectionListItem({
  item,
  organizationId,
}: {
  item: {
    _id: string;
    accessionNumber: string;
    title: string;
    objectType?: string;
    currentLocationId?: string;
    status: string;
  };
  organizationId: string;
}) {
  const locationPath = useQuery(
    api.locations.getLocationPath,
    item.currentLocationId && organizationId
      ? { locationId: item.currentLocationId as any }
      : "skip",
  );

  return (
    <Link
      href={`/collections/${item._id}`}
      className="block rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent"
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h3 className="font-medium">{item.title}</h3>
          <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
            <span>{item.accessionNumber}</span>
            {locationPath && locationPath.length > 0 && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {locationPath.map((loc) => loc.name).join(" → ")}
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium">{item.objectType || "—"}</p>
          <p className="text-xs text-muted-foreground capitalize">
            {item.status}
          </p>
        </div>
      </div>
    </Link>
  );
}

