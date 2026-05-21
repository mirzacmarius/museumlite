"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import dynamic from "next/dynamic";
import type { ObjectTabDefinition } from "../object-tab-config";
import type { ObjectTabId as TabId } from "../object-tab-config";
import type { ObjectDetailData } from "../types";

const LoadingPanel = () => (
  <div className="h-32 w-full animate-pulse rounded-xl bg-card/40" />
);

const ArchiveDetailsTab = dynamic(
  () => import("../archive-details-tab").then((mod) => mod.ArchiveDetailsTab),
  { loading: LoadingPanel },
);
const AccessionTab = dynamic(
  () => import("../accession-tab").then((mod) => mod.AccessionTab),
  { loading: LoadingPanel },
);
const CommentsTab = dynamic(
  () => import("../comments-tab").then((mod) => mod.CommentsTab),
  { loading: LoadingPanel },
);
const CoinsStampsDetailsTab = dynamic(
  () =>
    import("../coins-stamps-details-tab").then(
      (mod) => mod.CoinsStampsDetailsTab,
    ),
  { loading: LoadingPanel },
);
const ConservationTab = dynamic(
  () => import("../conservation-tab").then((mod) => mod.ConservationTab),
  { loading: LoadingPanel },
);
const ExhibitionsTab = dynamic(
  () => import("../exhibitions-tab").then((mod) => mod.ExhibitionsTab),
  { loading: LoadingPanel },
);
const FineArtDetailsTab = dynamic(
  () => import("../fine-art-details-tab").then((mod) => mod.FineArtDetailsTab),
  { loading: LoadingPanel },
);
const GeneralTab = dynamic(
  () => import("../general-tab").then((mod) => mod.GeneralTab),
  { loading: LoadingPanel },
);
const LoansTab = dynamic(
  () => import("../loans-tab").then((mod) => mod.LoansTab),
  { loading: LoadingPanel },
);
const LogsTab = dynamic(
  () => import("../logs-tab").then((mod) => mod.LogsTab),
  { loading: LoadingPanel },
);
const MediaTab = dynamic(
  () => import("../media-tab").then((mod) => mod.MediaTab),
  { loading: LoadingPanel },
);
const NaturalHistoryDetailsTab = dynamic(
  () =>
    import("../natural-history-details-tab").then(
      (mod) => mod.NaturalHistoryDetailsTab,
    ),
  { loading: LoadingPanel },
);
const PhysicalTab = dynamic(
  () => import("../physical-tab").then((mod) => mod.PhysicalTab),
  { loading: LoadingPanel },
);
const PlacementRelationshipsTab = dynamic(
  () =>
    import("../placement-relationships-tab").then(
      (mod) => mod.PlacementRelationshipsTab,
    ),
  { loading: LoadingPanel },
);
const ProvenanceHistoryTab = dynamic(
  () =>
    import("../provenance-history-tab").then((mod) => mod.ProvenanceHistoryTab),
  { loading: LoadingPanel },
);
const VehicleDetailsTab = dynamic(
  () => import("../vehicle-details-tab").then((mod) => mod.VehicleDetailsTab),
  { loading: LoadingPanel },
);
const WineDetailsTab = dynamic(
  () => import("../wine-details-tab").then((mod) => mod.WineDetailsTab),
  { loading: LoadingPanel },
);

interface ObjectDetailTabPanelProps {
  tabs: ObjectTabDefinition[];
  activeTab: TabId;
  onActiveTabChange: (tab: TabId) => void;
  collection: NonNullable<ObjectDetailData["collection"]>;
  collectionId: Id<"collections">;
  collectionGroupName?: string;
  locationPath: ObjectDetailData["locationPath"];
  locale: string;
  organizationId: Id<"organizations">;
  hasConservationFeature: boolean;
  hasExhibitionsFeature: boolean;
  hasLoansFeature: boolean;
}

export function ObjectDetailTabPanel({
  tabs,
  activeTab,
  onActiveTabChange,
  collection,
  collectionId,
  collectionGroupName,
  locationPath,
  locale,
  organizationId,
  hasConservationFeature,
  hasExhibitionsFeature,
  hasLoansFeature,
}: ObjectDetailTabPanelProps) {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="w-full">
        <div className="mb-6 flex flex-wrap items-center gap-x-1 gap-y-2">
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? "default" : "ghost"}
              size="sm"
              className="px-2"
              onClick={() => onActiveTabChange(tab.id)}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        {activeTab === "general" && (
          <GeneralTab
            collection={collection}
            collectionGroupName={collectionGroupName}
          />
        )}
        {activeTab === "physical" && <PhysicalTab collection={collection} />}
        {activeTab === "media" && (
          <MediaTab collectionId={collectionId} collection={collection} />
        )}
        {activeTab === "accession" && <AccessionTab collection={collection} />}
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
        {activeTab === "coins_stamps" && (
          <CoinsStampsDetailsTab
            collectionId={collectionId}
            organizationId={organizationId}
          />
        )}
      </div>
    </div>
  );
}
