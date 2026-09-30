import {
  Archive,
  Box,
  Building2,
  Columns2,
  DoorOpen,
  Frame,
  GalleryVerticalEnd,
  Landmark,
  Layers,
  MapPin,
  PanelsTopLeft,
  Rows3,
  Vault,
  Warehouse,
} from "lucide-react";

const locationTypeIcons = {
  archive: Archive,
  building: Building2,
  cabinet: Box,
  floor: Layers,
  gallery: GalleryVerticalEnd,
  hall: Landmark,
  room: DoorOpen,
  shelf: Rows3,
  storage: Warehouse,
  vault: Vault,
  vitrine: Frame,
  wall: PanelsTopLeft,
  wing: Columns2,
  other: MapPin,
};

type LocationTypeIconKey = keyof typeof locationTypeIcons;

const locationTypeIconMatchers: Array<[string, LocationTypeIconKey]> = [
  ["vault", "vault"],
  ["cabinet", "cabinet"],
  ["shelf", "shelf"],
  ["vitrine", "vitrine"],
  ["display case", "vitrine"],
  ["displaycase", "vitrine"],
  ["wall", "wall"],
  ["archive", "archive"],
  ["storage", "storage"],
  ["gallery", "gallery"],
  ["exhibition", "gallery"],
  ["hall", "hall"],
  ["wing", "wing"],
  ["floor", "floor"],
  ["building", "building"],
  ["room", "room"],
  ["case", "vitrine"],
];

export function getLocationTypeIconKey(type: string): LocationTypeIconKey {
  const normalizedType = type.toLowerCase();
  const matcher = locationTypeIconMatchers.find(
    ([match]) => normalizedType.indexOf(match) !== -1,
  );

  return matcher?.[1] ?? "other";
}

interface LocationTypeIconProps {
  type: string;
  className?: string;
}

export function LocationTypeIcon({ type, className }: LocationTypeIconProps) {
  const Icon = locationTypeIcons[getLocationTypeIconKey(type)];

  return <Icon className={className} aria-hidden="true" />;
}
