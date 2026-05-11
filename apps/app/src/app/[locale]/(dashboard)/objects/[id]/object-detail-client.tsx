"use client";

import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { writeTextToClipboard } from "@/lib/clipboard";
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
import { cn } from "@v1/ui/utils";
import { type Preloaded, usePreloadedQuery, useQuery } from "convex/react";
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
import {
  type ObjectTabId as TabId,
  getObjectViewTabs,
} from "./_components/object-tab-config";
import type { ObjectDetailData } from "./_components/types";

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
const AccessionTab = dynamic(
  () => import("./_components/accession-tab").then((mod) => mod.AccessionTab),
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
const PlacementRelationshipsTab = dynamic(
  () =>
    import("./_components/placement-relationships-tab").then(
      (mod) => mod.PlacementRelationshipsTab,
    ),
  { loading: LoadingPanel },
);
const PrintPreviewModal = dynamic(
  () =>
    import("./_components/print-preview-modal").then(
      (mod) => mod.PrintPreviewModal,
    ),
  { loading: LoadingPanel },
);
const ProvenanceHistoryTab = dynamic(
  () =>
    import("./_components/provenance-history-tab").then(
      (mod) => mod.ProvenanceHistoryTab,
    ),
  { loading: LoadingPanel },
);
const QRLabelModal = dynamic(
  () => import("./_components/qr-label-modal").then((mod) => mod.QRLabelModal),
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

type ObjectDetailClientProps = {
  collectionId: Id<"collections">;
} & (
  | {
      preloadedObjectDetail: Preloaded<typeof api.collections.getObjectDetail>;
      initialObjectDetail?: never;
    }
  | {
      preloadedObjectDetail?: never;
      initialObjectDetail: ObjectDetailData | null;
    }
);

export function ObjectDetailClient(props: ObjectDetailClientProps) {
  if (props.preloadedObjectDetail) {
    return (
      <PreloadedObjectDetailClient
        collectionId={props.collectionId}
        preloadedObjectDetail={props.preloadedObjectDetail}
      />
    );
  }

  return (
    <ObjectDetailView
      collectionId={props.collectionId}
      objectDetail={props.initialObjectDetail}
    />
  );
}

function PreloadedObjectDetailClient({
  collectionId,
  preloadedObjectDetail,
}: {
  collectionId: Id<"collections">;
  preloadedObjectDetail: Preloaded<typeof api.collections.getObjectDetail>;
}) {
  const objectDetail = usePreloadedQuery(preloadedObjectDetail);
  return (
    <ObjectDetailView collectionId={collectionId} objectDetail={objectDetail} />
  );
}

function ObjectDetailView({
  collectionId,
  objectDetail,
}: {
  collectionId: Id<"collections">;
  objectDetail: ObjectDetailData | null;
}) {
  const t = useScopedI18n("objects");
  const common = useScopedI18n("common");
  const locale = useCurrentLocale();
  const { currentOrganization, currentOrganizationId } = useOrganization();
  const { hasFeature } = useFeatureAccess();
  const collection = objectDetail?.collection ?? null;
  const collectionGroup = objectDetail?.collectionGroup ?? null;
  const locationPath = objectDetail?.locationPath ?? [];
  const heroImage = objectDetail?.heroImage ?? null;
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
  const isLocationTrackingEnabled =
    currentOrganization?.settings?.locationTrackingEnabled ?? true;
  const pendingMoveRequest = useQuery(
    api.objectMoves.getPendingForCollection,
    collection ? { collectionId } : "skip",
  );

  const tabs = useMemo(() => {
    return getObjectViewTabs({
      collectionType: collection?.collectionType,
      locationTrackingEnabled: isLocationTrackingEnabled,
      features: {
        conservation: hasConservationFeature,
        exhibitions: hasExhibitionsFeature,
        loans: hasLoansFeature,
      },
    });
  }, [
    collection?.collectionType,
    hasConservationFeature,
    hasExhibitionsFeature,
    hasLoansFeature,
    isLocationTrackingEnabled,
  ]);

  useEffect(() => {
    if (!tabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(tabs[0]?.id ?? "general");
    }
  }, [activeTab, tabs]);

  // Hero lightbox state
  const [isHeroLightboxOpen, setIsHeroLightboxOpen] = useState(false);

  // Print modal state
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isQrLabelModalOpen, setIsQrLabelModalOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState("");

  const handleCopyLink = async () => {
    const didCopy = await writeTextToClipboard(window.location.href);
    if (!didCopy) {
      return;
    }

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
    if (!heroImage?.url || heroImage.fileType !== "image") return [];
    return [
      {
        id: heroImage._id,
        url: heroImage.url,
        thumbnailUrl: heroImage.thumbnailUrl || undefined,
        title: heroImage.fileName,
        caption: heroImage.caption || undefined,
      },
    ];
  }, [heroImage]);

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

  const locationString = isLocationTrackingEnabled
    ? locationPath?.map((loc) => loc.name).join(", ") || null
    : null;
  const organizationId = currentOrganizationId as Id<"organizations">;
  const heroImageForPrint = heroImage?.url
    ? { url: heroImage.url, thumbnailUrl: heroImage.thumbnailUrl }
    : null;
  const isOnDisplay = collection.displayStatus === "on_display";

  return (
    <>
      <main className="z-10 flex h-full min-h-0 min-w-0 w-full flex-1 flex-col bg-background print:hidden">
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
                initialIndex={0}
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
                          {pendingMoveRequest.status === "awaiting_acceptance"
                            ? "Awaiting transfer acceptance"
                            : "Pending transfer approval"}
                        </div>
                        <p className="text-sm text-blue-200/80">
                          This object is{" "}
                          {pendingMoveRequest.status === "awaiting_acceptance"
                            ? "awaiting acceptance"
                            : "awaiting approval"}{" "}
                          to move to {pendingMoveRequest.targetOrganizationName}
                          .
                        </p>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <Link
                          href={`/objects/move-requests/${pendingMoveRequest._id}`}
                        >
                          Open transfer request
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

                  {isOnDisplay ? (
                    <div className="rounded bg-emerald-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                      {t("detail.onDisplay")}
                    </div>
                  ) : null}

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
                    <div
                      className={cn(
                        "flex items-center gap-2",
                        isOnDisplay
                          ? "text-emerald-400"
                          : "text-muted-foreground",
                      )}
                    >
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
          <div className="mx-auto w-full max-w-6xl px-6 py-8">
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
                <GeneralTab
                  collection={collection}
                  collectionGroupName={collectionGroup?.name}
                />
              )}
              {activeTab === "physical" && (
                <PhysicalTab collection={collection} />
              )}
              {activeTab === "media" && (
                <MediaTab collectionId={collectionId} collection={collection} />
              )}
              {activeTab === "accession" && (
                <AccessionTab collection={collection} />
              )}
              {activeTab === "provenance" && (
                <ProvenanceHistoryTab collection={collection} />
              )}
              {activeTab === "placement" && (
                <PlacementRelationshipsTab
                  collection={collection}
                  collectionId={collectionId}
                  locationPath={locationPath ?? []}
                />
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
          </div>
        </div>
      </main>

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
