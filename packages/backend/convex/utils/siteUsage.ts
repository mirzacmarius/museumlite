import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { convexErrorData } from "./convexErrorData";

/** Locations of one site read before giving up on a complete answer. */
const SITE_LOCATIONS_READ = 200;
/** Objects placed at the site's locations read in total. */
const SITE_OBJECTS_READ = 500;
/** Active locations named in a refusal, so staff can open them. */
const LOCATIONS_LISTED = 10;

export const SITE_IN_USE_CODE = "SITE_IN_USE";

// Type alias (not an interface) so the payload satisfies Convex's Value type.
export type SiteInUseData = {
  code: typeof SITE_IN_USE_CODE;
  /** English text for logs; clients translate from the counts. */
  message: string;
  /** Active locations assigned to the site. */
  activeLocations: number;
  /** Objects in custody placed at any of the site's locations. */
  objectsHeld: number;
  /** The site has more locations or objects than one check reads. */
  incomplete: boolean;
  locations: Array<{ id: string; name: string }>;
};

/**
 * What still depends on a site: its active locations, and the objects in
 * custody placed at any of its locations, including inactive ones. Fails
 * closed: a site too large to read completely counts as in use.
 */
export async function siteUsage(ctx: Pick<QueryCtx, "db">, site: Doc<"sites">) {
  const locations = await ctx.db
    .query("locations")
    .withIndex("by_organization_and_site", (q) =>
      q.eq("organizationId", site.organizationId).eq("siteId", site._id),
    )
    .take(SITE_LOCATIONS_READ + 1);
  let incomplete = locations.length > SITE_LOCATIONS_READ;
  const active = locations
    .slice(0, SITE_LOCATIONS_READ)
    .filter((location) => location.isActive);
  let objectsRead = 0;
  let objectsHeld = 0;
  for (const location of locations.slice(0, SITE_LOCATIONS_READ)) {
    const objects = await ctx.db
      .query("collections")
      .withIndex("by_currentLocation", (q) =>
        q.eq("currentLocationId", location._id),
      )
      .take(SITE_OBJECTS_READ - objectsRead + 1);
    if (objectsRead + objects.length > SITE_OBJECTS_READ) {
      incomplete = true;
      break;
    }
    objectsRead += objects.length;
    objectsHeld += objects.filter(
      (object) =>
        object.organizationId === site.organizationId &&
        (object.status === "active" || object.status === "loaned"),
    ).length;
  }
  return {
    activeLocations: active.length,
    objectsHeld,
    incomplete,
    locations: active
      .slice(0, LOCATIONS_LISTED)
      .map((location) => ({ id: location._id, name: location.name })),
  };
}

export function siteInUse(
  usage: Omit<SiteInUseData, "code" | "message">,
): ConvexError<SiteInUseData> {
  return new ConvexError({
    code: SITE_IN_USE_CODE,
    message:
      "Deactivate or reassign the site's locations and move the objects held there first",
    ...usage,
  });
}

/** Reads a site-in-use refusal from a thrown error; null for anything else. */
export function siteInUseFromError(error: unknown): SiteInUseData | null {
  const data = convexErrorData(error);
  if (typeof data !== "object" || data === null) return null;
  const record = data as Record<string, unknown>;
  if (record.code !== SITE_IN_USE_CODE) return null;
  const count = (value: unknown) => (typeof value === "number" ? value : 0);
  return {
    code: SITE_IN_USE_CODE,
    message: typeof record.message === "string" ? record.message : "",
    activeLocations: count(record.activeLocations),
    objectsHeld: count(record.objectsHeld),
    incomplete: record.incomplete === true,
    locations: Array.isArray(record.locations)
      ? record.locations.flatMap((location: unknown) => {
          if (typeof location !== "object" || location === null) return [];
          const { id, name } = location as Record<string, unknown>;
          return typeof id === "string" && typeof name === "string"
            ? [{ id, name }]
            : [];
        })
      : [],
  };
}
