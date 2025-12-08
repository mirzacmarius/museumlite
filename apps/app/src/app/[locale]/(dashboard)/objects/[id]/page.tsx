"use client";

import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { SidebarProvider } from "@v1/ui/sidebar";
import { cn } from "@v1/ui/utils";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  ArrowLeft,
  Box,
  Building2,
  Calendar,
  CheckCircle,
  Copy,
  Download,
  ExternalLink,
  FileCheck,
  FileText,
  Globe,
  Hammer,
  History,
  Image as ImageIcon,
  Link as LinkIcon,
  MapPin,
  Maximize2,
  Pencil,
  Presentation,
  Printer,
  Ruler,
  ScrollText,
  Search,
  Share2,
  Stethoscope,
  Tag,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ImageLightbox,
  type LightboxImage,
} from "@v1/ui/image-lightbox";
import { MediaGallery } from "./_components/media-gallery";
import { RecordContextSidebar } from "./_components/record-context-sidebar";

type TabId =
  | "general"
  | "physical"
  | "media"
  | "digital"
  | "provenance"
  | "conservation"
  | "exhibitions"
  | "logs";

const tabs: { id: TabId; label: string }[] = [
  { id: "general", label: "General" },
  { id: "physical", label: "Physical Description" },
  { id: "media", label: "Media" },
  { id: "digital", label: "Digital Assets" },
  { id: "provenance", label: "Provenance" },
  { id: "conservation", label: "Conservation" },
  { id: "exhibitions", label: "Exhibitions" },
  { id: "logs", label: "Logs" },
];

