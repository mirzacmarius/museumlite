"use client";

import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { formatDate } from "@/lib/format-date";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@v1/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@v1/ui/avatar";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@v1/ui/dropdown-menu";
import { ImageLightbox, type LightboxImage } from "@v1/ui/image-lightbox";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import { SidebarProvider } from "@v1/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@v1/ui/tooltip";
import { cn } from "@v1/ui/utils";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  ArrowLeft,
  Box,
  Building2,
  Calendar,
  Check,
  CheckCircle,
  Copy,
  ExternalLink,
  FileCheck,
  FileDown,
  Globe,
  Hammer,
  History,
  Image as ImageIcon,
  Info,
  Link2,
  Link as LinkIcon,
  MapPin,
  Maximize2,
  Pencil,
  Presentation,
  Printer,
  Ruler,
  ScrollText,
  Search,
  Send,
  Share2,
  Stethoscope,
  Tag,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArchiveDetailsTab } from "./_components/archive-details-tab";
import { FineArtDetailsTab } from "./_components/fine-art-details-tab";
import { MediaGallery } from "./_components/media-gallery";
import { NaturalHistoryDetailsTab } from "./_components/natural-history-details-tab";
import { RecordContextSidebar } from "./_components/record-context-sidebar";
import { VehicleDetailsTab } from "./_components/vehicle-details-tab";
import { WineDetailsTab } from "./_components/wine-details-tab";

type TabId =
  | "general"
  | "physical"
  | "media"
  | "digital"
  | "provenance"
  | "conservation"
  | "exhibitions"
  | "loans"
  | "logs"
  | "fine_art"
  | "wine"
  | "automotive"
  | "natural_history"
  | "archive";

type LoanForCollection = {
  _id: Id<"loans">;
  loanNumber: string;
  type: "incoming" | "outgoing";
  lenderBorrowerName: string;
  startDate: number;
  endDate?: number;
  status: "pending" | "active" | "dispatched" | "returned" | "cancelled";
};

const baseTabs: { id: TabId; label: string }[] = [
  { id: "general", label: "General" },
  { id: "provenance", label: "Provenance" },
  { id: "physical", label: "Physical Description" },
  { id: "media", label: "Media" },
  { id: "digital", label: "Digital Assets" },
  { id: "conservation", label: "Conservation" },
  { id: "exhibitions", label: "Exhibitions" },
  { id: "loans", label: "Loans" },
  { id: "logs", label: "Logs" },
];

const moduleTabMap: Record<string, { id: TabId; label: string }> = {
  fine_art: { id: "fine_art", label: "Fine Art Details" },
  wine: { id: "wine", label: "Wine & Spirits" },
  automotive: { id: "automotive", label: "Vehicle Details" },
  natural_history: { id: "natural_history", label: "Natural History" },
  archive: { id: "archive", label: "Archive Details" },
};

