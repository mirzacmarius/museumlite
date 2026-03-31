"use client";

import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@v1/ui/dropdown-menu";
import { ImageLightbox, type LightboxImage } from "@v1/ui/image-lightbox";
import { SidebarProvider } from "@v1/ui/sidebar";
import { cn } from "@v1/ui/utils";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  ArrowLeft,
  ArrowRightLeft,
  Calendar,
  Check,
  FileDown,
  Image as ImageIcon,
  Info,
  Link2,
  MapPin,
  Maximize2,
  Pencil,
  Printer,
  QrCode,
  Send,
  Share2,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const LoadingPanel = () => (
  <div className="h-32 w-full animate-pulse rounded-xl bg-card/40" />
);

const ArchiveDetailsTab = dynamic(
  () =>
    import("./_components/archive-details-tab").then(
      (mod) => mod.ArchiveDetailsTab,
    ),
  { loading: LoadingPanel },
);
const CommentsTab = dynamic(
  () => import("./_components/comments-tab").then((mod) => mod.CommentsTab),
  { loading: LoadingPanel },
);
const ConservationTab = dynamic(
  () =>
    import("./_components/conservation-tab").then((mod) => mod.ConservationTab),
  { loading: LoadingPanel },
);
const DigitalAssetsTab = dynamic(
  () =>
    import("./_components/digital-assets-tab").then(
      (mod) => mod.DigitalAssetsTab,
    ),
  { loading: LoadingPanel },
);
const ExhibitionsTab = dynamic(
  () =>
    import("./_components/exhibitions-tab").then((mod) => mod.ExhibitionsTab),
  { loading: LoadingPanel },
);
const FineArtDetailsTab = dynamic(
  () =>
    import("./_components/fine-art-details-tab").then(
      (mod) => mod.FineArtDetailsTab,
    ),
  { loading: LoadingPanel },
);
const GeneralTab = dynamic(
  () => import("./_components/general-tab").then((mod) => mod.GeneralTab),
  { loading: LoadingPanel },
);
const LoansTab = dynamic(
  () => import("./_components/loans-tab").then((mod) => mod.LoansTab),
  { loading: LoadingPanel },
);
const LogsTab = dynamic(
  () => import("./_components/logs-tab").then((mod) => mod.LogsTab),
  { loading: LoadingPanel },
);
const MediaTab = dynamic(
  () => import("./_components/media-tab").then((mod) => mod.MediaTab),
  { loading: LoadingPanel },
);
const NaturalHistoryDetailsTab = dynamic(
  () =>
    import("./_components/natural-history-details-tab").then(
      (mod) => mod.NaturalHistoryDetailsTab,
    ),
  { loading: LoadingPanel },
);
const PhysicalTab = dynamic(
  () => import("./_components/physical-tab").then((mod) => mod.PhysicalTab),
  { loading: LoadingPanel },
);
const PrintPreviewModal = dynamic(
  () =>
    import("./_components/print-preview-modal").then(
      (mod) => mod.PrintPreviewModal,
    ),
  { loading: LoadingPanel },
);
const ProvenanceTab = dynamic(
  () => import("./_components/provenance-tab").then((mod) => mod.ProvenanceTab),
  { loading: LoadingPanel },
);
const QRLabelModal = dynamic(
  () => import("./_components/qr-label-modal").then((mod) => mod.QRLabelModal),
  { loading: LoadingPanel },
);
const RecordContextSidebar = dynamic(
  () =>
    import("./_components/record-context-sidebar").then(
      (mod) => mod.RecordContextSidebar,
    ),
  { loading: LoadingPanel },
);
const VehicleDetailsTab = dynamic(
  () =>
    import("./_components/vehicle-details-tab").then(
      (mod) => mod.VehicleDetailsTab,
    ),
  { loading: LoadingPanel },
);
const WineDetailsTab = dynamic(
  () =>
    import("./_components/wine-details-tab").then((mod) => mod.WineDetailsTab),
  { loading: LoadingPanel },
);

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

