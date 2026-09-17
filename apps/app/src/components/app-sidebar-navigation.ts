import {
  Activity,
  Bookmark,
  BookOpen,
  ChartColumn,
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
  MapPin,
  QrCode,
  Settings2,
  Shield,
  ShoppingCart,
  SlidersHorizontal,
  Ticket,
  Truck,
  Users,
} from "lucide-react";
import type { ComponentType } from "react";
import type { AdministrationAccess } from "@/components/administration-access";
import type { FeatureId } from "@/hooks/use-feature-access";

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
  hasFeature: (featureId: FeatureId) => boolean;
  isLibraryModuleEnabled: boolean;
  isLocationTrackingEnabled: boolean;
  administrationAccess: AdministrationAccess;
}

interface SidebarNavigation {
  topLevelNavigation: NavigationItem[];
  navigationGroups: NavigationGroup[];
}

interface AdministrationNavPlacement {
  topLevelWorkspace: NavigationItem[];
  administrationGroups: NavigationGroup[];
}

const PATRON_MANAGEMENT_NAV_ITEM = {
  title: "Patron Management",
  url: "/accounts?type=patron",
  icon: Users,
} satisfies NavigationItem;

function getAdministrationNavPlacement(
  access: AdministrationAccess,
  navWorkspace: NavigationItem[],
  administrationGroup: NavigationGroup,
): AdministrationNavPlacement {
  switch (access) {
    case "admin":
      return {
        topLevelWorkspace: [],
        administrationGroups: [administrationGroup],
      };
    case "member":
      return {
        topLevelWorkspace: navWorkspace,
        administrationGroups: [],
      };
    case "unknown":
      return {
        topLevelWorkspace: [],
        administrationGroups: [],
      };
    default: {
      const _exhaustive: never = access;
      return _exhaustive;
    }
  }
}

export function buildSidebarNavigation({
  hasFeature,
  isLibraryModuleEnabled,
  isLocationTrackingEnabled,
  administrationAccess,
}: BuildSidebarNavigationInput): SidebarNavigation {
  const navCoreInventory: NavigationItem[] = [
    { title: "Overview", url: "/", icon: LayoutGrid },
    { title: "Object Catalog", url: "/objects", icon: Database },
    ...(isLocationTrackingEnabled
      ? [{ title: "Location & Tracking", url: "/locations", icon: MapPin }]
      : []),
    { title: "Scan", url: "/scan", icon: QrCode },
    { title: "Accessions", url: "/accessions", icon: FileCheck },
    { title: "Deaccessions", url: "/deaccessions", icon: FileX },
  ];

  const navExhibitionsLoans: NavigationItem[] = [
    {
      title: "Loans & Transport",
      url: "/loans",
      icon: Truck,
      locked: !hasFeature("loans"),
    },
    {
      ...PATRON_MANAGEMENT_NAV_ITEM,
      locked: !hasFeature("loans"),
    },
    {
      title: "Transit Log",
      url: "/transit",
      icon: Container,
      locked: !hasFeature("loans"),
    },
    {
      title: "Exhibitions",
      url: "/exhibitions",
      icon: GalleryVerticalEnd,
      locked: !hasFeature("exhibitions"),
    },
    {
      title: "Installations",
      url: "/installations",
      icon: Hammer,
      locked: !hasFeature("installations"),
    },
  ];

  const navConservation: NavigationItem[] = [
    {
      title: "Conservation",
      url: "/conservation",
      icon: Activity,
      locked: !hasFeature("conservation"),
    },
    {
      title: "Insurance",
      url: "/insurance",
      icon: Shield,
      locked: !hasFeature("conservation"),
    },
  ];

  const navLibrary: NavigationItem[] = [
    { title: "Library Dashboard", url: "/library", icon: Library },
    {
      title: "Catalog & Search",
      url: "/library/catalog",
      icon: BookOpen,
      locked: !isLibraryModuleEnabled,
    },
    {
      title: "Circulation Desk",
      url: "/library/circulation",
      icon: IdCard,
      locked: !isLibraryModuleEnabled,
    },
    {
      title: "Holds",
      url: "/library/holds",
      icon: Bookmark,
      locked: !isLibraryModuleEnabled,
    },
    {
      ...PATRON_MANAGEMENT_NAV_ITEM,
      locked: !isLibraryModuleEnabled,
    },
    {
      title: "Fines & Fees",
      url: "/library/fines",
      icon: Ticket,
      locked: !isLibraryModuleEnabled,
    },
    {
      title: "Acquisitions",
      url: "/library/acquisitions",
      icon: ShoppingCart,
      locked: !isLibraryModuleEnabled,
    },
  ];

  const navWorkspace: NavigationItem[] = [
    { title: "Accounts & CRM", url: "/accounts", icon: Contact },
    { title: "Digital Assets", url: "/media", icon: Image },
  ];

  const navAdministration: NavigationItem[] = [
    {
      title: "Analytics & Reports",
      url: "/analytics",
      icon: ChartColumn,
      locked: !hasFeature("reporting"),
    },
    ...navWorkspace,
    {
      title: "Public Portal",
      url: "/portal",
      icon: Globe,
      locked: !hasFeature("public_portal"),
    },
    {
      title: "Preferences",
      url: "/settings/preferences",
      icon: SlidersHorizontal,
    },
    { title: "Settings", url: "/settings/organization", icon: Settings2 },
  ];

  const { topLevelWorkspace, administrationGroups } =
    getAdministrationNavPlacement(administrationAccess, navWorkspace, {
      title: "Administration",
      icon: Settings2,
      items: navAdministration,
    });

  return {
    topLevelNavigation: [...navCoreInventory, ...topLevelWorkspace],
    navigationGroups: [
      {
        title: "Exhibitions & Loans",
        icon: Truck,
        items: navExhibitionsLoans,
      },
      {
        title: "Conservation & Care",
        icon: Shield,
        items: navConservation,
      },
      {
        title: "Library",
        icon: Library,
        items: navLibrary,
      },
      ...administrationGroups,
    ],
  };
}
