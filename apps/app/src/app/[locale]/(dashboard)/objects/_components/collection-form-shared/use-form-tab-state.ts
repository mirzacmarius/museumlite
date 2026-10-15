"use client";

import type { CollectionModuleId } from "@v1/backend/convex/utils/moduleCatalog";
import { useMemo, useState } from "react";
import { getObjectEditTabs } from "../../[id]/_components/object-tab-config";
import type { CollectionEditTabId } from "./types";

interface FormTabStateOptions {
  isLocationTrackingEnabled: boolean;
  typeDetailsTab?: CollectionModuleId;
  savedObject?: boolean;
  permissions?: ReadonlyArray<string>;
  initialTab?: string | null;
}

export function useFormTabState({
  isLocationTrackingEnabled,
  typeDetailsTab,
  savedObject,
  permissions,
  initialTab,
}: FormTabStateOptions) {
  const tabs = useMemo(
    () =>
      getObjectEditTabs({
        locationTrackingEnabled: isLocationTrackingEnabled,
        typeDetailsTab,
        savedObject,
        permissions,
      }).map((tab) => ({ ...tab, id: tab.id as CollectionEditTabId })),
    [isLocationTrackingEnabled, typeDetailsTab, savedObject, permissions],
  );
  const [requestedTab, setActiveTab] = useState(initialTab);
  const activeTab: CollectionEditTabId =
    tabs.find((tab) => tab.id === requestedTab)?.id ?? tabs[0]?.id ?? "general";

  return { tabs, activeTab, setActiveTab };
}
