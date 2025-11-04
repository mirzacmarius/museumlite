"use client";

import { Header } from "@/app/[locale]/(dashboard)/_components/header";
import { MoveObjectDialog } from "@/app/[locale]/(dashboard)/locations/_components/move-object-dialog";
import { getConditionIcon } from "@/components/condition-combobox";
import { DeaccessionDialog } from "@/components/deaccession-dialog";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import {
  type ImageItem,
  InteractiveImageBentoGallery,
} from "@v1/ui/bento-gallery";
import { Button } from "@v1/ui/button";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  AlertOctagon,
  Archive,
  ArrowLeft,
  CheckCircle,
  Edit,
  Handshake,
  History,
  Image as ImageIcon,
  MapPin,
  Move,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import React, { useState } from "react";
import { MediaGallery } from "./_components/media-gallery";

export default function CollectionDetailPage() {
  const params = useParams();
  const collectionId = params.id as string;
  const { currentOrganizationId } = useOrganization();
  const [activeTab, setActiveTab] = useState<
    "details" | "media" | "history" | "loans"
  >("details");
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [deaccessionDialogOpen, setDeaccessionDialogOpen] = useState(false);

  const collection = useQuery(
    api.collections.get,
    collectionId ? { collectionId: collectionId as Id<"collections"> } : "skip",
  );

  // Query loans to check if item is on active loan
  const loans = useQuery(
    api.loans.getLoansForCollection,
    collection ? { collectionId: collection._id } : "skip",
  );
  const hasActiveLoan = loans?.some((loan) => loan.status === "active") ?? false;

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">
          Please select an organization to view collections.
        </p>
      </div>
    );
  }

  if (collection === undefined) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (collection === null) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">Collection not found</p>
      </div>
    );
  }

  return (
    <>
      <Header
        title={collection.title}
        description={`Accession Number: ${collection.accessionNumber}`}
      />
      <div className="flex h-full w-full bg-secondary px-6 py-8 dark:bg-black">
        <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
          <div className="flex w-full flex-col rounded-lg border border-border bg-card dark:bg-black">
            <div className="flex w-full items-center justify-between rounded-lg p-4">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/collections">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Link>
                </Button>
                <div className="flex flex-col gap-1">
                  <h2 className="text-xl font-medium text-primary">
                    {collection.title}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm text-muted-foreground">
                      {collection.accessionNumber}
                    </p>
                    {collection.alternateAccessionNumbers &&
                      collection.alternateAccessionNumbers.length > 0 && (
                        <>
                          <span className="text-sm text-muted-foreground">
                            •
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {collection.alternateAccessionNumbers.map(
                              (number) => (
                                <span
                                  key={number}
                                  className="inline-flex items-center rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                                >
                                  {number}
                                </span>
                              ),
                            )}
                          </div>
                        </>
                      )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <PermissionGate permission="locations.update">
                  <Button
                    variant="outline"
                    onClick={() => setMoveDialogOpen(true)}
                  >
                    <Move className="mr-2 h-4 w-4" />
                    Move
                  </Button>
                </PermissionGate>
                <PermissionGate permission="collections.update">
                  <Button variant="outline" asChild>
                    <Link href={`/collections/${collectionId}/edit`}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </Link>
                  </Button>
                </PermissionGate>
                <PermissionGate permission="collections.approve_deaccession">
                  {collection.status === "active" && !hasActiveLoan && (
                    <Button
                      variant="destructive"
                      onClick={() => setDeaccessionDialogOpen(true)}
                    >
                      <Archive className="mr-2 h-4 w-4" />
                      Deaccession
                    </Button>
                  )}
                  {collection.status === "active" && hasActiveLoan && (
                    <Button
                      variant="outline"
                      disabled
                      title="Cannot deaccession - item is on active loan"
                    >
                      <AlertOctagon className="mr-2 h-4 w-4" />
                      On Loan
                    </Button>
                  )}
                </PermissionGate>
              </div>
            </div>

            <div className="flex w-full px-6">
              <div className="w-full border-b border-border" />
            </div>

            {/* Tabs */}
            <div className="flex w-full gap-2 border-b border-border px-6">
              <button
                type="button"
                onClick={() => setActiveTab("details")}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === "details"
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-primary"
                }`}
              >
                Details
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("media")}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === "media"
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-primary"
                }`}
              >
                <ImageIcon className="mr-2 inline h-4 w-4" />
                Media
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("history")}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === "history"
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-primary"
                }`}
              >
                <History className="mr-2 inline h-4 w-4" />
                History
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("loans")}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === "loans"
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-primary"
                }`}
              >
                <Handshake className="mr-2 inline h-4 w-4" />
                Loans
              </button>
            </div>

            {/* Tab Content */}
            <div className="p-4">
              {activeTab === "details" && (
                <CollectionDetails collection={collection} />
              )}
              {activeTab === "media" && (
                <CollectionMedia collectionId={collectionId} />
              )}
              {activeTab === "history" && (
                <CollectionHistory collectionId={collectionId} />
              )}
              {activeTab === "loans" && (
                <CollectionLoans collectionId={collectionId} />
              )}
            </div>
          </div>
        </div>
      </div>
      <MoveObjectDialog
        collectionId={collectionId}
        currentLocationId={collection.currentLocationId}
        open={moveDialogOpen}
        onOpenChange={setMoveDialogOpen}
        onSuccess={() => {
          // Refresh will happen automatically via Convex subscription
        }}
      />
      <DeaccessionDialog
        open={deaccessionDialogOpen}
        onOpenChange={setDeaccessionDialogOpen}
        collectionId={collectionId as Id<"collections">}
        collectionTitle={collection.title}
        organizationId={collection.organizationId}
      />
    </>
  );
}

