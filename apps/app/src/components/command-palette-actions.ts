import { capabilityRoute } from "@v1/backend/convex/utils/capabilities";
import {
  Archive,
  Box,
  Building2,
  ClipboardCheck,
  CreditCard,
  FileImage,
  FilePlus,
  LayoutDashboard,
  Library,
  MapPin,
  Plus,
  Settings,
} from "lucide-react";
import type { ComponentType } from "react";
import {
  type CapabilityId,
  type CapabilityStateLookup,
  navigationAccess,
} from "@/lib/capability-access";

export interface CommandPaletteAction {
  /** Translation key under `untranslatedComponents.labels`. */
  labelKey: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  shortcut?: string;
}

interface BuildCommandPaletteActionsInput {
  capabilityState: CapabilityStateLookup;
  hasPermission: (permission: string) => boolean;
  isLocationTrackingEnabled: boolean;
}

/**
 * Palette commands from the capability matrix. Unlike the sidebar, the
 * palette lists only commands the member can open now. New accessions stay
 * listed because workflow settings decide who may start one.
 */
export function buildCommandPaletteActions({
  capabilityState,
  hasPermission,
  isLocationTrackingEnabled,
}: BuildCommandPaletteActionsInput) {
  const isOpen = (capability: CapabilityId) =>
    navigationAccess(capabilityState(capability)) === "open";
  const when = (condition: boolean, action: CommandPaletteAction) =>
    condition ? [action] : [];

  const canCreateRecords = hasPermission("collections.create");
  const create: CommandPaletteAction[] = [
    ...when(canCreateRecords, {
      labelKey: "newObject",
      href: "/objects/new",
      icon: FilePlus,
      shortcut: "⌘N",
    }),
    { labelKey: "newAccession", href: "/accessions/new", icon: Plus },
    ...when(isOpen("loans") && hasPermission("loans.create"), {
      labelKey: "newLoan",
      href: `${capabilityRoute("loans")}/new`,
      icon: Plus,
    }),
    ...when(canCreateRecords, {
      labelKey: "newCollectionGroup",
      href: "/collections/new",
      icon: Plus,
    }),
  ];

  const navigation: CommandPaletteAction[] = [
    { labelKey: "dashboard", href: "/", icon: LayoutDashboard },
    { labelKey: "objects", href: "/objects", icon: Box },
    { labelKey: "collectionGroups", href: "/collections", icon: Archive },
    { labelKey: "accessions", href: "/accessions", icon: Building2 },
    ...when(isOpen("documentation_quality"), {
      labelKey: "documentationQuality",
      href: capabilityRoute("documentation_quality"),
      icon: ClipboardCheck,
    }),
    ...when(isOpen("reproduction_requests"), {
      labelKey: "reproductionRequests",
      href: capabilityRoute("reproduction_requests"),
      icon: FileImage,
    }),
    ...when(isOpen("loans"), {
      labelKey: "loans",
      href: capabilityRoute("loans"),
      icon: CreditCard,
    }),
    ...when(isLocationTrackingEnabled, {
      labelKey: "locations",
      href: "/locations",
      icon: MapPin,
    }),
    ...when(isOpen("library"), {
      labelKey: "library",
      href: capabilityRoute("library"),
      icon: Library,
    }),
    ...when(isOpen("administration"), {
      labelKey: "settings",
      href: capabilityRoute("administration"),
      icon: Settings,
    }),
  ];

  return { create, navigation };
}
