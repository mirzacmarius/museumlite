"use client";

import { Header } from "@/app/[locale]/(dashboard)/_components/header";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  Archive,
  ArrowLeft,
  Building2,
  MapPin,
  Plus,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

export default function CollectionGroupDetailPage() {
  const params = useParams();
  const groupId = params.id as Id<"collectionGroups">;
  const { currentOrganizationId } = useOrganization();

  const group = useQuery(api.collectionGroups.get, { groupId });

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">
          Please select an organization to view collections.
        </p>
      </div>
    );
  }

  if (group === undefined) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (group === null) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">Collection not found</p>
      </div>
    );
  }

  return (
    <>
      <Header
        title={group.name}
        description={group.description || "Collection Group"}
      />
      <div className="flex h-full w-full bg-secondary px-6 py-8 dark:bg-black">
        <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
          <div className="flex w-full flex-col rounded-lg border border-border bg-card dark:bg-black">
            <div className="flex w-full items-center justify-between rounded-lg p-6">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/collections">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Link>
                </Button>
                <div className="flex flex-col gap-1">
                  <h2 className="text-xl font-medium text-primary">
                    {group.name}
                  </h2>
                  <p className="text-sm font-normal text-primary/60">
                    {group.itemsCount || 0} items
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <PermissionGate permission="collections.update">
                  <Button variant="outline" disabled>
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Button>
                </PermissionGate>
                <PermissionGate permission="collections.create">
                  <Button asChild>
                    <Link href={`/objects/new?collectionGroupId=${group._id}`}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Object
                    </Link>
                  </Button>
                </PermissionGate>
              </div>
            </div>
            <div className="flex w-full px-6">
              <div className="w-full border-b border-border" />
            </div>

            <CollectionObjectsList
              organizationId={currentOrganizationId}
              groupId={group._id}
            />
          </div>
        </div>
      </div>
    </>
  );
}

function CollectionObjectsList({
  organizationId,
  groupId,
}: {
  organizationId: Id<"organizations">;
  groupId: Id<"collectionGroups">;
}) {
  const [cursor, setCursor] = useState<string | null>(null);

  const collections = useQuery(api.collections.list, {
    organizationId,
    paginationOpts: { numItems: 50, cursor },
    collectionGroupId: groupId,
  });

  if (collections === undefined) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">Loading items...</p>
      </div>
    );
  }

  if (collections.page.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">No items in this collection</p>
        <PermissionGate permission="collections.create">
          <Button asChild>
            <Link href={`/objects/new?collectionGroupId=${groupId}`}>
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
            item={item as CollectionListItem}
            organizationId={organizationId}
          />
        ))}
      </div>
      {!collections.isDone && (
        <div className="mt-6 flex justify-center">
          <Button
            variant="outline"
            onClick={() => setCursor(collections.continueCursor)}
          >
            Load More
          </Button>
        </div>
      )}
    </div>
  );
}

type CollectionListItem = FunctionReturnType<
  typeof api.collections.list
>["page"][number];

function CollectionListItem({
  item,
  organizationId,
}: {
  item: CollectionListItem;
  organizationId: Id<"organizations">;
}) {
  const locationPath = useQuery(
    api.locations.getLocationPath,
    item.currentLocationId && organizationId
      ? { locationId: item.currentLocationId }
      : "skip",
  );

  const primaryImageUrl = useQuery(api.media.getPrimaryImageUrl, {
    collectionId: item._id,
  });

  return (
    <Link
      href={`/objects/${item._id}`}
      className="block rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent"
    >
      <div className="flex items-center gap-4">
        {/* Primary Image Thumbnail */}
        <div className="flex h-16 w-16 flex-shrink-0 overflow-hidden rounded-md bg-muted">
          {primaryImageUrl ? (
            <img
              src={primaryImageUrl}
              alt={item.title}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Building2 className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex flex-1 items-center justify-between">
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
            <div className="flex flex-wrap justify-end gap-1 mb-1">
              {(() => {
                try {
                  const types = item.objectType
                    ? JSON.parse(item.objectType)
                    : [];
                  return Array.isArray(types) && types.length > 0 ? (
                    types.map((type: string) => (
                      <span
                        key={type}
                        className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-xs font-medium"
                      >
                        {type}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  );
                } catch {
                  return (
                    <span className="text-sm text-muted-foreground">—</span>
                  );
                }
              })()}
            </div>
            {item.status === "deaccessioned" ? (
              <span className="inline-flex items-center rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-600">
                <Archive className="mr-1 h-3 w-3" />
                Deaccessioned
              </span>
            ) : (
              <p className="text-xs text-muted-foreground capitalize">
                {item.status}
              </p>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
