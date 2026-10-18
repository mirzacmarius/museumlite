import { caseHref, caseTypeOfEntity } from "./caseTypes";

/**
 * Canonical route for a notification's entity. Cases open where the app
 * shows them. Objects are stored in the `collections` table, so `collection`
 * notifications open `/objects/:id`.
 */
export function notificationEntityHref(
  entityType: string | undefined,
  entityId: string | undefined,
): string | null {
  if (!entityType || !entityId) return null;
  const caseType = caseTypeOfEntity(entityType);
  if (caseType) return caseHref(caseType, entityId);

  switch (entityType) {
    case "collection":
    case "object":
      return `/objects/${entityId}`;
    case "installationTask":
      return "/installations";
    case "location":
      return `/locations/${entityId}`;
    case "alertEpisode":
      return `/locations/episodes/${entityId}`;
    case "move_request":
      return `/objects/move-requests/${entityId}`;
    case "reproductionRequest":
      return `/reproduction-requests/${entityId}`;
    default:
      return null;
  }
}