export default function ObjectDetailPage() {
  const t = useScopedI18n("objects");
  const common = useScopedI18n("common");
  const locale = useCurrentLocale();
  const params = useParams();
  const collectionId = params.id as string;
  const { currentOrganizationId } = useOrganization();
  const [activeTab, setActiveTab] = useState<TabId>("general");
  const [copied, setCopied] = useState(false);

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

  const parentObject = useQuery(
    api.collections.getParentObjectWithThumbnail,
    collection?._id
      ? { collectionId: collection._id as Id<"collections"> }
      : "skip",
  );

  const siblingObjects = useQuery(
    api.collections.getSiblingObjects,
    collection?._id
      ? { collectionId: collection._id as Id<"collections"> }
      : "skip",
  );

  const tabs = useMemo(() => {
    const collectionType = collection?.collectionType;
    if (!collectionType || collectionType === "general") {
      return baseTabs;
    }
    const moduleTab = moduleTabMap[collectionType];
    if (!moduleTab) {
      return baseTabs;
    }
    return [...baseTabs.slice(0, 1), moduleTab, ...baseTabs.slice(1)];
  }, [collection?.collectionType]);

  // Get primary image
  const primaryImage = media?.find(
    (m) => m.isPrimary && m.fileType === "image",
  );
  const firstImage = media?.find((m) => m.fileType === "image");
  const heroImage = primaryImage || firstImage;

  // Hero lightbox state
  const [isHeroLightboxOpen, setIsHeroLightboxOpen] = useState(false);
  const [lightboxInitialIndex, setLightboxInitialIndex] = useState(0);

  // Print modal state
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const router = useRouter();
  const deleteCollection = useMutation(api.collections.deleteCollection);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!collection?._id) return;
    setIsDeleting(true);
    try {
      await deleteCollection({ collectionId: collection._id });
      router.push("/objects");
    } catch (error) {
      console.error("Failed to delete object:", error);
      setIsDeleting(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };
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
          {t("detail.selectOrganization")}
        </p>
      </div>
    );
  }

  if (collection === undefined) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <p className="text-muted-foreground">{common("loading")}</p>
      </div>
    );
  }

  if (collection === null) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <p className="text-muted-foreground">{t("objectNotFound")}</p>
      </div>
    );
  }

  const locationString =
    locationPath?.map((loc) => loc.name).join(", ") || null;

  return (
    <>
      <SidebarProvider
        style={{ "--sidebar-width": "20rem" } as React.CSSProperties}
        className="flex min-h-screen w-full print:hidden"
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
              <span className="text-muted-foreground">
                {t("detail.collections")}
              </span>
              <span className="text-muted-foreground/50">/</span>
              {collectionGroup && (
                <>
                  <span className="text-muted-foreground">
                    {collectionGroup.name}
                  </span>
                  <span className="text-muted-foreground/50">/</span>
                </>
              )}
              <span className="font-medium text-foreground">
                {collection.title}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    title={common("share")}
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={handleCopyLink}>
                    {linkCopied ? (
                      <Check className="mr-2 h-4 w-4 text-green-500" />
                    ) : (
                      <Link2 className="mr-2 h-4 w-4" />
                    )}
                    {linkCopied
                      ? t("detail.linkCopied")
                      : t("detail.copyObjectLink")}
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <FileDown className="mr-2 h-4 w-4" />
                    {t("detail.exportToPdf")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <Send className="mr-2 h-4 w-4" />
                    {t("detail.requestLoan")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                title={common("printRecord")}
                onClick={() => setIsPrintModalOpen(true)}
              >
                <Printer className="h-4 w-4" />
              </Button>
              <div className="h-4 w-px bg-border" />
              <PermissionGate permission="collections.update">
                <Button asChild>
                  <Link href={`/objects/${collectionId}/edit`}>
                    <Pencil className="mr-2 h-3.5 w-3.5" />
                    {t("detail.editObject")}
                  </Link>
                </Button>
              </PermissionGate>
              <PermissionGate permission="collections.delete">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {t("detail.deleteTitle")}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {t("detail.deleteConfirm", { title: collection.title })}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{common("cancel")}</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {isDeleting
                          ? t("detail.deleting")
                          : t("detail.deleteObject")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
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
                  aria-label={t("detail.viewFullSize")}
                >
                  {heroImage?.url ? (
                    <img
                      src={heroImage.thumbnailUrl || heroImage.url}
                      alt={collection.title}
                      className="h-48 w-48 rounded-xl border border-border/60 bg-secondary object-cover shadow-2xl transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="flex h-48 w-48 items-center justify-center rounded-xl border border-border/60 bg-secondary">
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
                  initialIndex={lightboxInitialIndex}
                  isOpen={isHeroLightboxOpen}
                  onClose={() => setIsHeroLightboxOpen(false)}
                />

                {/* Hero Info */}
                <div className="flex-1 space-y-4">
                  {/* Status, Accession & Alternates Row */}
                  <div className="flex flex-wrap items-center gap-2.5">
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

                    {/* Public/Private Badge */}
                    <div
                      className={cn(
                        "flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px]",
                        collection.isPubliclyVisible !== false
                          ? "border border-emerald-500/30 bg-emerald-100 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-950/30 dark:text-emerald-400"
                          : "border border-red-500/30 bg-red-100 text-red-700 dark:border-red-500/20 dark:bg-red-950/30 dark:text-red-400",
                      )}
                    >
                      <div className="relative flex h-2 w-2">
                        {collection.isPubliclyVisible !== false && (
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                        )}
                        <span
                          className={cn(
                            "relative inline-flex h-2 w-2 rounded-full",
                            collection.isPubliclyVisible !== false
                              ? "bg-emerald-500"
                              : "bg-red-500",
                          )}
                        />
                      </div>
                      <span className="font-medium">
                        {collection.isPubliclyVisible !== false
                          ? "Public"
                          : "Private"}
                      </span>
                    </div>

                    {/* Main Accession Number */}
                    <Popover open={copied} onOpenChange={setCopied}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="flex cursor-pointer items-center gap-1.5 rounded border border-border/60 bg-secondary px-2 py-1 font-mono text-xs text-foreground transition-colors hover:bg-secondary/80"
                          onClick={() => {
                            navigator.clipboard.writeText(
                              collection.accessionNumber,
                            );
                            setCopied(true);
                            setTimeout(() => setCopied(false), 1500);
                          }}
                        >
                          <span>{collection.accessionNumber}</span>
                          {copied ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <Copy className="h-3 w-3 text-muted-foreground transition-colors hover:text-foreground" />
                          )}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto px-3 py-1.5 text-xs">
                        Copied to clipboard
                      </PopoverContent>
                    </Popover>

                    {/* Alternate Accession Numbers */}
                    {collection.alternateAccessionNumbers &&
                      collection.alternateAccessionNumbers.length > 0 && (
                        <>
                          <div className="mx-1 h-4 w-px bg-border" />
                          <div className="flex items-center gap-2">
                            {collection.alternateAccessionNumbers.map(
                              (altNum, idx) => (
                                <div
                                  key={altNum}
                                  className="flex items-center gap-1.5 rounded-md border border-border/60 bg-secondary/50 px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
                                >
                                  <span className="select-none font-mono text-muted-foreground/60">
                                    {idx === 0 ? "ID:" : "ALT:"}
                                  </span>
                                  <span>{altNum}</span>
                                </div>
                              ),
                            )}
                            <Popover>
                              <PopoverTrigger asChild>
                                <button
                                  type="button"
                                  className="rounded-full p-0.5 text-muted-foreground/50 transition-colors hover:bg-secondary hover:text-muted-foreground"
                                >
                                  <Info className="h-3.5 w-3.5" />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-64 p-3 text-xs">
                                <p className="font-medium text-foreground">
                                  Alternative Identifiers
                                </p>
                                <p className="mt-1.5 leading-relaxed text-muted-foreground">
                                  Previous catalog numbers, legacy IDs, or
                                  external system references used to identify
                                  this object before or alongside the current
                                  accession number.
                                </p>
                              </PopoverContent>
                            </Popover>
                          </div>
                        </>
                      )}
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

                  {/* Metadata Row */}
                  <div className="flex items-center gap-6 pt-2">
                    {locationString && (
                      <div className="flex items-center gap-2 text-xs">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {locationString}
                        </span>
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
                  </div>

                  {/* Object Hierarchy - Parent & Siblings */}
                  {parentObject && (
                    <div className="flex items-center gap-4 rounded-lg border border-border/60 bg-secondary/30 px-4 py-3">
                      {/* Parent Group Info */}
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
                          Part of
                        </span>
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Link
                                href={`/objects/${parentObject._id}`}
                                className="group flex items-center gap-2 rounded-full border border-border/60 bg-background/50 py-1 pl-1 pr-3 transition-all hover:border-accent hover:bg-accent/5"
                              >
                                <Avatar className="h-6 w-6 ring-1 ring-border group-hover:ring-accent">
                                  <AvatarImage
                                    src={parentObject.thumbnailUrl ?? undefined}
                                    alt={parentObject.title}
                                  />
                                  <AvatarFallback className="bg-secondary text-[10px]">
                                    <Box className="h-3 w-3 text-muted-foreground" />
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground">
                                  {parentObject.title}
                                </span>
                              </Link>
                            </TooltipTrigger>
                            <TooltipContent
                              side="bottom"
                              className="max-w-xs border border-border/60 bg-popover text-popover-foreground"
                            >
                              <div className="space-y-1">
                                <p className="font-medium">
                                  {parentObject.title}
                                </p>
                                {parentObject.accessionNumber && (
                                  <p className="text-xs text-muted-foreground">
                                    {parentObject.accessionNumber}
                                  </p>
                                )}
                                <p className="text-xs text-muted-foreground">
                                  Parent object
                                </p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>

                      {/* Divider */}
                      {siblingObjects && siblingObjects.length > 0 && (
                        <div className="h-8 w-px bg-border/60" />
                      )}

                      {/* Siblings as pills */}
                      {siblingObjects && siblingObjects.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
                            Related
                          </span>

                          {/* Current object pill (highlighted) */}
                          <TooltipProvider delayDuration={200}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex cursor-default items-center gap-2 rounded-full border border-accent bg-accent/10 py-1 pl-1 pr-3">
                                  <Avatar className="h-6 w-6 ring-1 ring-border group-hover:ring-accent">
                                    <AvatarImage
                                      src={
                                        heroImage?.thumbnailUrl ??
                                        heroImage?.url ??
                                        undefined
                                      }
                                      alt={collection.title}
                                    />
                                    <AvatarFallback className="bg-secondary text-[10px] font-medium text-muted-foreground">
                                      {collection.title.charAt(0)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground">
                                    {collection.title
                                      .split(" ")
                                      .slice(0, 2)
                                      .join(" ")}
                                    {collection.title.split(" ").length > 2 &&
                                      " ..."}
                                  </span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent
                                side="bottom"
                                className="max-w-xs border border-border/60 bg-popover text-popover-foreground"
                              >
                                <div className="space-y-1">
                                  <p className="font-medium">
                                    {collection.title}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {collection.accessionNumber}
                                  </p>
                                  <p className="text-xs text-accent">
                                    Current object
                                  </p>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          {/* Sibling pills */}
                          {siblingObjects.slice(0, 3).map((sibling) => (
                            <TooltipProvider
                              key={sibling._id}
                              delayDuration={200}
                            >
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Link
                                    href={`/objects/${sibling._id}`}
                                    className="group flex items-center gap-2 rounded-full border border-border/60 bg-background/50 py-1 pl-1 pr-3 transition-all hover:border-accent hover:bg-accent/5"
                                  >
                                    <Avatar className="h-6 w-6 ring-1 ring-border group-hover:ring-accent">
                                      <AvatarImage
                                        src={sibling.thumbnailUrl ?? undefined}
                                        alt={sibling.title}
                                      />
                                      <AvatarFallback className="bg-secondary text-[10px] font-medium text-muted-foreground">
                                        {sibling.title.charAt(0)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground">
                                      {sibling.title
                                        .split(" ")
                                        .slice(0, 2)
                                        .join(" ")}
                                      {sibling.title.split(" ").length > 2 &&
                                        "..."}
                                    </span>
                                  </Link>
                                </TooltipTrigger>
                                <TooltipContent
                                  side="bottom"
                                  className="max-w-xs border border-border/60 bg-popover text-popover-foreground"
                                >
                                  <div className="space-y-1">
                                    <p className="font-medium">
                                      {sibling.title}
                                    </p>
                                    {sibling.accessionNumber && (
                                      <p className="text-xs text-muted-foreground">
                                        {sibling.accessionNumber}
                                      </p>
                                    )}
                                    <p className="text-xs text-muted-foreground">
                                      Sibling object
                                    </p>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ))}

                          {/* More indicator */}
                          {siblingObjects.length > 3 && (
                            <div className="flex h-7 items-center rounded-full border border-border/60 bg-secondary/50 px-2.5 text-[10px] font-medium text-muted-foreground">
                              +{siblingObjects.length - 3} more
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
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
                <MediaTab
                  collectionId={collectionId}
                  onOpenLightbox={(index) => {
                    setLightboxInitialIndex(index);
                    setIsHeroLightboxOpen(true);
                  }}
                />
              )}
              {activeTab === "digital" && (
                <DigitalAssetsTab collection={collection} />
              )}
              {activeTab === "provenance" && (
                <ProvenanceTab collection={collection} />
              )}
              {activeTab === "conservation" && (
                <ConservationTab
                  collectionId={collectionId}
                  organizationId={currentOrganizationId}
                  locale={locale}
                />
              )}
              {activeTab === "exhibitions" && (
                <ExhibitionsTab
                  collectionId={collectionId}
                  organizationId={currentOrganizationId}
                  locale={locale}
                />
              )}
              {activeTab === "loans" && (
                <LoansTab collectionId={collectionId} locale={locale} />
              )}
              {activeTab === "logs" && (
                <LogsTab
                  collectionId={collectionId}
                  organizationId={currentOrganizationId}
                  locale={locale}
                />
              )}
              {activeTab === "fine_art" && (
                <FineArtDetailsTab
                  collectionId={collectionId}
                  organizationId={currentOrganizationId}
                />
              )}
              {activeTab === "wine" && (
                <WineDetailsTab
                  collectionId={collectionId}
                  organizationId={currentOrganizationId}
                />
              )}
              {activeTab === "automotive" && (
                <VehicleDetailsTab
                  collectionId={collectionId}
                  organizationId={currentOrganizationId}
                />
              )}
              {activeTab === "natural_history" && (
                <NaturalHistoryDetailsTab
                  collectionId={collectionId}
                  organizationId={currentOrganizationId}
                />
              )}
              {activeTab === "archive" && (
                <ArchiveDetailsTab
                  collectionId={collectionId}
                  organizationId={currentOrganizationId}
                />
              )}
            </div>
          </div>
        </main>

        {/* Right Sidebar */}
        <RecordContextSidebar
          collectionId={collectionId}
          tags={collection.tags}
          organizationId={currentOrganizationId}
          heroImageUrl={heroImage?.url}
          condition={collection.condition}
          provenance={collection.provenance}
          ownershipHistory={collection.ownershipHistory}
        />
      </SidebarProvider>

      {/* Print Preview Modal - Outside SidebarProvider for print isolation */}
      <Dialog open={isPrintModalOpen} onOpenChange={setIsPrintModalOpen}>
        <DialogContent className="flex flex-col max-w-[210mm] w-full h-[90vh] bg-white text-black p-0 print:max-w-none print:max-h-none print:h-auto print:w-full print:overflow-visible print:shadow-none print:border-none print:rounded-none print:p-0">
          {/* Fixed Header */}
          <DialogHeader className="flex-shrink-0 print:hidden border-b border-gray-200 p-6 pb-4">
            <DialogTitle className="text-black">Print Preview</DialogTitle>
          </DialogHeader>

          {/* Scrollable A4 Paper-like content */}
          <div className="flex-1 overflow-y-auto">
            <div className="space-y-5 bg-white text-black p-6 print:p-[15mm] print:space-y-4 print:break-inside-avoid-page">
              {/* Header */}
              <div className="flex items-start gap-4 border-b border-gray-200 pb-4 print:gap-3 print:pb-3">
                {heroImage?.url && (
                  <img
                    src={heroImage.thumbnailUrl || heroImage.url}
                    alt={collection.title}
                    className="h-28 w-28 flex-shrink-0 rounded border border-gray-300 object-cover print:h-20 print:w-20"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl font-bold text-black print:text-lg">
                    {collection.title}
                  </h1>
                  {collection.alternativeTitle && (
                    <p className="text-sm text-gray-600 italic print:text-xs">
                      {collection.alternativeTitle}
                    </p>
                  )}
                  <p className="mt-1 font-mono text-xs text-gray-600">
                    {collection.accessionNumber}
                  </p>
                  {collection.alternateAccessionNumbers &&
                    collection.alternateAccessionNumbers.length > 0 && (
                      <p className="text-[10px] text-gray-500">
                        Alt: {collection.alternateAccessionNumbers.join(", ")}
                      </p>
                    )}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {collection.displayStatus && (
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-700">
                        {collection.displayStatus}
                      </span>
                    )}
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-medium",
                        collection.status === "active"
                          ? "bg-green-100 text-green-700"
                          : collection.status === "loaned"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-red-100 text-red-700",
                      )}
                    >
                      {collection.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Basic Information */}
              <div className="print:break-inside-avoid">
                <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500 print:text-[10px]">
                  Basic Information
                </h2>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm print:text-xs print:gap-x-4 print:gap-y-1">
                  {collection.objectType && (
                    <div>
                      <p className="text-xs font-medium text-gray-500">
                        Object Type
                      </p>
                      <p className="text-black">{collection.objectType}</p>
                    </div>
                  )}
                  {collection.objectName && (
                    <div>
                      <p className="text-xs font-medium text-gray-500">
                        Object Name
                      </p>
                      <p className="text-black">{collection.objectName}</p>
                    </div>
                  )}
                  {collection.creator && (
                    <div>
                      <p className="text-xs font-medium text-gray-500">
                        Creator/Artist
                      </p>
                      <p className="text-black">{collection.creator}</p>
                    </div>
                  )}
                  {collection.dateCreated && (
                    <div>
                      <p className="text-xs font-medium text-gray-500">
                        Date Created
                      </p>
                      <p className="text-black">{collection.dateCreated}</p>
                    </div>
                  )}
                  {collection.culture && (
                    <div>
                      <p className="text-xs font-medium text-gray-500">
                        Culture
                      </p>
                      <p className="text-black">{collection.culture}</p>
                    </div>
                  )}
                  {collection.period && (
                    <div>
                      <p className="text-xs font-medium text-gray-500">
                        Period
                      </p>
                      <p className="text-black">{collection.period}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Physical Description */}
              <div className="print:break-inside-avoid">
                <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500 print:text-[10px]">
                  Physical Description
                </h2>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm print:text-xs print:gap-x-4 print:gap-y-1">
                  {collection.materials && (
                    <div>
                      <p className="text-xs font-medium text-gray-500">
                        Materials
                      </p>
                      <p className="text-black">{collection.materials}</p>
                    </div>
                  )}
                  {collection.technique && (
                    <div>
                      <p className="text-xs font-medium text-gray-500">
                        Technique
                      </p>
                      <p className="text-black">{collection.technique}</p>
                    </div>
                  )}
                  {collection.dimensions && (
                    <div>
                      <p className="text-xs font-medium text-gray-500">
                        Dimensions
                      </p>
                      <p className="text-black">{collection.dimensions}</p>
                    </div>
                  )}
                  {(collection.dimensionHeight ||
                    collection.dimensionWidth ||
                    collection.dimensionDepth) && (
                    <div>
                      <p className="text-xs font-medium text-gray-500">
                        Detailed Dimensions
                      </p>
                      <p className="text-black">
                        {[
                          collection.dimensionHeight &&
                            `H: ${collection.dimensionHeight}`,
                          collection.dimensionWidth &&
                            `W: ${collection.dimensionWidth}`,
                          collection.dimensionDepth &&
                            `D: ${collection.dimensionDepth}`,
                        ]
                          .filter(Boolean)
                          .join(" × ")}{" "}
                        {collection.dimensionUnit || "cm"}
                      </p>
                    </div>
                  )}
                  {collection.dimensionWeight && (
                    <div>
                      <p className="text-xs font-medium text-gray-500">
                        Weight
                      </p>
                      <p className="text-black">
                        {collection.dimensionWeight}{" "}
                        {collection.weightUnit || "kg"}
                      </p>
                    </div>
                  )}
                  {collection.condition && (
                    <div className="col-span-2">
                      <p className="text-xs font-medium text-gray-500">
                        Condition
                      </p>
                      <p className="text-black">{collection.condition}</p>
                    </div>
                  )}
                  {collection.inscriptions && (
                    <div className="col-span-2">
                      <p className="text-xs font-medium text-gray-500">
                        Inscriptions
                      </p>
                      <p className="text-black whitespace-pre-wrap">
                        {collection.inscriptions}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              {collection.description && (
                <div>
                  <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500 print:text-[10px]">
                    Description
                  </h2>
                  <p className="text-sm text-black whitespace-pre-wrap print:text-xs">
                    {collection.description}
                  </p>
                </div>
              )}

              {/* Provenance & Acquisition */}
              {(collection.provenance ||
                collection.creditLine ||
                collection.acquisitionMethod ||
                collection.donated_by) && (
                <div>
                  <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500 print:text-[10px]">
                    Provenance & Acquisition
                  </h2>
                  <div className="space-y-2 text-sm print:text-xs print:space-y-1">
                    {collection.creditLine && (
                      <div>
                        <p className="text-xs font-medium text-gray-500">
                          Credit Line
                        </p>
                        <p className="text-black">{collection.creditLine}</p>
                      </div>
                    )}
                    {collection.acquisitionMethod && (
                      <div>
                        <p className="text-xs font-medium text-gray-500">
                          Acquisition Method
                        </p>
                        <p className="text-black">
                          {collection.acquisitionMethod}
                        </p>
                      </div>
                    )}
                    {collection.donated_by &&
                      collection.donated_by.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-gray-500">
                            Donated By
                          </p>
                          <p className="text-black">
                            {collection.donated_by.join(", ")}
                          </p>
                        </div>
                      )}
                    {collection.donated_date && (
                      <div>
                        <p className="text-xs font-medium text-gray-500">
                          Donation Date
                        </p>
                        <p className="text-black">{collection.donated_date}</p>
                      </div>
                    )}
                    {collection.provenance && (
                      <div>
                        <p className="text-xs font-medium text-gray-500">
                          Provenance
                        </p>
                        <p className="text-black whitespace-pre-wrap">
                          {collection.provenance}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Ownership History */}
              {collection.ownershipHistory &&
                collection.ownershipHistory.length > 0 && (
                  <div>
                    <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500 print:text-[10px]">
                      Ownership History
                    </h2>
                    <div className="space-y-2">
                      {collection.ownershipHistory.map((entry) => (
                        <div
                          key={`${entry.owner}-${entry.startYear || "unknown"}`}
                          className="rounded border border-gray-200 p-2 text-sm"
                        >
                          <p className="font-medium text-black">
                            {entry.owner}
                          </p>
                          {(entry.startYear || entry.endYear) && (
                            <p className="text-xs text-gray-500">
                              {entry.startYear || "?"} –{" "}
                              {entry.endYear || "Present"}
                            </p>
                          )}
                          {entry.description && (
                            <p className="mt-1 text-gray-600">
                              {entry.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Exhibition History */}
              {collection.exhibitionHistory && (
                <div>
                  <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500 print:text-[10px]">
                    Exhibition History
                  </h2>
                  <p className="text-sm text-black whitespace-pre-wrap print:text-xs">
                    {collection.exhibitionHistory}
                  </p>
                </div>
              )}

              {/* Location */}
              {locationPath && locationPath.length > 0 && (
                <div>
                  <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500 print:text-[10px]">
                    Current Location
                  </h2>
                  <p className="text-sm text-black print:text-xs">
                    {locationPath.map((loc) => loc.name).join(" > ")}
                  </p>
                </div>
              )}

              {/* Tags */}
              {collection.tags && collection.tags.length > 0 && (
                <div>
                  <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500 print:text-[10px]">
                    Tags
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {collection.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Legal & Visibility */}
              <div>
                <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500 print:text-[10px]">
                  Legal & Visibility
                </h2>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm print:text-xs print:gap-x-4 print:gap-y-1">
                  <div>
                    <p className="text-xs font-medium text-gray-500 print:text-[10px]">
                      Public Visibility
                    </p>
                    <p className="text-black">
                      {collection.isPubliclyVisible ? "Yes" : "No"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 print:text-[10px]">
                      Legal Restrictions
                    </p>
                    <p className="text-black">
                      {collection.legalRestrictions ? "Yes" : "None"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Footer with print date */}
              <div className="border-t border-gray-200 pt-3 text-[10px] text-gray-400 print:pt-2 print:text-[9px]">
                <p>
                  Printed on{" "}
                  {formatDate(new Date(), locale, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex justify-end gap-2 p-6 pt-4 border-t border-gray-200 bg-white print:hidden">
            <Button
              variant="outline"
              onClick={() => setIsPrintModalOpen(false)}
              className="bg-gray-900 text-white border-gray-300 hover:bg-gray-100 hover:text-black"
            >
              Cancel
            </Button>
            <Button
              onClick={() => window.print()}
              className="bg-gray-900 text-white hover:bg-gray-800"
            >
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================
// TAB COMPONENTS
// ============================================

type CollectionData = NonNullable<
  FunctionReturnType<typeof api.collections.get>
>;

function GeneralTab({ collection }: { collection: CollectionData }) {
  const collectionGroup = useQuery(
    api.collectionGroups.get,
    collection.collectionGroupId
      ? { groupId: collection.collectionGroupId }
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
                        return Array.isArray(types)
                          ? types.join(" / ")
                          : collection.objectType;
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
          {collection.isHighResDownloadable && (
            <div className="flex items-center gap-8 border-t border-border/60 pt-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-2.5 w-2.5 items-center justify-center rounded-full bg-accent">
                  <CheckCircle className="h-1.5 w-1.5 text-white" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">
                  High-Res Downloadable
                </span>
              </div>
            </div>
          )}
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
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-secondary">
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
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-secondary">
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
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-100 dark:border-emerald-500/20 dark:bg-emerald-500/10">
              <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            </div>
            <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
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
            <p className="text-sm text-muted-foreground">
              {collection.inscriptions}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              No inscriptions documented.
            </p>
          )}

          {collection.inscriptionMarks &&
            collection.inscriptionMarks.length > 0 &&
            collection.inscriptionMarks.map((mark) => (
              <div key={mark.label} className="mt-2 flex items-start gap-2">
                <span className="shrink-0 rounded border border-border/60 bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  {mark.label}
                </span>
                <p className="text-xs text-muted-foreground">
                  {mark.description}
                </p>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

function MediaTab({
  collectionId,
  onOpenLightbox,
}: {
  collectionId: string;
  onOpenLightbox: (index: number) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-xs font-medium text-foreground">
          <ImageIcon className="h-4 w-4 text-accent" />
          Media Gallery
        </h3>
      </div>
      <MediaGallery
        collectionId={collectionId}
        mediaType="images"
        onOpenLightbox={onOpenLightbox}
      />
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
                <span className="inline-flex items-center rounded border border-emerald-500/30 bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
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
                    {collection.donated_by[0]?.charAt(0) ?? "?"}
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

        {collection.ownershipHistory &&
        collection.ownershipHistory.length > 0 ? (
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
  locale,
}: {
  collectionId: string;
  organizationId: Id<"organizations">;
  locale: string;
}) {
  const treatments = useQuery(
    api.conservationTreatments?.list,
    collectionId ? { collectionId: collectionId as Id<"collections"> } : "skip",
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
                  {formatDate(new Date(treatment.performedAt), locale)}
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
  locale,
}: {
  collectionId: string;
  organizationId: Id<"organizations">;
  locale: string;
}) {
  const exhibitions = useQuery(
    api.exhibitions?.list,
    collectionId ? { collectionId: collectionId as Id<"collections"> } : "skip",
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
              <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg border border-border/60 bg-secondary text-center">
                <span className="text-[10px] font-bold uppercase text-muted-foreground">
                  {exhibition.isCurrent
                    ? "Now"
                    : new Date(exhibition.startDate).getFullYear()}
                </span>
                <span
                  className={cn(
                    "text-xs font-bold",
                    exhibition.isCurrent
                      ? "text-accent"
                      : "text-muted-foreground",
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
                  <span className="rounded border border-border/60 bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {formatDate(new Date(exhibition.startDate), locale)}
                    {exhibition.endDate &&
                      ` - ${formatDate(new Date(exhibition.endDate), locale)}`}
                  </span>
                  {exhibition.isLoan && exhibition.loanVenue && (
                    <span className="rounded border border-border/60 bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
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

function LoansTab({
  collectionId,
  locale,
}: {
  collectionId: string;
  locale: string;
}) {
  const loans = useQuery(api.loans.getLoansForCollection, {
    collectionId: collectionId as Id<"collections">,
  });

  return (
    <div className="space-y-6">
      <h3 className="flex items-center gap-2 text-xs font-medium text-foreground">
        <Send className="h-4 w-4 text-blue-500" />
        Loan History
      </h3>

      {loans === undefined ? (
        <p className="text-muted-foreground">Loading loans...</p>
      ) : loans.length > 0 ? (
        <div className="space-y-4">
          {loans.map((loan: LoanForCollection) => (
            <Link
              key={loan._id}
              href={`/loans/${loan._id}`}
              className="block rounded-xl border border-border/60 bg-secondary/20 p-4 transition-colors hover:border-accent/30 hover:bg-accent/5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-accent">
                      {loan.loanNumber}
                    </span>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
                        loan.type === "incoming"
                          ? "border border-green-500/20 bg-green-500/10 text-green-400"
                          : "border border-blue-500/20 bg-blue-500/10 text-blue-400",
                      )}
                    >
                      {loan.type}
                    </span>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
                        loan.status === "active"
                          ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                          : loan.status === "dispatched"
                            ? "border border-amber-500/20 bg-amber-500/10 text-amber-400"
                            : loan.status === "returned"
                              ? "border border-zinc-500/20 bg-zinc-500/10 text-zinc-400"
                              : "border border-zinc-500/20 bg-zinc-500/10 text-zinc-400",
                      )}
                    >
                      {loan.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-foreground">
                    {loan.lenderBorrowerName}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-xs text-muted-foreground">
                    {formatDate(new Date(loan.startDate), locale)}
                    {loan.endDate &&
                      ` - ${formatDate(new Date(loan.endDate), locale)}`}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-border">
          <p className="text-sm text-muted-foreground">
            No loan history for this object
          </p>
        </div>
      )}
    </div>
  );
}

function LogsTab({
  collectionId,
  organizationId,
  locale,
}: {
  collectionId: string;
  organizationId: Id<"organizations">;
  locale: string;
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
                <td
                  colSpan={3}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
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
                      {formatDate(new Date(log.timestamp), locale, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-center gap-2">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full border border-border/60 bg-secondary text-[9px] text-muted-foreground">
                        {log.userName?.charAt(0) || "?"}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {log.userName || "Unknown"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-accent">
                        {log.action}
                      </span>
                    </p>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
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
