"use client";

import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
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
import {
  ArrowLeft,
  Box,
  Calendar,
  Check,
  Copy,
  FileDown,
  Image as ImageIcon,
  Info,
  Link2,
  MapPin,
  Maximize2,
  Pencil,
  Printer,
  Send,
  Share2,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArchiveDetailsTab,
  CommentsTab,
  ConservationTab,
  DigitalAssetsTab,
  ExhibitionsTab,
  FineArtDetailsTab,
  GeneralTab,
  LoansTab,
  LogsTab,
  MediaTab,
  NaturalHistoryDetailsTab,
  PhysicalTab,
  PrintPreviewModal,
  ProvenanceTab,
  RecordContextSidebar,
  VehicleDetailsTab,
  WineDetailsTab,
} from "./_components";

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
  | "comments"
  | "fine_art"
  | "wine"
  | "automotive"
  | "natural_history"
  | "archive";

const baseTabs: { id: TabId; label: string }[] = [
  { id: "general", label: "General" },
  { id: "provenance", label: "Provenance" },
  { id: "physical", label: "Physical Description" },
  { id: "media", label: "Media" },
  { id: "digital", label: "Digital Assets" },
  { id: "conservation", label: "Conservation" },
  { id: "exhibitions", label: "Exhibitions" },
  { id: "loans", label: "Loans" },
  { id: "comments", label: "Comments" },
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
              {activeTab === "comments" && currentOrganizationId && (
                <CommentsTab
                  collectionId={collectionId as Id<"collections">}
                  organizationId={currentOrganizationId}
                />
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
          verified={collection.verified}
          verifiedByName={collection.verifiedByName}
        />
      </SidebarProvider>

      <PrintPreviewModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        collection={collection}
        heroImage={
          heroImage
            ? {
                url: heroImage.url as string,
                thumbnailUrl: heroImage.thumbnailUrl,
              }
            : null
        }
        locationPath={locationPath}
        locale={locale}
      />
    </>
  );
}
