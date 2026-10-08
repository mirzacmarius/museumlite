export type ProjectionUnavailableReason =
  | "not_built"
  | "building"
  | "invalidated"
  | "definition_changed"
  | "rebuild_failed";

interface AvailabilityResult {
  availability: "ready" | "unavailable";
}

export type ReadyResult<T> = Extract<T, { availability: "ready" }>;

export function isReady<T extends AvailabilityResult>(
  result: T,
): result is ReadyResult<T> {
  return result.availability === "ready";
}

export function readyResult<T extends AvailabilityResult>(
  result: T | undefined,
): ReadyResult<T> | undefined {
  return result && isReady(result) ? result : undefined;
}

export function unavailableReason(
  result:
    | { availability: "ready" }
    | { availability: "unavailable"; reason: ProjectionUnavailableReason }
    | undefined,
): ProjectionUnavailableReason | undefined {
  return result?.availability === "unavailable" ? result.reason : undefined;
}
