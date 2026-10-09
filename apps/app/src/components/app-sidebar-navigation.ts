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
  ListTodo,
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
  translate: (key: string) => string;
  hasFeature: (featureId: FeatureId) => boolean;
  isLibraryModuleEnabled: boolean;
  isInsuranceModuleEnabled: boolean;
  isLocationTrackingEnabled: boolean;
  canAccessAdministration: boolean;
}

interface SidebarNavigation {
  topLevelNavigation: NavigationItem[];
  navigationGroups: NavigationGroup[];
}

export function buildSidebarNavigation({
  translate,
  hasFeature,
  isLibraryModuleEnabled,
  isInsuranceModuleEnabled,
  isLocationTrackingEnabled,
  canAccessAdministration,
}: BuildSidebarNavigationInput): SidebarNavigation {
  const patronManagementNavItem: NavigationItem = {
    title: translate("untranslatedComponents.navigation.patronManagement"),
    url: "/accounts?type=patron",
    icon: Users,
  };
  const navCoreInventory: NavigationItem[] = [
    {
      title: translate("untranslatedComponents.navigation.overview"),
      url: "/",
      icon: LayoutGrid,
    },
    {
      title: translate("untranslatedComponents.navigation.myWork"),
      url: "/assignments",
      icon: ListTodo,
    },
    {
      title: translate("untranslatedComponents.navigation.objectCatalog"),
      url: "/objects",
      icon: Database,
    },
    ...(isLocationTrackingEnabled
      ? [
          {
            title: translate(
              "untranslatedComponents.navigation.locationTracking",
            ),
            url: "/locations",
            icon: MapPin,
          },
        ]
      : []),
    {
      title: translate("untranslatedComponents.navigation.scan"),
      url: "/scan",
      icon: QrCode,
    },
    {
      title: translate("untranslatedComponents.navigation.accessions"),
      url: "/accessions",
      icon: FileCheck,
    },
    {
      title: translate("untranslatedComponents.navigation.deaccessions"),
      url: "/deaccessions",
      icon: FileX,
    },
    {
      title: translate("untranslatedComponents.navigation.conservation"),
      url: "/conservation",
      icon: Activity,
      locked: !hasFeature("conservation"),
    },
    ...(isInsuranceModuleEnabled
      ? [
          {
            title: translate("untranslatedComponents.navigation.insurance"),
            url: "/insurance",
            icon: Shield,
            locked: !hasFeature("conservation"),
          },
        ]
      : []),
  ];

  const navExhibitionsLoans: NavigationItem[] = [
    {
      title: translate("untranslatedComponents.navigation.loansTransport"),
      url: "/loans",
      icon: Truck,
      locked: !hasFeature("loans"),
    },
    {
      ...patronManagementNavItem,
      locked: !hasFeature("loans"),
    },
    {
      title: translate("untranslatedComponents.navigation.transitLog"),
      url: "/transit",
      icon: Container,
      locked: !hasFeature("loans"),
    },
    {
      title: translate("untranslatedComponents.navigation.exhibitions"),
      url: "/exhibitions",
      icon: GalleryVerticalEnd,
      locked: !hasFeature("exhibitions"),
    },
    {
      title: translate("untranslatedComponents.navigation.installations"),
      url: "/installations",
      icon: Hammer,
      locked: !hasFeature("installations"),
    },
  ];

  const navLibrary: NavigationItem[] = [
    {
      title: translate("untranslatedComponents.navigation.libraryDashboard"),
      url: "/library",
      icon: Library,
    },
    {
      title: translate("untranslatedComponents.navigation.catalogSearch"),
      url: "/library/catalog",
      icon: BookOpen,
      locked: !isLibraryModuleEnabled,
    },
    {
      title: translate("untranslatedComponents.navigation.circulationDesk"),
      url: "/library/circulation",
      icon: IdCard,
      locked: !isLibraryModuleEnabled,
    },
    {
      title: translate("untranslatedComponents.navigation.holds"),
      url: "/library/holds",
      icon: Bookmark,
      locked: !isLibraryModuleEnabled,
    },
    {
      ...patronManagementNavItem,
      locked: !isLibraryModuleEnabled,
    },
    {
      title: translate("untranslatedComponents.navigation.finesFees"),
      url: "/library/fines",
      icon: Ticket,
      locked: !isLibraryModuleEnabled,
    },
    {
      title: translate("untranslatedComponents.navigation.acquisitions"),
      url: "/library/acquisitions",
      icon: ShoppingCart,
      locked: !isLibraryModuleEnabled,
    },
  ];

  const navAdministration: NavigationItem[] = [
    {
      title: translate("untranslatedComponents.navigation.analyticsReports"),
      url: "/analytics",
      icon: ChartColumn,
      locked: !hasFeature("reporting"),
    },
    {
      title: translate("untranslatedComponents.navigation.accountsCrm"),
      url: "/accounts",
      icon: Contact,
    },
    {
      title: translate("untranslatedComponents.navigation.publicPortal"),
      url: "/portal",
      icon: Globe,
      locked: !hasFeature("public_portal"),
    },
    {
      title: translate("untranslatedComponents.navigation.digitalAssets"),
      url: "/media",
      icon: Image,
    },
    {
      title: translate("untranslatedComponents.navigation.preferences"),
      url: "/settings/preferences",
      icon: SlidersHorizontal,
    },
    {
      title: translate("untranslatedComponents.navigation.settings"),
      url: "/settings/organization",
      icon: Settings2,
    },
  ];

  return {
    topLevelNavigation: navCoreInventory,
    navigationGroups: [
      {
        title: translate("untranslatedComponents.navigation.exhibitionsLoans"),
        icon: Truck,
        items: navExhibitionsLoans,
      },
      ...(isLibraryModuleEnabled
        ? [
            {
              title: translate("untranslatedComponents.navigation.library"),
              icon: Library,
              items: navLibrary,
            },
          ]
        : []),
      ...(canAccessAdministration
        ? [
            {
              title: translate(
                "untranslatedComponents.navigation.administration",
              ),
              icon: Settings2,
              items: navAdministration,
            },
          ]
        : []),
    ],
  };
}