function CollectionDetails({
  collection,
}: {
  collection: NonNullable<FunctionReturnType<typeof api.collections.get>>;
}) {
  const locationPath = useQuery(
    api.locations.getLocationPath,
    collection.currentLocationId
      ? { locationId: collection.currentLocationId as Id<"locations"> }
      : "skip",
  );

  const media = useQuery(
    api.media.list,
    collection._id
      ? { collectionId: collection._id as Id<"collections"> }
      : "skip",
  );

  // Transform media data into ImageItem format for bento gallery
  const imageItems: ImageItem[] = React.useMemo(() => {
    if (!media || !Array.isArray(media)) return [];

    return media
      .filter((file) => file.fileType === "image" && file.url)
      .map((file, index) => ({
        id: file._id,
        title: file.fileName,
        desc: file.caption || file.photographer || "Collection image",
        url: file.url!,
        // Vary the span to create an interesting bento layout
        span:
          index % 5 === 0
            ? "md:col-span-2 md:row-span-2"
            : index % 3 === 0
              ? "md:row-span-2"
              : "md:row-span-1",
      }));
  }, [media]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "loaned":
        return <Archive className="h-4 w-4 text-blue-500" />;
      case "deaccessioned":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500/10 text-green-600 dark:text-green-400";
      case "loaned":
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400";
      case "deaccessioned":
        return "bg-red-500/10 text-red-600 dark:text-red-400";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="flex gap-4">
      {/* Left column - Collection details */}
      <div className="flex-1 space-y-4">
        {/* Basic Information Section */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-3 text-base font-semibold">Basic Information</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Object Type
              </label>
              <div className="mt-1 flex flex-wrap gap-1">
                {(() => {
                  try {
                    const types = collection.objectType
                      ? JSON.parse(collection.objectType)
                      : [];
                    return Array.isArray(types) && types.length > 0
                      ? types.map((type: string) => (
                          <span
                            key={type}
                            className="inline-flex items-center rounded-md border bg-secondary px-2 py-0.5 text-xs font-medium"
                          >
                            {type}
                          </span>
                        ))
                      : <span className="text-sm text-muted-foreground">—</span>;
                  } catch {
                    return <span className="text-sm text-muted-foreground">—</span>;
                  }
                })()}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Object Name
              </label>
              <p className="mt-1 text-sm">{collection.objectName || "—"}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Culture
              </label>
              <p className="mt-1 text-sm">{collection.culture || "—"}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Period
              </label>
              <p className="mt-1 text-sm">{collection.period || "—"}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Date Created
              </label>
              <p className="mt-1 text-sm">{collection.dateCreated || "—"}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Status
              </label>
              <div className="mt-1 flex items-center gap-2">
                {getStatusIcon(collection.status)}
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium ${getStatusColor(
                    collection.status,
                  )}`}
                >
                  {collection.status.charAt(0).toUpperCase() +
                    collection.status.slice(1)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Physical Characteristics Section */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-3 text-base font-semibold">
            Physical Characteristics
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="md:col-span-2 lg:col-span-3">
              <label className="text-sm font-medium text-muted-foreground">
                Materials
              </label>
              <div className="mt-1">
                {(() => {
                  if (!collection.materials)
                    return (
                      <span className="text-sm text-muted-foreground">—</span>
                    );

                  try {
                    // Try to parse as JSON array
                    const materialsArray = JSON.parse(collection.materials);
                    if (
                      Array.isArray(materialsArray) &&
                      materialsArray.length > 0
                    ) {
                      return (
                        <div className="flex flex-wrap gap-1.5">
                          {materialsArray.map(
                            (material: string) => (
                              <span
                                key={material}
                                className="inline-flex items-center rounded-md border border-border bg-secondary px-2 py-0.5 text-xs font-medium"
                              >
                                {material}
                              </span>
                            ),
                          )}
                        </div>
                      );
                    }
                    return (
                      <span className="text-sm text-muted-foreground">—</span>
                    );
                  } catch {
                    // If not valid JSON, treat as single string
                    return (
                      <span className="inline-flex items-center rounded-md border border-border bg-secondary px-2 py-0.5 text-xs font-medium">
                        {collection.materials}
                      </span>
                    );
                  }
                })()}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Dimensions
              </label>
              <p className="mt-1 text-sm">{collection.dimensions || "—"}</p>
            </div>
            {collection.condition && (
              <div className="md:col-span-2 lg:col-span-1">
                <label className="text-sm font-medium text-muted-foreground">
                  Condition
                </label>
                <div className="mt-1 flex items-center gap-1.5">
                  {getConditionIcon(collection.condition)}
                  <span className="text-sm">{collection.condition}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Location Information Section */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-3 text-base font-semibold">Location Information</h3>
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Current Location
            </label>
            {locationPath && locationPath.length > 0 ? (
              <Link
                href={`/locations/${collection.currentLocationId}`}
                className="mt-1 flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <MapPin className="h-4 w-4" />
                {locationPath.map((loc) => loc.name).join(" → ")}
              </Link>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                No location assigned
              </p>
            )}
          </div>
        </div>

        {/* Historical Information Section */}
        {(collection.description ||
          collection.provenance ||
          collection.exhibitionHistory) && (
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="mb-3 text-base font-semibold">
              Historical Information
            </h3>
            <div className="space-y-4">
              {collection.description && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Description
                  </label>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                    {collection.description}
                  </p>
                </div>
              )}

              {collection.provenance && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Provenance
                  </label>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                    {collection.provenance}
                  </p>
                </div>
              )}

              {collection.exhibitionHistory && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Exhibition History
                  </label>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                    {collection.exhibitionHistory}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right column - Media Gallery */}
      {imageItems.length > 0 && (
        <div className="w-96 flex-shrink-0">
          <div className="sticky top-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="mb-3 text-base font-semibold">Media Gallery</h3>
              <InteractiveImageBentoGallery
                imageItems={imageItems}
                title=""
                description=""
                compact={true}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CollectionMedia({ collectionId }: { collectionId: string }) {
  return <MediaGallery collectionId={collectionId} />;
}

function CollectionHistory({ collectionId }: { collectionId: string }) {
  const history = useQuery(
    api.locations.getCollectionLocationHistory,
    collectionId ? { collectionId: collectionId as Id<"collections"> } : "skip",
  );

  if (history === undefined) {
    return <p className="text-muted-foreground">Loading history...</p>;
  }

  if (history.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">No location history</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {history.map((entry) => (
        <div key={entry._id} className="rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">
                {entry.fromLocationName || "Unknown"} → {entry.toLocationName}
              </p>
              <p className="text-sm text-muted-foreground">
                {new Date(entry.movedAt).toLocaleString()}
              </p>
              {entry.reason && (
                <p className="text-sm text-muted-foreground">
                  Reason: {entry.reason}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">
                {entry.movedByName || "Unknown"}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CollectionLoans({ collectionId }: { collectionId: string }) {
  const loans = useQuery(
    api.loans.getLoansForCollection,
    collectionId ? { collectionId: collectionId as Id<"collections"> } : "skip",
  );

  if (loans === undefined) {
    return <p className="text-muted-foreground">Loading loans...</p>;
  }

  if (loans.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">No loans found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {loans.map((loan) => (
        <div key={loan._id} className="rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{loan.loanNumber}</p>
              <p className="text-sm text-muted-foreground">
                {loan.type === "incoming" ? "Incoming" : "Outgoing"} -{" "}
                {loan.lenderBorrowerName}
              </p>
              <p className="text-sm text-muted-foreground">
                {new Date(loan.startDate).toLocaleDateString()} -{" "}
                {loan.endDate
                  ? new Date(loan.endDate).toLocaleDateString()
                  : "Ongoing"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm capitalize">{loan.status}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
