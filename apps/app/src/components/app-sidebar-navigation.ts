import { capabilityRoute } from "@v1/backend/convex/utils/capabilities";
import {
  Activity,
  Bookmark,
  BookOpen,
  ChartColumn,
  ClipboardCheck,
  ClipboardList,
  Contact,
  Container,
  Database,
  FileCheck,
  FileX,
  GalleryVerticalEnd,
  Globe,
  Hammer,
  IdCard,
  Image,
  LayoutGrid,
  Library,
  ListTodo,
  MapPin,
  QrCode,
  Settings2,
  Shield,
  ShoppingCart,
  Siren,
  SlidersHorizontal,
  Ticket,
  Truck,
  Users,
} from "lucide-react";
import type { ComponentType } from "react";
import {
  type CapabilityId,
  type CapabilityStateLookup,
  navigationAccess,
} from "@/lib/capability-access";

export type SidebarIcon = ComponentType<{ className?: string }>;

export interface NavigationItem {
  title: string;
  url: string;
  icon?: SidebarIcon;
  locked?: boolean;
  subItems?: NavigationItem[];
}

export interface NavigationGroup {
  title: string;
  icon: SidebarIcon;
  items: NavigationItem[];
  defaultOpen?: boolean;
}

interface BuildSidebarNavigationInput {
  translate: (key: string) => string;
  capabilityState: CapabilityStateLookup;
  isLocationTrackingEnabled: boolean;
}

interface SidebarNavigation {
  topLevelNavigation: NavigationItem[];
  navigationGroups: NavigationGroup[];
}

/**
 * Builds the sidebar from the capability matrix: every gated destination uses
 * its capability's canonical route and is open, locked or hidden by the
 * caller's capability state.
 */
export function buildSidebarNavigation({
  translate,
  capabilityState,
  isLocationTrackingEnabled,
}: BuildSidebarNavigationInput): SidebarNavigation {
  const label = (key: string) =>
    translate(`untranslatedComponents.navigation.${key}`);
  const capabilityItem = (
    capability: CapabilityId,
    item: { title: string; icon: SidebarIcon },
    options?: { lockWhenModuleDisabled?: boolean },
  ): NavigationItem[] => {
    const access = navigationAccess(capabilityState(capability), options);
    if (access === "hidden") return [];
    return [
      {
        ...item,
        url: capabilityRoute(capability),
        locked: access === "locked",
      },
    ];
  };
  const isOpen = (capability: CapabilityId) =>
    navigationAccess(capabilityState(capability)) === "open";

  const navCoreInventory: NavigationItem[] = [
    { title: label("overview"), url: "/", icon: LayoutGrid },
    { title: label("myWork"), url: "/assignments", icon: ListTodo },
    { title: label("objectCatalog"), url: "/objects", icon: Database },
    ...(isLocationTrackingEnabled
      ? [{ title: label("locationTracking"), url: "/locations", icon: MapPin }]
      : []),
    { title: label("scan"), url: "/scan", icon: QrCode },
    ...capabilityItem("inventory", {
      title: label("inventory"),
      icon: ClipboardList,
    }),
    { title: label("accessions"), url: "/accessions", icon: FileCheck },
    { title: label("deaccessions"), url: "/deaccessions", icon: FileX },
    ...capabilityItem("incidents", { title: label("incidents"), icon: Siren }),
    ...capabilityItem("documentation_quality", {
      title: label("documentationQuality"),
      icon: ClipboardCheck,
    }),
    ...capabilityItem("conservation", {
      title: label("conservation"),
      icon: Activity,
    }),
    ...capabilityItem("insurance", { title: label("insurance"), icon: Shield }),
  ];

  const navExhibitionsLoans: NavigationItem[] = [
    ...capabilityItem("loans", { title: label("loansTransport"), icon: Truck }),
    ...capabilityItem("transit", {
      title: label("transitLog"),
      icon: Container,
    }),
    ...capabilityItem("exhibitions", {
      title: label("exhibitions"),
      icon: GalleryVerticalEnd,
    }),
    ...capabilityItem("installations", {
      title: label("installations"),
      icon: Hammer,
    }),
  ];

  const navLibrary: NavigationItem[] = [
    ...capabilityItem("library", {
      title: label("libraryDashboard"),
      icon: Library,
    }),
    { title: label("catalogSearch"), url: "/library/catalog", icon: BookOpen },
    {
      title: label("circulationDesk"),
      url: "/library/circulation",
      icon: IdCard,
    },
    { title: label("holds"), url: "/library/holds", icon: Bookmark },
    ...capabilityItem(
      "patrons",
      { title: label("patronManagement"), icon: Users },
      { lockWhenModuleDisabled: true },
    ),
    { title: label("finesFees"), url: "/library/fines", icon: Ticket },
    {
      title: label("acquisitions"),
      url: "/library/acquisitions",
      icon: ShoppingCart,
    },
  ];

  const navAdministration: NavigationItem[] = [
    ...capabilityItem("reporting", {
      title: label("analyticsReports"),
      icon: ChartColumn,
    }),
    ...capabilityItem("accounts", {
      title: label("accountsCrm"),
      icon: Contact,
    }),
    ...capabilityItem("public_portal", {
      title: label("publicPortal"),
      icon: Globe,
    }),
    { title: label("digitalAssets"), url: "/media", icon: Image },
    {
      title: label("preferences"),
      url: "/settings/preferences",
      icon: SlidersHorizontal,
    },
    {
      title: label("settings"),
      url: capabilityRoute("administration"),
      icon: Settings2,
    },
  ];

  const groups: NavigationGroup[] = [
    {
      title: label("exhibitionsLoans"),
      icon: Truck,
      items: navExhibitionsLoans,
    },
    ...(isOpen("library")
      ? [{ title: label("library"), icon: Library, items: navLibrary }]
      : []),
    ...(isOpen("administration")
      ? [
          {
            title: label("administration"),
            icon: Settings2,
            items: navAdministration,
          },
        ]
      : []),
  ];

  return {
    topLevelNavigation: navCoreInventory,
    navigationGroups: groups.filter((group) => group.items.length > 0),
  };
}