type ObjectDetailClientProps = {
  collectionId: Id<"collections">;
  collection: FunctionReturnType<typeof api.collections.get> | null;
  collectionGroup: FunctionReturnType<typeof api.collectionGroups.get> | null;
  locationPath: FunctionReturnType<typeof api.locations.getLocationPath> | null;
  media: FunctionReturnType<typeof api.media.list> | null;
};

export function ObjectDetailClient({
  collectionId,
  collection,
  collectionGroup,
  locationPath,
  media,
}: ObjectDetailClientProps) {
  const t = useScopedI18n("objects");
  const common = useScopedI18n("common");
  const locale = useCurrentLocale();
  const { currentOrganizationId } = useOrganization();
  const { hasFeature } = useFeatureAccess();
  const [activeTab, setActiveTab] = useState<TabId>("general");
  const featureOrganizationId =
    collection?.organizationId ?? currentOrganizationId ?? undefined;
  const hasConservationFeature = featureOrganizationId
    ? hasFeature("conservation", featureOrganizationId)
    : false;
  const hasExhibitionsFeature = featureOrganizationId
    ? hasFeature("exhibitions", featureOrganizationId)
    : false;
  const hasLoansFeature = featureOrganizationId
    ? hasFeature("loans", featureOrganizationId)
    : false;
  const pendingMoveRequest = useQuery(api.objectMoves.getPendingForCollection, {
    collectionId,
  });

  const tabs = useMemo(() => {
    const allTabs = (() => {
      const collectionType = collection?.collectionType;
      if (!collectionType || collectionType === "general") {
        return baseTabs;
      }
      const moduleTab = moduleTabMap[collectionType];
      if (!moduleTab) {
        return baseTabs;
      }
      return [...baseTabs.slice(0, 1), moduleTab, ...baseTabs.slice(1)];
    })();

    return allTabs.filter((tab) => {
      if (tab.id === "conservation") {
        return hasConservationFeature;
      }
      if (tab.id === "exhibitions") {
        return hasExhibitionsFeature;
      }
      if (tab.id === "loans") {
        return hasLoansFeature;
      }
      return true;
    });
  }, [
    collection?.collectionType,
    hasConservationFeature,
    hasExhibitionsFeature,
    hasLoansFeature,
  ]);

  useEffect(() => {
    if (!tabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(tabs[0]?.id ?? "general");
    }
  }, [activeTab, tabs]);

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
  const [isQrLabelModalOpen, setIsQrLabelModalOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState("");

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };
  useEffect(() => {
    setQrCodeUrl(
      typeof window === "undefined"
        ? ""
        : new URL(
            `/objects/${collectionId}`,
            window.location.origin,
          ).toString(),
    );
  }, [collectionId]);
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

  if (!collection) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <p className="text-muted-foreground">{t("objectNotFound")}</p>
      </div>
    );
  }

  const locationString =
    locationPath?.map((loc) => loc.name).join(", ") || null;
  const organizationId = currentOrganizationId as Id<"organizations">;
  const heroImageForPrint = heroImage?.url
    ? { url: heroImage.url, thumbnailUrl: heroImage.thumbnailUrl }
    : null;

  return (
    <>
      <SidebarProvider
        style={{ "--sidebar-width": "20rem" } as React.CSSProperties}
        className="flex h-full min-h-0 w-full print:hidden"
      >
        {/* Main Content */}
        <main className="z-10 flex min-h-0 min-w-0 flex-1 flex-col bg-background">
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
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                title={t("detail.printLabel")}
                onClick={() => setIsQrLabelModalOpen(true)}
              >
                <QrCode className="h-4 w-4" />
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
                  {pendingMoveRequest && (
                    <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm font-medium text-blue-100">
                            <ArrowRightLeft className="h-4 w-4" />
                            Pending organization transfer
                          </div>
                          <p className="text-sm text-blue-200/80">
                            This object is awaiting approval to move to{" "}
                            {pendingMoveRequest.targetOrganizationName}.
                          </p>
                        </div>
                        <Button variant="outline" size="sm" asChild>
                          <Link
                            href={`/objects/move-requests/${pendingMoveRequest._id}`}
                          >
                            View request
                          </Link>
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Status, Accession & Alternates Row */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Display Status Badge */}
                    <div
                      className={cn(
                        "rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider",
                        collection.status === "active"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {collection.status}
                    </div>

                    {/* Accession Number */}
                    <div className="rounded bg-secondary/60 px-2 py-1 text-[10px] font-mono text-muted-foreground">
                      {collection.accessionNumber}
                    </div>
                  </div>

                  <h1 className="text-2xl font-semibold tracking-tight">
                    {collection.title}
                  </h1>

                  {collection.description && (
                    <p className="text-sm text-muted-foreground">
                      {collection.description}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>{collection.dateCreated || common("unknown")}</span>
                    </div>
                    {locationString && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        <span>{locationString}</span>
                      </div>
                    )}
                    {collection.creator && (
                      <div className="flex items-center gap-2">
                        <Info className="h-4 w-4" />
                        <span>{collection.creator}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs + Content */}
            <div className="mx-auto flex max-w-6xl gap-6 px-6 py-8">
              <div className="w-full">
                <div className="mb-6 flex flex-wrap items-center gap-2">
                  {tabs.map((tab) => (
                    <Button
                      key={tab.id}
                      variant={activeTab === tab.id ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setActiveTab(tab.id)}
                    >
                      {tab.label}
                    </Button>
                  ))}
                </div>

                {activeTab === "general" && (
                  <GeneralTab collection={collection} />
                )}
                {activeTab === "provenance" && (
                  <ProvenanceTab collection={collection} />
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
                {activeTab === "conservation" && (
                  <ConservationTab
                    collectionId={collectionId}
                    locale={locale}
                    hasAccess={hasConservationFeature}
                  />
                )}
                {activeTab === "exhibitions" && (
                  <ExhibitionsTab
                    collectionId={collectionId}
                    locale={locale}
                    hasAccess={hasExhibitionsFeature}
                  />
                )}
                {activeTab === "loans" && (
                  <LoansTab
                    collectionId={collectionId}
                    locale={locale}
                    hasAccess={hasLoansFeature}
                  />
                )}
                {activeTab === "comments" && (
                  <CommentsTab
                    collectionId={collectionId}
                    organizationId={organizationId}
                  />
                )}
                {activeTab === "logs" && (
                  <LogsTab
                    collectionId={collectionId}
                    organizationId={organizationId}
                    locale={locale}
                  />
                )}
                {activeTab === "fine_art" && (
                  <FineArtDetailsTab
                    collectionId={collectionId}
                    organizationId={organizationId}
                  />
                )}
                {activeTab === "wine" && (
                  <WineDetailsTab
                    collectionId={collectionId}
                    organizationId={organizationId}
                  />
                )}
                {activeTab === "automotive" && (
                  <VehicleDetailsTab
                    collectionId={collectionId}
                    organizationId={organizationId}
                  />
                )}
                {activeTab === "natural_history" && (
                  <NaturalHistoryDetailsTab
                    collectionId={collectionId}
                    organizationId={organizationId}
                  />
                )}
                {activeTab === "archive" && (
                  <ArchiveDetailsTab
                    collectionId={collectionId}
                    organizationId={organizationId}
                  />
                )}
              </div>

              <aside className="hidden w-80 flex-shrink-0 xl:block">
                <RecordContextSidebar
                  collectionId={collectionId}
                  organizationId={organizationId}
                  tags={collection.tags}
                  heroImageUrl={heroImage?.url}
                  condition={collection.condition}
                  provenance={collection.provenance}
                  ownershipHistory={collection.ownershipHistory}
                  verified={collection.verified}
                  verifiedByName={collection.verifiedByName}
                />
              </aside>
            </div>
          </div>
        </main>
      </SidebarProvider>

      <PrintPreviewModal
        collection={collection}
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        heroImage={heroImageForPrint}
        locationPath={locationPath ?? undefined}
        locale={locale}
      />
      <QRLabelModal
        collection={collection}
        isOpen={isQrLabelModalOpen}
        onClose={() => setIsQrLabelModalOpen(false)}
        qrCodeUrl={qrCodeUrl}
      />
    </>
  );
}
