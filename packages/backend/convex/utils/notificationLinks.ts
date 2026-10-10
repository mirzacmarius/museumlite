/**
 * Canonical route for a notification's entity. Objects are stored in the
 * `collections` table, so `collection` notifications open `/objects/:id`.
 */
export function notificationEntityHref(
  entityType: string | undefined,
  entityId: string | undefined,
): string | null {
  if (!entityType || !entityId) return null;

  switch (entityType) {
    case "collection":
    case "object":
      return `/objects/${entityId}`;
    case "accession":
      return `/accessions/${entityId}`;
    case "deaccession":
      return `/deaccessions/${entityId}`;
    case "loan":
      return `/loans/${entityId}`;
    case "exhibition":
      return `/exhibitions/${entityId}`;
    case "conservationTreatment":
      return `/conservation/${entityId}`;
    case "installationTask":
      return "/installations";
    case "location":
      return `/locations/${entityId}`;
    case "move_request":
      return `/objects/move-requests/${entityId}`;
    default:
      return null;
  }
}
