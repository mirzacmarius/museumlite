"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import type { LightboxImage } from "@v1/ui/image-lightbox";
import { type Preloaded, usePreloadedQuery, useQuery } from "convex/react";
import dynamic from "next/dynamic";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect, useMemo, useReducer } from "react";
import { useOrganization } from "@/components/organization-provider";
import { usePermissions } from "@/components/permission-gate";
import { RecordRecoveryState } from "@/components/record-recovery-state";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { useRecordViewState } from "@/hooks/use-return-path";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { ObjectDetailHeader } from "./_components/object-detail/object-detail-header";
import { ObjectDetailHero } from "./_components/object-detail/object-detail-hero";
import { ObjectDetailTabPanel } from "./_components/object-detail/object-detail-tab-panel";
import { ObjectEntryNotice } from "./_components/object-entry-notice";
import {
  getObjectViewTabs,
  OBJECT_TAB_IDS,
  type ObjectTabId as TabId,
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
const ObjectLabelModal = dynamic(
  () =>
    import("./_components/object-label-modal").then(
      (mod) => mod.ObjectLabelModal,
    ),
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
  isHeroLightboxOpen: boolean;
  isPrintModalOpen: boolean;
  isObjectLabelModalOpen: boolean;
  isQrLabelModalOpen: boolean;
  linkCopied: boolean;
  qrCodeUrl: string;
}

type ObjectDetailViewAction =
  | { type: "setHeroLightboxOpen"; value: boolean }
  | { type: "setPrintModalOpen"; value: boolean }
  | { type: "setObjectLabelModalOpen"; value: boolean }
  | { type: "setQrLabelModalOpen"; value: boolean }
  | { type: "setLinkCopied"; value: boolean }
  | { type: "setQrCodeUrl"; value: string };

const initialObjectDetailViewState: ObjectDetailViewState = {
  isHeroLightboxOpen: false,
  isPrintModalOpen: false,
  isObjectLabelModalOpen: false,
  isQrLabelModalOpen: false,
  linkCopied: false,
  qrCodeUrl: "",
};

function objectDetailViewReducer(
  state: ObjectDetailViewState,
  action: ObjectDetailViewAction,
): ObjectDetailViewState {
  switch (action.type) {
    case "setHeroLightboxOpen":
      return { ...state, isHeroLightboxOpen: action.value };
    case "setPrintModalOpen":
      return { ...state, isPrintModalOpen: action.value };
    case "setObjectLabelModalOpen":
      return { ...state, isObjectLabelModalOpen: action.value };
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
  const { permissions } = usePermissions();
  const collection = objectDetail?.collection ?? null;
  const collectionGroup = objectDetail?.collectionGroup ?? null;
  const locationPath = objectDetail?.locationPath ?? [];
  const heroImage = objectDetail?.heroImage ?? null;
  // The open tab lives in the URL (`?tab=`), so a reload, a shared link or
  // Back from another page returns to it.
  const [requestedTab, setRequestedTab] = useQueryState(
    "tab",
    parseAsStringLiteral(OBJECT_TAB_IDS).withOptions({
      history: "replace",
      scroll: false,
    }),
  );
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
  const objectMedia = useQuery(
    api.media.list,
    collection ? { collectionId } : "skip",
  );
  const viewState = useRecordViewState(collection);

  const tabs = useMemo(() => {
    return getObjectViewTabs({
      collectionType: collection?.collectionType,
      enabledModules,
      locationTrackingEnabled: isLocationTrackingEnabled,
      permissions,
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
    permissions,
  ]);

  const defaultTab = tabs[0]?.id ?? "general";
  const activeTab: TabId =
    requestedTab && tabs.some((tab) => tab.id === requestedTab)
      ? requestedTab
      : defaultTab;

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
    return (objectMedia ?? []).flatMap((image) =>
      image.url && image.fileType === "image"
        ? [
            {
              id: image._id,
              url: image.url,
              thumbnailUrl: image.thumbnailUrl || undefined,
              title: image.fileName,
              caption: image.caption || undefined,
            },
          ]
        : [],
    );
  }, [objectMedia]);

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
      <RecordRecoveryState
        kind={viewState === "removed" ? "removed" : "missing"}
        list="objects"
      />
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
  const isWithdrawn =
    collection.status === "archived" || collection.status === "deleted";
  const withdrawalReason =
    collection.archivedReason ?? collection.deletedReason;

  return (
    <>
      <main className="z-10 flex h-full min-h-0 min-w-0 w-full flex-1 flex-col bg-background print:hidden">
        <ObjectDetailHeader
          collection={collection}
          collectionGroupName={collectionGroup?.name}
          collectionId={collectionId}
          editTab={activeTab === defaultTab ? undefined : activeTab}
          linkCopied={state.linkCopied}
          onLinkCopiedChange={(value) =>
            dispatch({ type: "setLinkCopied", value })
          }
          onPrintClick={() =>
            dispatch({ type: "setPrintModalOpen", value: true })
          }
          onObjectLabelClick={() =>
            dispatch({ type: "setObjectLabelModalOpen", value: true })
          }
          onQrLabelClick={() =>
            dispatch({ type: "setQrLabelModalOpen", value: true })
          }
          collectionsLabel={t("detail.collections")}
          copyLinkLabel={t("detail.copyObjectLink")}
          linkCopiedLabel={t("detail.linkCopied")}
          printRecordLabel={t("detail.printRecord")}
          printLabel={t("detail.printLabel")}
          printObjectLabel={t("detail.printObjectLabel")}
          editObjectLabel={t("detail.editObject")}
        />

        <div className="flex-1 overflow-y-auto">
          <ObjectEntryNotice collectionId={collectionId} />
          {isWithdrawn ? (
            <section
              aria-label={t("withdrawal.noticeLabel")}
              className="border-b border-amber-500/20 bg-amber-500/5 px-6 py-4"
            >
              <h2 className="text-sm font-semibold text-foreground">
                {t("withdrawal.noticeTitle")}
              </h2>
              {withdrawalReason ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("withdrawal.reason", { reason: withdrawalReason })}
                </p>
              ) : (
                <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                  {t("withdrawal.legacyReasonMissing")}
                </p>
              )}
            </section>
          ) : null}

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
            activeTab={activeTab}
            onActiveTabChange={(value) =>
              void setRequestedTab(value === defaultTab ? null : value)
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
      <ObjectLabelModal
        collection={collection}
        isOpen={state.isObjectLabelModalOpen}
        qrCodeUrl={state.qrCodeUrl}
        onClose={() =>
          dispatch({ type: "setObjectLabelModalOpen", value: false })
        }
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
