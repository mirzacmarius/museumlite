"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { cn } from "@v1/ui/utils";
import dynamic from "next/dynamic";
import type { KeyboardEvent } from "react";
import { useI18n } from "@/locales/client";
import type {
  ObjectTabDefinition,
  ObjectTabId as TabId,
} from "../object-tab-config";
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
const ConditionTab = dynamic(
  () => import("../condition-tab").then((mod) => mod.ConditionTab),
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
const ValuationTab = dynamic(
  () => import("../valuation-tab").then((mod) => mod.ValuationTab),
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
  const tRoot = useI18n();
  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const step =
      event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    const index = tabs.findIndex((tab) => tab.id === activeTab);
    const next =
      event.key === "Home"
        ? tabs[0]
        : event.key === "End"
          ? tabs.at(-1)
          : step
            ? tabs[(index + step + tabs.length) % tabs.length]
            : undefined;
    if (!next) return;
    event.preventDefault();
    onActiveTabChange(next.id);
    const nextTab = document.getElementById(`object-tab-${next.id}`);
    nextTab?.focus();
    nextTab?.scrollIntoView({ block: "nearest", inline: "nearest" });
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-10 sm:px-6">
      <div className="sticky top-0 z-20 -mx-4 mb-6 border-b border-border/60 bg-background/90 px-4 backdrop-blur-xl sm:-mx-6 sm:px-6">
        <div
          role="tablist"
          aria-label={collection.title}
          className="-mb-px flex gap-1 overflow-x-auto [scrollbar-width:none] max-sm:[mask-image:linear-gradient(to_right,black_85%,transparent)] [&::-webkit-scrollbar]:hidden"
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`object-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls="object-tab-panel"
                tabIndex={isActive ? 0 : -1}
                onClick={(event) => {
                  event.currentTarget.scrollIntoView({
                    block: "nearest",
                    inline: "nearest",
                  });
                  onActiveTabChange(tab.id);
                }}
                onKeyDown={handleTabKeyDown}
                className={cn(
                  "shrink-0 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                  isActive
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                )}
              >
                {tRoot(tab.label)}
              </button>
            );
          })}
        </div>
      </div>

      <div
        id="object-tab-panel"
        role="tabpanel"
        aria-labelledby={`object-tab-${activeTab}`}
        className="w-full"
      >
        {activeTab === "general" && (
          <GeneralTab
            collection={collection}
            collectionGroupName={collectionGroupName}
          />
        )}
        {activeTab === "physical" && (
          <PhysicalTab
            collection={collection}
            onOpenConditionTab={
              tabs.some((tab) => tab.id === "condition")
                ? () => onActiveTabChange("condition")
                : undefined
            }
          />
        )}
        {activeTab === "condition" && (
          <ConditionTab
            collectionId={collectionId}
            organizationId={organizationId}
          />
        )}
        {activeTab === "media" && (
          <MediaTab collectionId={collectionId} collection={collection} />
        )}
        {activeTab === "accession" && <AccessionTab collection={collection} />}
        {activeTab === "provenance" && (
          <ProvenanceHistoryTab collection={collection} />
        )}
        {activeTab === "valuation" && (
          <ValuationTab
            mode="view"
            collectionId={collectionId}
            locale={locale}
          />
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
