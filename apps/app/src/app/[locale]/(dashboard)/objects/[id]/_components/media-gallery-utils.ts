export type MediaDisplayKind =
  | "image"
  | "video"
  | "pdf"
  | "document"
  | "model3d"
  | "embed3d"
  | "unsupported";

interface MediaFileLike {
  fileName: string;
  fileType: string;
  mimeType?: string;
}

export function isPdfFile(file: MediaFileLike): boolean {
  if (file.mimeType === "application/pdf") return true;
  if (file.fileType === "document" && file.fileName.toLowerCase().endsWith(".pdf")) {
    return true;
  }
  return file.fileName.toLowerCase().endsWith(".pdf");
}

export function getMediaDisplayKind(file: MediaFileLike): MediaDisplayKind {
  if (file.fileType === "image") return "image";
  if (file.fileType === "video") return "video";
  if (isPdfFile(file)) return "pdf";
  if (file.fileType === "3d") return "model3d";
  if (file.fileType === "document") return "document";
  return "unsupported";
}

export function formatMediaFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"] as const;
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(k)),
    sizes.length - 1,
  );
  return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

export function getFileExtensionLabel(fileName: string): string {
  const ext = fileName.split(".").pop()?.toUpperCase();
  return ext || "FILE";
}

/** Extract Sketchfab model UID from common page and embed URLs. */
export function getSketchfabModelId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("sketchfab.com")) return null;

    const modelsMatch = parsed.pathname.match(/\/models\/([a-f0-9]{32})/i);
    if (modelsMatch?.[1]) return modelsMatch[1];

    const shortMatch = parsed.pathname.match(/\/3d-models\/[^/]+-([a-f0-9]{32})/i);
    if (shortMatch?.[1]) return shortMatch[1];

    return null;
  } catch {
    return null;
  }
}

export function getSketchfabEmbedUrl(url: string): string | null {
  const modelId = getSketchfabModelId(url);
  if (!modelId) return null;
  return `https://sketchfab.com/models/${modelId}/embed?autostart=0&ui_controls=1&ui_infos=0`;
}

export function isSketchfabUrl(url: string): boolean {
  return getSketchfabModelId(url) !== null;
}

export interface CollectionLink {
  url: string;
  label?: string;
}

export interface SketchfabEmbedItem {
  id: string;
  url: string;
  label?: string;
  embedUrl: string | null;
}

export function getSketchfabEmbedsFromLinks(
  links: CollectionLink[] | undefined,
): SketchfabEmbedItem[] {
  if (!links?.length) return [];

  const embeds: SketchfabEmbedItem[] = [];
  for (const link of links) {
    if (!link.url.includes("sketchfab")) continue;
    embeds.push({
      id: link.url,
      url: link.url,
      label: link.label,
      embedUrl: getSketchfabEmbedUrl(link.url),
    });
  }
  return embeds;
}

export function getExternalLinksExcludingSketchfab(
  links: CollectionLink[] | undefined,
): CollectionLink[] {
  if (!links?.length) return [];
  return links.filter((link) => !isSketchfabUrl(link.url));
}
