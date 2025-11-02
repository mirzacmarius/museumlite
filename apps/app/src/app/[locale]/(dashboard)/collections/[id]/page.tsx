"use client";

import { Header } from "@/app/[locale]/(dashboard)/_components/header";
import { api } from "@v1/backend/convex/_generated/api";
import { Button } from "@v1/ui/button";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  ArrowLeft,
  Edit,
  Image as ImageIcon,
  History,
  Handshake,
  MapPin,
  Move,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { MoveObjectDialog } from "@/app/[locale]/(dashboard)/locations/_components/move-object-dialog";
import { MediaGallery } from "./_components/media-gallery";
import { Id } from "@v1/backend/convex/_generated/dataModel";

export default function CollectionDetailPage() {
  const params = useParams();
  const collectionId = params.id as string;
  const { currentOrganizationId } = useOrganization();
  const [activeTab, setActiveTab] = useState<
    "details" | "media" | "history" | "loans"
  >("details");
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);

  const collection = useQuery(
    api.collections.get,
    collectionId ? { collectionId: collectionId as Id<"collections"> } : "skip",
  );

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
                    {collection.title}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {collection.accessionNumber}
                  </p>
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
                className={`px-4 py-3 text-sm font-medium transition-colors ${
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
                className={`px-4 py-3 text-sm font-medium transition-colors ${
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
                className={`px-4 py-3 text-sm font-medium transition-colors ${
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
                className={`px-4 py-3 text-sm font-medium transition-colors ${
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
            <div className="p-6">
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

  return (
    <div className="space-y-6">
      {collection.alternateAccessionNumbers && collection.alternateAccessionNumbers.length > 0 && (
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Alternate Accession Numbers
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            {collection.alternateAccessionNumbers.map((number) => (
              <span
                key={number}
                className="inline-flex items-center rounded border border-border bg-muted px-2.5 py-1 text-sm"
              >
                {number}
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Object Type
          </label>
          <p className="mt-1 text-sm">{collection.objectType || "—"}</p>
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
          <p className="mt-1 text-sm capitalize">{collection.status}</p>
        </div>
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
            <p className="mt-1 text-sm text-muted-foreground">No location assigned</p>
          )}
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Materials
          </label>
          <p className="mt-1 text-sm">{collection.materials || "—"}</p>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Dimensions
          </label>
          <p className="mt-1 text-sm">{collection.dimensions || "—"}</p>
        </div>
      </div>

      {collection.description && (
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Description
          </label>
          <p className="mt-1 text-sm">{collection.description}</p>
        </div>
      )}

      {collection.condition && (
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Condition
          </label>
          <p className="mt-1 text-sm">{collection.condition}</p>
        </div>
      )}

      {collection.provenance && (
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Provenance
          </label>
          <p className="mt-1 text-sm">{collection.provenance}</p>
        </div>
      )}

      {collection.exhibitionHistory && (
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Exhibition History
          </label>
          <p className="mt-1 text-sm">{collection.exhibitionHistory}</p>
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
                {loan.type === "incoming" ? "Incoming" : "Outgoing"} - {loan.lenderBorrowerName}
              </p>
              <p className="text-sm text-muted-foreground">
                {new Date(loan.startDate).toLocaleDateString()} - {loan.endDate ? new Date(loan.endDate).toLocaleDateString() : "Ongoing"}
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

