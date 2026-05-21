import {
  Building2,
  FileIcon,
  FolderIcon,
  FolderOpenIcon,
  MapPin,
} from "lucide-react";

interface LocationTreeTypeIconProps {
  type: string;
  isFolder: boolean;
  isExpanded: boolean;
}

export function LocationTreeTypeIcon({
  type,
  isFolder,
  isExpanded,
}: LocationTreeTypeIconProps) {
  if (type === "root") return null;

  if (isFolder) {
    return isExpanded ? (
      <FolderOpenIcon className="pointer-events-none size-4 text-muted-foreground" />
    ) : (
      <FolderIcon className="pointer-events-none size-4 text-muted-foreground" />
    );
  }

  switch (type.toLowerCase()) {
    case "building":
      return (
        <Building2 className="pointer-events-none size-4 text-muted-foreground" />
      );
    case "room":
    case "gallery":
      return (
        <MapPin className="pointer-events-none size-4 text-muted-foreground" />
      );
    default:
      return (
        <FileIcon className="pointer-events-none size-4 text-muted-foreground" />
      );
  }
}
