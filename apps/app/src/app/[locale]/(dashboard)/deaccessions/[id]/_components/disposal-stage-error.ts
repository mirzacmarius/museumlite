import { ConvexError } from "convex/values";

/** Backend policy errors explain what is missing; other failures use the fallback. */
export function disposalStageErrorMessage(error: unknown, fallback: string) {
  return error instanceof ConvexError && typeof error.data === "string"
    ? error.data
    : fallback;
}