export default function ObjectDetailPage() {
  const params = useParams();
  const collectionId = params.id as string;
  const { currentOrganizationId } = useOrganization();
  const [activeTab, setActiveTab] = useState<TabId>("general");

  const collection = useQuery(
    api.collections.get,
    collectionId ? { collectionId: collectionId as Id<"collections"> } : "skip",
  );

  const collectionGroup = useQuery(
    api.collectionGroups.get,
    collection?.collectionGroupId
      ? { groupId: collection.collectionGroupId }
      : "skip",
  );

  const locationPath = useQuery(
    api.locations.getLocationPath,
    collection?.currentLocationId
      ? { locationId: collection.currentLocationId as Id<"locations"> }
      : "skip",
  );

  const media = useQuery(
    api.media.list,
    collection?._id
      ? { collectionId: collection._id as Id<"collections"> }
      : "skip",
  );

  // Get primary image
  const primaryImage = media?.find((m) => m.isPrimary && m.fileType === "image");
  const firstImage = media?.find((m) => m.fileType === "image");
  const heroImage = primaryImage || firstImage;

  // Hero lightbox state
  const [isHeroLightboxOpen, setIsHeroLightboxOpen] = useState(false);
  const heroLightboxImages: LightboxImage[] = useMemo(() => {
    if (!media) return [];
    return media
      .filter((m) => m.fileType === "image" && m.url)
      .map((m) => ({
        id: m._id,
        url: m.url as string,
        thumbnailUrl: m.thumbnailUrl || undefined,
        title: m.fileName,
        caption: m.caption || undefined,
      }));
  }, [media]);

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <p className="text-muted-foreground">
          Please select an organization to view collections.
        </p>
      </div>
    );
  }

  if (collection === undefined) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (collection === null) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <p className="text-muted-foreground">Object not found</p>
      </div>
    );
  }

  const locationString = locationPath?.map((loc) => loc.name).join(", ") || null;

  return (
    <SidebarProvider
      style={{ "--sidebar-width": "20rem" } as React.CSSProperties}
      className="flex min-h-screen w-full"
    >
      {/* Main Content */}
      <main className="z-10 flex min-w-0 flex-1 flex-col bg-background">
        {/* Navbar */}
        <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border/60 bg-background/80 px-6 backdrop-blur-xl">
          <div className="flex items-center gap-2 text-xs">
            <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
              <Link href="/objects">
                <ArrowLeft className="h-4 w-4 text-muted-foreground" />
              </Link>
            </Button>
            <span className="text-muted-foreground">Collections</span>
            <span className="text-muted-foreground/50">/</span>
            {collectionGroup && (
              <>
                <span className="text-muted-foreground">
                  {collectionGroup.name}
                </span>
                <span className="text-muted-foreground/50">/</span>
              </>
            )}
            <span className="font-medium text-foreground">{collection.title}</span>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Share"
            >
              <Share2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Print Record"
            >
              <Printer className="h-4 w-4" />
            </Button>
            <div className="h-4 w-px bg-border" />
            <PermissionGate permission="collections.update">
              <Button asChild>
                <Link href={`/objects/${collectionId}/edit`}>
                  <Pencil className="mr-2 h-3.5 w-3.5" />
                  Edit Object
                </Link>
              </Button>
            </PermissionGate>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Hero Section */}
          <div className="border-b border-border/60 bg-secondary/10 px-8 py-8">
            <div className="mx-auto flex max-w-5xl items-start gap-8">
              {/* Hero Image */}
              <button
                type="button"
                className="group relative shrink-0 cursor-zoom-in"
                onClick={() => heroImage?.url && setIsHeroLightboxOpen(true)}
                aria-label="View full size image"
              >
                {heroImage?.url ? (
                  <img
                    src={heroImage.thumbnailUrl || heroImage.url}
                    alt={collection.title}
                    className="h-48 w-48 rounded-xl border border-border bg-secondary object-cover shadow-2xl transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="flex h-48 w-48 items-center justify-center rounded-xl border border-border bg-secondary">
                    <ImageIcon className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  <Maximize2 className="h-6 w-6 text-white" />
                </div>
              </button>

              {/* Hero Image Lightbox */}
              <ImageLightbox
                images={heroLightboxImages}
                initialIndex={0}
                isOpen={isHeroLightboxOpen}
                onClose={() => setIsHeroLightboxOpen(false)}
              />

              {/* Hero Info */}
              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-3">
                  {/* Display Status Badge */}
                  <div
                    className={cn(
                      "rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider",
                      collection.displayStatus === "On Display" ||
                        collection.status === "active"
                        ? "border border-amber-500/20 bg-amber-500/10 text-amber-500"
                        : collection.status === "loaned"
                          ? "border border-blue-500/20 bg-blue-500/10 text-blue-500"
                          : "border border-red-500/20 bg-red-500/10 text-red-500",
                    )}
                  >
                    {collection.displayStatus || collection.status}
                  </div>
                  {/* Accession Number */}
                  <div className="flex items-center gap-1.5 rounded border border-border bg-secondary px-2 py-0.5 font-mono text-xs text-muted-foreground">
                    <span>{collection.accessionNumber}</span>
                    <Copy className="h-3 w-3 cursor-pointer transition-colors hover:text-foreground" />
                  </div>
                </div>

                <div>
                  <h1 className="mb-1 text-3xl font-semibold leading-tight tracking-tight text-foreground">
                    {collection.title}
                  </h1>
                  {collection.alternativeTitle && (
                    <p className="text-sm text-muted-foreground">
                      Alternative Title: {collection.alternativeTitle}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-6 pt-2">
                  {locationString && (
                    <div className="flex items-center gap-2 text-xs">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{locationString}</span>
                    </div>
                  )}
                  {collection.dateCreated && (
                    <div className="flex items-center gap-2 text-xs">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {collection.dateCreated}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      Public View:{" "}
                      <span
                        className={
                          collection.isPubliclyVisible !== false
                            ? "text-emerald-500"
                            : "text-red-500"
                        }
                      >
                        {collection.isPubliclyVisible !== false
                          ? "Active"
                          : "Hidden"}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="sticky top-14 z-40 border-b border-border/60 bg-background/50 px-8 backdrop-blur-md">
            <div className="mx-auto flex max-w-5xl gap-6 text-xs font-medium">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "border-b-2 py-3 transition-colors",
                    activeTab === tab.id
                      ? "border-accent text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground/80",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="mx-auto min-h-[500px] max-w-5xl space-y-8 p-8">
            {activeTab === "general" && (
              <GeneralTab collection={collection} />
            )}
            {activeTab === "physical" && (
              <PhysicalTab collection={collection} />
            )}
            {activeTab === "media" && (
              <MediaTab collectionId={collectionId} />
            )}
            {activeTab === "digital" && (
              <DigitalAssetsTab collection={collection} />
            )}
            {activeTab === "provenance" && (
              <ProvenanceTab collection={collection} />
            )}
            {activeTab === "conservation" && (
              <ConservationTab collectionId={collectionId} organizationId={currentOrganizationId} />
            )}
            {activeTab === "exhibitions" && (
              <ExhibitionsTab collectionId={collectionId} organizationId={currentOrganizationId} />
            )}
            {activeTab === "logs" && (
              <LogsTab collectionId={collectionId} organizationId={currentOrganizationId} />
            )}
          </div>
        </div>
      </main>

      {/* Right Sidebar */}
      <RecordContextSidebar
        collectionId={collectionId}
        tags={collection.tags}
        organizationId={currentOrganizationId}
      />
    </SidebarProvider>
  );
}

// ============================================
// TAB COMPONENTS
// ============================================

type CollectionData = NonNullable<FunctionReturnType<typeof api.collections.get>>;

function GeneralTab({ collection }: { collection: CollectionData }) {
  const collectionGroup = useQuery(
    api.collectionGroups.get,
    collection.collectionGroupId
      ? { groupId: collection.collectionGroupId }
      : "skip",
  );

  const parentObject = useQuery(
    api.collections.getParentObject,
    collection._id
      ? { collectionId: collection._id as Id<"collections"> }
      : "skip",
  );

  return (
    <div className="space-y-8">
      {/* Classification & Metadata */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-xs font-medium text-foreground">
            <Tag className="h-4 w-4 text-accent" />
            Classification & Metadata
          </h3>
        </div>

        <div className="space-y-6 rounded-xl border border-border/60 bg-secondary/20 p-6">
          {/* Title */}
          <div className="grid gap-1">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Title
            </label>
            <div className="text-base font-medium text-foreground">
              {collection.title}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            {/* Accession Number */}
            <div className="grid gap-1">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Accession Number & Alternates
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-sm text-foreground">
                  {collection.accessionNumber}
                </span>
                {collection.alternateAccessionNumbers &&
                  collection.alternateAccessionNumbers.length > 0 && (
                    <>
                      <div className="h-4 w-px bg-border" />
                      <div className="flex flex-wrap gap-2">
                        {collection.alternateAccessionNumbers.map((num) => (
                          <div
                            key={num}
                            className="flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground"
                          >
                            <span className="font-mono text-muted-foreground/70">
                              Alt:
                            </span>
                            <span>{num}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
              </div>
            </div>

            {/* Parent Object */}
            <div className="grid gap-1">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Parent Object
              </label>
              {parentObject ? (
                <Link
                  href={`/objects/${parentObject._id}`}
                  className="text-sm text-accent hover:underline"
                >
                  {parentObject.title}
                </Link>
              ) : (
                <span className="text-sm italic text-muted-foreground">None</span>
              )}
            </div>
          </div>

          <div className="my-2 h-px bg-border/50" />

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            {/* Collection Group */}
            <div className="grid gap-1">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Collection
              </label>
              <div className="text-sm text-foreground">
                {collectionGroup?.name || "—"}
              </div>
            </div>

            {/* Object Type */}
            <div className="grid gap-1">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Object Type
              </label>
              <div className="text-sm text-foreground">
                {collection.objectType
                  ? (() => {
                      try {
                        const types = JSON.parse(collection.objectType);
                        return Array.isArray(types) ? types.join(" / ") : collection.objectType;
                      } catch {
                        return collection.objectType;
                      }
                    })()
                  : "—"}
              </div>
            </div>

            {/* Culture */}
            <div className="grid gap-1">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Culture
              </label>
              <div className="text-sm text-foreground">
                {collection.culture || "—"}
              </div>
            </div>

            {/* Artist / Maker */}
            <div className="grid gap-1">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Artist / Maker
              </label>
              <div className="text-sm text-foreground">
                {collection.creator || "—"}
              </div>
            </div>
          </div>

          {/* Description */}
          {collection.description && (
            <div className="grid gap-2">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Description
              </label>
              <p className="max-w-3xl whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {collection.description}
              </p>
            </div>
          )}

          {/* External Links */}
          {collection.links && collection.links.length > 0 && (
            <div className="space-y-3 pt-2">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                External Links
              </label>
              <div className="space-y-1">
                {collection.links.map((link) => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-max items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-accent hover:underline"
                  >
                    <LinkIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{link.label || link.url}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Status Display */}
          <div className="flex items-center gap-8 border-t border-border/60 pt-4">
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-2.5 w-2.5">
                {collection.isPubliclyVisible !== false && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                )}
                <span
                  className={cn(
                    "relative inline-flex h-2.5 w-2.5 rounded-full",
                    collection.isPubliclyVisible !== false
                      ? "bg-emerald-500"
                      : "bg-muted-foreground",
                  )}
                />
              </div>
              <span className="text-sm font-medium text-muted-foreground">
                {collection.isPubliclyVisible !== false
                  ? "Publicly Visible"
                  : "Not Public"}
              </span>
            </div>

            {collection.isHighResDownloadable && (
              <div className="flex items-center gap-2.5">
                <div className="flex h-2.5 w-2.5 items-center justify-center rounded-full bg-accent">
                  <CheckCircle className="h-1.5 w-1.5 text-white" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">
                  High-Res Downloadable
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PhysicalTab({ collection }: { collection: CollectionData }) {
  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Materials */}
        <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
          <span className="mb-2 block text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            Materials
          </span>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-secondary">
              <span className="font-serif text-xs text-foreground">M</span>
            </div>
            <span className="text-sm font-medium text-foreground">
              {collection.materials || "Not specified"}
            </span>
          </div>
        </div>

        {/* Technique */}
        <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
          <span className="mb-2 block text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            Technique
          </span>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-secondary">
              <Hammer className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <span className="text-sm font-medium text-foreground">
              {collection.technique || "Not specified"}
            </span>
          </div>
        </div>

        {/* Condition */}
        <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
          <span className="mb-2 block text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            Overall Condition
          </span>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10">
              <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            </div>
            <span className="text-sm font-medium text-emerald-400">
              {collection.condition || "Not assessed"}
            </span>
          </div>
        </div>
      </div>

      {/* Detailed Dimensions */}
      <div>
        <h3 className="mb-4 flex items-center gap-2 text-xs font-medium text-foreground">
          <Ruler className="h-4 w-4 text-rose-500" />
          Detailed Dimensions
        </h3>
        <div className="rounded-xl border border-border/60 bg-secondary/20 p-6">
          <div className="grid grid-cols-1 gap-6 divide-y md:grid-cols-2 md:divide-x md:divide-y-0 lg:grid-cols-4">
            {/* Height */}
            <div className="space-y-1">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Total Height
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-light text-foreground">
                  {collection.dimensionHeight ?? "—"}
                </span>
                {collection.dimensionHeight && (
                  <span className="text-xs text-muted-foreground">
                    {collection.dimensionUnit || "cm"}
                  </span>
                )}
              </div>
            </div>

            {/* Width */}
            <div className="space-y-1 pt-4 md:pl-6 md:pt-0">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Max Width
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-light text-foreground">
                  {collection.dimensionWidth ?? "—"}
                </span>
                {collection.dimensionWidth && (
                  <span className="text-xs text-muted-foreground">
                    {collection.dimensionUnit || "cm"}
                  </span>
                )}
              </div>
            </div>

            {/* Depth */}
            <div className="space-y-1 pt-4 md:pl-6 md:pt-0">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Depth
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-light text-foreground">
                  {collection.dimensionDepth ?? "—"}
                </span>
                {collection.dimensionDepth && (
                  <span className="text-xs text-muted-foreground">
                    {collection.dimensionUnit || "cm"}
                  </span>
                )}
              </div>
            </div>

            {/* Weight */}
            <div className="space-y-1 pt-4 md:pl-6 md:pt-0">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Weight
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-light text-foreground">
                  {collection.dimensionWeight ?? "—"}
                </span>
                {collection.dimensionWeight && (
                  <span className="text-xs text-muted-foreground">
                    {collection.weightUnit || "kg"}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Legacy dimensions string */}
          {collection.dimensions && !collection.dimensionHeight && (
            <div className="mt-4 border-t border-border/60 pt-4">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Dimensions (legacy)
              </span>
              <p className="mt-1 text-sm text-muted-foreground">
                {collection.dimensions}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Inscriptions & Marks */}
      <div>
        <h3 className="mb-4 flex items-center gap-2 text-xs font-medium text-foreground">
          <Search className="h-4 w-4 text-sky-500" />
          Inscriptions & Marks
        </h3>
        <div className="space-y-3 rounded-xl border border-border/60 bg-secondary/20 p-4">
          {collection.inscriptions ? (
            <p className="text-sm text-muted-foreground">{collection.inscriptions}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              No inscriptions documented.
            </p>
          )}

          {collection.inscriptionMarks &&
            collection.inscriptionMarks.length > 0 &&
            collection.inscriptionMarks.map((mark) => (
              <div key={mark.label} className="mt-2 flex items-start gap-2">
                <span className="shrink-0 rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  {mark.label}
                </span>
                <p className="text-xs text-muted-foreground">{mark.description}</p>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

function MediaTab({ collectionId }: { collectionId: string }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-xs font-medium text-foreground">
          <ImageIcon className="h-4 w-4 text-accent" />
          Media Gallery
        </h3>
      </div>
      <MediaGallery collectionId={collectionId} mediaType="images" />
    </div>
  );
}

function DigitalAssetsTab({ collection }: { collection: CollectionData }) {
  return (
    <div className="space-y-6">
      <h3 className="flex items-center gap-2 text-xs font-medium text-foreground">
        <LinkIcon className="h-4 w-4 text-sky-500" />
        Digital Resources
      </h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Links */}
        {collection.links && collection.links.length > 0 ? (
          collection.links.map((link) => (
            <div
              key={link.url}
              className="h-full rounded-xl border border-border/60 bg-secondary/20 p-1"
            >
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-secondary/50"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded border border-border/50 bg-secondary text-muted-foreground group-hover:text-muted-foreground">
                  {link.url.includes("sketchfab") ? (
                    <Box className="h-4 w-4" />
                  ) : (
                    <Globe className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-muted-foreground group-hover:text-foreground">
                    {link.label || "External Link"}
                  </p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {link.url}
                  </p>
                </div>
                <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-muted-foreground" />
              </a>
            </div>
          ))
        ) : (
          <div className="col-span-2 flex h-32 items-center justify-center rounded-xl border border-dashed border-border">
            <p className="text-sm text-muted-foreground">
              No digital assets linked
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ProvenanceTab({ collection }: { collection: CollectionData }) {
  return (
    <div className="space-y-8">
      {/* Acquisition Information */}
      <div>
        <h3 className="mb-4 flex items-center gap-2 text-xs font-medium text-foreground">
          <Building2 className="h-4 w-4 text-emerald-500" />
          Acquisition Information
        </h3>
        <div className="rounded-xl border border-border/60 bg-secondary/20 p-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* Method */}
            <div>
              <span className="mb-1 block text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Method
              </span>
              {collection.acquisitionMethod ? (
                <span className="inline-flex items-center rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-400">
                  {collection.acquisitionMethod}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              )}
            </div>

            {/* Source / Donor */}
            <div>
              <span className="mb-1 block text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Source / Donor
              </span>
              {collection.donated_by && collection.donated_by.length > 0 ? (
                <div className="flex items-center gap-2">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-white">
                    {collection.donated_by[0].charAt(0)}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {collection.donated_by.join(", ")}
                  </span>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              )}
            </div>

            {/* Date */}
            <div>
              <span className="mb-1 block text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Date
              </span>
              <span className="text-sm text-muted-foreground">
                {collection.donated_date || "—"}
              </span>
            </div>
          </div>

          {/* Credit Line */}
          {collection.creditLine && (
            <div className="mt-4 border-t border-border/50 pt-4">
              <span className="mb-1 block text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Credit Line
              </span>
              <p className="font-serif text-sm italic text-muted-foreground">
                "{collection.creditLine}"
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Ownership History */}
      <div>
        <h3 className="mb-6 flex items-center gap-2 text-xs font-medium text-foreground">
          <History className="h-4 w-4 text-purple-500" />
          Ownership History
        </h3>

        {collection.ownershipHistory && collection.ownershipHistory.length > 0 ? (
          <div className="relative space-y-8 border-l border-border pl-8">
            {collection.ownershipHistory.map((entry, index) => (
              <div key={`${entry.owner}-${index}`} className="relative">
                <div
                  className={cn(
                    "absolute -left-[39px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-background",
                    index === 0
                      ? "border-2 border-accent"
                      : "border-2 border-muted-foreground/50",
                  )}
                >
                  {index === 0 && (
                    <div className="h-1.5 w-1.5 rounded-full bg-accent" />
                  )}
                </div>
                <div className="max-w-2xl rounded-lg border border-border/60 bg-secondary/20 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-foreground">
                      {entry.owner}
                    </h4>
                    <span className="font-mono text-xs text-muted-foreground">
                      {entry.startYear}
                      {entry.endYear ? ` - ${entry.endYear}` : " - Present"}
                    </span>
                  </div>
                  {entry.description && (
                    <p className="text-sm text-muted-foreground">
                      {entry.description}
                    </p>
                  )}
                  {entry.verified && entry.verificationSource && (
                    <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                      <FileCheck className="h-3 w-3" />
                      Verified by {entry.verificationSource}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : collection.provenance ? (
          <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {collection.provenance}
            </p>
          </div>
        ) : (
          <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-border">
            <p className="text-sm text-muted-foreground">
              No provenance information recorded
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ConservationTab({
  collectionId,
  organizationId,
}: {
  collectionId: string;
  organizationId: Id<"organizations">;
}) {
  const treatments = useQuery(
    api.conservationTreatments?.list,
    collectionId
      ? { collectionId: collectionId as Id<"collections"> }
      : "skip",
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-xs font-medium text-foreground">
          <Stethoscope className="h-4 w-4 text-rose-500" />
          Treatment History
        </h3>
      </div>

      {treatments === undefined ? (
        <p className="text-muted-foreground">Loading treatments...</p>
      ) : treatments && treatments.length > 0 ? (
        <div className="space-y-4">
          {treatments.map((treatment) => (
            <div
              key={treatment._id}
              className="group overflow-hidden rounded-xl border border-border/60 bg-secondary/20"
            >
              <div className="flex items-center justify-between border-b border-border/60 bg-secondary/30 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                      treatment.treatmentType === "routine"
                        ? "border border-green-500/20 bg-green-500/10 text-green-400"
                        : treatment.treatmentType === "stabilization"
                          ? "border border-blue-500/20 bg-blue-500/10 text-blue-400"
                          : "border border-amber-500/20 bg-amber-500/10 text-amber-400",
                    )}
                  >
                    {treatment.treatmentType}
                  </span>
                  <span className="text-xs font-medium text-foreground">
                    {treatment.title}
                  </span>
                </div>
                <span className="font-mono text-xs text-muted-foreground">
                  {new Date(treatment.performedAt).toLocaleDateString()}
                </span>
              </div>
              <div className="p-4">
                <p className="mb-3 text-sm text-muted-foreground">
                  {treatment.description}
                </p>
                {treatment.performedByName && (
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-[8px]">
                      {treatment.performedByName.charAt(0)}
                    </div>
                    <span>
                      Performed by{" "}
                      <span className="text-muted-foreground">
                        {treatment.performedByName}
                      </span>
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-border">
          <p className="text-sm text-muted-foreground">
            No conservation treatments recorded
          </p>
        </div>
      )}
    </div>
  );
}

function ExhibitionsTab({
  collectionId,
  organizationId,
}: {
  collectionId: string;
  organizationId: Id<"organizations">;
}) {
  const exhibitions = useQuery(
    api.exhibitions?.list,
    collectionId
      ? { collectionId: collectionId as Id<"collections"> }
      : "skip",
  );

  const collection = useQuery(
    api.collections.get,
    collectionId ? { collectionId: collectionId as Id<"collections"> } : "skip",
  );

  return (
    <div className="space-y-6">
      <h3 className="flex items-center gap-2 text-xs font-medium text-foreground">
        <Presentation className="h-4 w-4 text-amber-500" />
        Exhibition History
      </h3>

      <div className="grid grid-cols-1 gap-4">
        {exhibitions === undefined ? (
          <p className="text-muted-foreground">Loading exhibitions...</p>
        ) : exhibitions && exhibitions.length > 0 ? (
          exhibitions.map((exhibition) => (
            <div
              key={exhibition._id}
              className={cn(
                "flex gap-4 rounded-xl border p-4",
                exhibition.isCurrent
                  ? "border-accent/30 bg-accent/5"
                  : "border-border/60 bg-secondary/20 opacity-75 hover:opacity-100",
              )}
            >
              <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg border border-border bg-secondary text-center">
                <span className="text-[10px] font-bold uppercase text-muted-foreground">
                  {exhibition.isCurrent ? "Now" : new Date(exhibition.startDate).getFullYear()}
                </span>
                <span
                  className={cn(
                    "text-xs font-bold",
                    exhibition.isCurrent ? "text-accent" : "text-muted-foreground",
                  )}
                >
                  {exhibition.isCurrent ? "Open" : "Past"}
                </span>
              </div>
              <div>
                <h4 className="text-sm font-medium text-foreground">
                  {exhibition.title}
                </h4>
                {exhibition.location && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {exhibition.location}
                  </p>
                )}
                <div className="mt-2 flex gap-2">
                  <span className="rounded border border-border bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {new Date(exhibition.startDate).toLocaleDateString()}
                    {exhibition.endDate &&
                      ` - ${new Date(exhibition.endDate).toLocaleDateString()}`}
                  </span>
                  {exhibition.isLoan && exhibition.loanVenue && (
                    <span className="rounded border border-border bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      Loan: {exhibition.loanVenue}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : collection?.exhibitionHistory ? (
          <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {collection.exhibitionHistory}
            </p>
          </div>
        ) : (
          <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-border">
            <p className="text-sm text-muted-foreground">
              No exhibition history recorded
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function LogsTab({
  collectionId,
  organizationId,
}: {
  collectionId: string;
  organizationId: Id<"organizations">;
}) {
  const auditLogs = useQuery(api.auditLog.getByEntity, {
    organizationId,
    entityType: "collection",
    entityId: collectionId,
    limit: 20,
  });

  return (
    <div className="space-y-6">
      <h3 className="flex items-center gap-2 text-xs font-medium text-foreground">
        <ScrollText className="h-4 w-4 text-orange-500" />
        Audit Log
      </h3>

      <div className="overflow-hidden rounded-xl border border-border/60 bg-secondary/20">
        <table className="w-full text-left">
          <thead className="border-b border-border/60 bg-secondary/50">
            <tr>
              <th className="w-32 px-4 py-3 text-[10px] font-semibold uppercase text-muted-foreground">
                Date
              </th>
              <th className="w-48 px-4 py-3 text-[10px] font-semibold uppercase text-muted-foreground">
                User
              </th>
              <th className="px-4 py-3 text-[10px] font-semibold uppercase text-muted-foreground">
                Action Details
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {auditLogs === undefined ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                  Loading logs...
                </td>
              </tr>
            ) : auditLogs.length > 0 ? (
              auditLogs.map((log) => (
                <tr
                  key={log._id}
                  className="group transition-colors hover:bg-secondary/40"
                >
                  <td className="px-4 py-3 align-top">
                    <span className="font-mono text-xs text-muted-foreground">
                      {new Date(log.timestamp).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                      ,{" "}
                      {new Date(log.timestamp).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-center gap-2">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full border border-border bg-secondary text-[9px] text-muted-foreground">
                        {log.userName?.charAt(0) || "?"}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {log.userName || "Unknown"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-accent">{log.action}</span>
                    </p>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                  No audit logs found
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {auditLogs && auditLogs.length > 0 && (
          <div className="border-t border-border/60 bg-secondary/30 px-4 py-3 text-center">
            <button
              type="button"
              className="text-xs text-muted-foreground transition-colors hover:text-muted-foreground"
            >
              Load older logs...
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
