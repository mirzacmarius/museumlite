/**
 * Reasons a movement records when staff give none. They only restate the
 * movement's kind in English, so a screen that names the kind leaves them out.
 */
export const DEFAULT_MOVEMENT_REASONS = {
  direct: "Direct move",
  catalogEdit: "Catalog location change",
  bulkCatalogEdit: "Bulk catalog location change",
  bulkEdit: "Bulk edit location change",
  bulkMove: "Bulk move operation",
} as const;

export function isDefaultMovementReason(reason: string) {
  return Object.values(DEFAULT_MOVEMENT_REASONS).some(
    (defaultReason) => defaultReason === reason,
  );
}
