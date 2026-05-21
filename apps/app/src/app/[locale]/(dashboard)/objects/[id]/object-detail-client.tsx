"use client";

import { useOrganization } from "@/components/organization-provider";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import type { LightboxImage } from "@v1/ui/image-lightbox";
import { type Preloaded, usePreloadedQuery, useQuery } from "convex/react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useReducer } from "react";
import { ObjectDetailHeader } from "./_components/object-detail/object-detail-header";
import { ObjectDetailHero } from "./_components/object-detail/object-detail-hero";
import { ObjectDetailTabPanel } from "./_components/object-detail/object-detail-tab-panel";
import {
  type ObjectTabId as TabId,
  getObjectViewTabs,
} from "./_components/object-tab-config";
import type { ObjectDetailData } from "./_components/types";

const PrintPreviewModal = dynamic(
  () =>
    import("./_components/print-preview-modal").then(
      (mod) => mod.PrintPreviewModal,
    ),
  { ssr: false },
);
const QRLabelModal = dynamic(
  () => import("./_components/qr-label-modal").then((mod) => mod.QRLabelModal),
  { ssr: false },
);

interface ObjectDetailClientProps {
  collectionId: Id<"collections">;
  preloadedObjectDetail?: Preloaded<typeof api.collections.getObjectDetail>;
  initialObjectDetail?: ObjectDetailData | null;
}

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
      objectDetail={props.initialObjectDetail ?? null}
    />
  );
}

interface ObjectDetailViewState {
  activeTab: TabId;
  isHeroLightboxOpen: boolean;
  isPrintModalOpen: boolean;
  isQrLabelModalOpen: boolean;
  linkCopied: boolean;
  qrCodeUrl: string;
}

type ObjectDetailViewAction =
  | { type: "setActiveTab"; value: TabId }
  | { type: "setHeroLightboxOpen"; value: boolean }
  | { type: "setPrintModalOpen"; value: boolean }
  | { type: "setQrLabelModalOpen"; value: boolean }
  | { type: "setLinkCopied"; value: boolean }
  | { type: "setQrCodeUrl"; value: string };

const initialObjectDetailViewState: ObjectDetailViewState = {
  activeTab: "general",
  isHeroLightboxOpen: false,
  isPrintModalOpen: false,
  isQrLabelModalOpen: false,
  linkCopied: false,
  qrCodeUrl: "",
};

function objectDetailViewReducer(
  state: ObjectDetailViewState,
  action: ObjectDetailViewAction,
): ObjectDetailViewState {
  switch (action.type) {
    case "setActiveTab":
      return { ...state, activeTab: action.value };
    case "setHeroLightboxOpen":
      return { ...state, isHeroLightboxOpen: action.value };
    case "setPrintModalOpen":
      return { ...state, isPrintModalOpen: action.value };
    case "setQrLabelModalOpen":
      return { ...state, isQrLabelModalOpen: action.value };
    case "setLinkCopied":
      return { ...state, linkCopied: action.value };
    case "setQrCodeUrl":
      return { ...state, qrCodeUrl: action.value };
  }
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
  const { enabledModules, hasFeature } = useFeatureAccess();
  const collection = objectDetail?.collection ?? null;
  const collectionGroup = objectDetail?.collectionGroup ?? null;
  const locationPath = objectDetail?.locationPath ?? [];
  const heroImage = objectDetail?.heroImage ?? null;
  const [state, dispatch] = useReducer(
    objectDetailViewReducer,
    initialObjectDetailViewState,
  );
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
      enabledModules,
      locationTrackingEnabled: isLocationTrackingEnabled,
      features: {
        conservation: hasConservationFeature,
        exhibitions: hasExhibitionsFeature,
        loans: hasLoansFeature,
      },
    });
  }, [
    collection?.collectionType,
    enabledModules,
    hasConservationFeature,
    hasExhibitionsFeature,
    hasLoansFeature,
    isLocationTrackingEnabled,
  ]);

  useEffect(() => {
    if (!tabs.some((tab) => tab.id === state.activeTab)) {
      dispatch({
        type: "setActiveTab",
        value: tabs[0]?.id ?? "general",
      });
    }
  }, [state.activeTab, tabs]);

  useEffect(() => {
    dispatch({
      type: "setQrCodeUrl",
      value:
        typeof window === "undefined"
          ? ""
          : new URL(
              `/objects/${collectionId}`,
              window.location.origin,
            ).toString(),
    });
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
      <div className="flex size-full items-center justify-center bg-background">
        <p className="text-muted-foreground">
          {t("detail.selectOrganization")}
        </p>
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="flex size-full items-center justify-center bg-background">
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
        <ObjectDetailHeader
          collection={collection}
          collectionGroupName={collectionGroup?.name}
          collectionId={collectionId}
          linkCopied={state.linkCopied}
          onLinkCopiedChange={(value) =>
            dispatch({ type: "setLinkCopied", value })
          }
          onPrintClick={() => dispatch({ type: "setPrintModalOpen", value: true })}
          onQrLabelClick={() =>
            dispatch({ type: "setQrLabelModalOpen", value: true })
          }
          collectionsLabel={t("detail.collections")}
          copyLinkLabel={t("detail.copyObjectLink")}
          linkCopiedLabel={t("detail.linkCopied")}
          exportPdfLabel={t("detail.exportToPdf")}
          requestLoanLabel={t("detail.requestLoan")}
          printLabel={t("detail.printLabel")}
          editObjectLabel={t("detail.editObject")}
          shareTitle={common("share")}
        />

        <div className="flex-1 overflow-y-auto">
          <ObjectDetailHero
            collection={collection}
            heroImage={heroImage}
            heroLightboxImages={heroLightboxImages}
            isHeroLightboxOpen={state.isHeroLightboxOpen}
            onHeroLightboxOpenChange={(value) =>
              dispatch({ type: "setHeroLightboxOpen", value })
            }
            pendingMoveRequest={pendingMoveRequest ?? null}
            locationString={locationString}
            isOnDisplay={isOnDisplay}
            viewFullSizeLabel={t("detail.viewFullSize")}
            onDisplayLabel={t("detail.onDisplay")}
            unknownLabel={common("unknown")}
          />

          <ObjectDetailTabPanel
            tabs={tabs}
            activeTab={state.activeTab}
            onActiveTabChange={(value) =>
              dispatch({ type: "setActiveTab", value })
            }
            collection={collection}
            collectionId={collectionId}
            collectionGroupName={collectionGroup?.name}
            locationPath={locationPath}
            locale={locale}
            organizationId={organizationId}
            hasConservationFeature={hasConservationFeature}
            hasExhibitionsFeature={hasExhibitionsFeature}
            hasLoansFeature={hasLoansFeature}
          />
        </div>
      </main>

      <PrintPreviewModal
        collection={collection}
        isOpen={state.isPrintModalOpen}
        onClose={() => dispatch({ type: "setPrintModalOpen", value: false })}
        heroImage={heroImageForPrint}
        locationPath={locationPath ?? undefined}
        locale={locale}
      />
      <QRLabelModal
        collection={collection}
        isOpen={state.isQrLabelModalOpen}
        onClose={() => dispatch({ type: "setQrLabelModalOpen", value: false })}
        qrCodeUrl={state.qrCodeUrl}
      />
    </>
  );
}
