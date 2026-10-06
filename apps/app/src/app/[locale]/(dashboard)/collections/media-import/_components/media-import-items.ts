import type { Id } from "@v1/backend/convex/_generated/dataModel";

export interface MediaImportSourceFile {
  name: string;
  size: number;
  lastModified: number;
}

/**
 * Orders selected files so the same selection always gives each file the same
 * item number on its import job, whatever order the browser returned them in.
 */
export function orderMediaFiles<F extends MediaImportSourceFile>(files: F[]) {
  return [...files].sort(
    (a, b) =>
      a.name.localeCompare(b.name) ||
      a.size - b.size ||
      a.lastModified - b.lastModified,
  );
}

/** Text whose SHA-256 identifies an ordered selection of files. */
export function mediaSelectionSignature(files: MediaImportSourceFile[]) {
  return JSON.stringify(
    files.map((file) => [file.name, file.size, file.lastModified]),
  );
}

export type MediaImportItemAction<F> =
  | { kind: "upload"; itemNumber: number; file: F }
  | {
      kind: "retry-retained";
      itemNumber: number;
      file: F;
      storageId: Id<"_storage">;
    };

/**
 * Work still needed for an import. Accepted items are skipped; failed items
 * whose original is already retained are retried without uploading again.
 */
export function planMediaImportItems<F>(
  files: F[],
  acceptedItems: ReadonlySet<number>,
  retainedOriginals: ReadonlyMap<number, Id<"_storage">>,
): MediaImportItemAction<F>[] {
  return files.flatMap((file, index) => {
    const itemNumber = index + 1;
    if (acceptedItems.has(itemNumber)) return [];
    const storageId = retainedOriginals.get(itemNumber);
    return storageId
      ? [{ kind: "retry-retained" as const, itemNumber, file, storageId }]
      : [{ kind: "upload" as const, itemNumber, file }];
  });
}
