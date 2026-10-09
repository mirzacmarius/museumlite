"use client";

import type { CollectionModuleId } from "@v1/backend/convex/utils/moduleCatalog";
import { useEffect, useMemo, useState } from "react";
import { getObjectEditTabs } from "../../[id]/_components/object-tab-config";
import type { CollectionEditTabId } from "./types";

export function useFormTabState(
  isLocationTrackingEnabled: boolean,
  typeDetailsTab?: CollectionModuleId,
) {
  const tabs = useMemo(
    () =>
      getObjectEditTabs({
        locationTrackingEnabled: isLocationTrackingEnabled,
        typeDetailsTab,
      }).map((tab) => ({ ...tab, id: tab.id as CollectionEditTabId })),
    [isLocationTrackingEnabled, typeDetailsTab],
  );
  const [activeTab, setActiveTab] = useState<CollectionEditTabId>("general");

  useEffect(() => {
    if (tabs.length === 0) {
      return;
    }

    const firstTabId = tabs[0]?.id;
    if (!firstTabId) {
      return;
    }

    if (!tabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(firstTabId);
    }
  }, [activeTab, tabs]);

  return { tabs, activeTab, setActiveTab };
}
