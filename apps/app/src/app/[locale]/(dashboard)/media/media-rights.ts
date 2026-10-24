import type { api } from "@v1/backend/convex/_generated/api";
import type { Doc } from "@v1/backend/convex/_generated/dataModel";
import type { RightsStatementUri } from "@v1/backend/convex/utils/rightsStatements";
import type { FunctionArgs } from "convex/server";
import { z } from "zod";

export type RightsStatus = NonNullable<Doc<"mediaFiles">["rightsStatus"]>;
export type LicenseType = NonNullable<Doc<"mediaFiles">["licenseType"]>;

export const RIGHTS_STATUSES: RightsStatus[] = [
  "unknown",
  "owned",
  "public_domain",
  "licensed",
  "restricted",
  "orphan_work",
];
export const LICENSE_TYPES: LicenseType[] = [
  "creative_commons_by",
  "creative_commons_by_sa",
  "creative_commons_by_nc",
  "creative_commons_by_nd",
  "creative_commons_zero",
  "editorial_only",
  "commercial",
  "internal_only",
  "custom",
];

export type StoredMediaRights = Pick<
  Doc<"mediaFiles">,
  | "rightsStatus"
  | "licenseType"
  | "licenseExpiry"
  | "usageRestrictions"
  | "requiresAcknowledgment"
  | "rightsStatement"
>;

/** A file's rights as the Media Library edits them. */
export interface MediaRightsValues {
  rightsStatus: RightsStatus;
  licenseType: LicenseType | "";
  /** The last day of the licence as `yyyy-MM-dd`, or empty. */
  licenseExpiry: string;
  usageRestrictions: string;
  requiresAcknowledgment: boolean;
  /** Absent when the Organization's media default applies. */
  rightsStatement: RightsStatementUri | undefined;
}

type MediaRightsUpdate = Omit<
  FunctionArgs<typeof api.media.updateRights>,
  "mediaId"
>;

const expirySchema = z.union([
  z.literal(""),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
]);

function expiryTimestamp(licenseExpiry: string) {
  return Date.parse(`${licenseExpiry}T23:59:59.999Z`);
}

export function mediaRightsValuesOf(
  item: StoredMediaRights,
): MediaRightsValues {
  return {
    rightsStatus: item.rightsStatus ?? "unknown",
    licenseType: item.licenseType ?? "",
    licenseExpiry: item.licenseExpiry
      ? new Date(item.licenseExpiry).toISOString().slice(0, 10)
      : "",
    usageRestrictions: item.usageRestrictions ?? "",
    requiresAcknowledgment: item.requiresAcknowledgment ?? false,
    rightsStatement: item.rightsStatement,
  };
}

export function isLicenseExpiryValid(licenseExpiry: string) {
  return (
    expirySchema.safeParse(licenseExpiry).success &&
    (licenseExpiry === "" || !Number.isNaN(expiryTimestamp(licenseExpiry)))
  );
}

/**
 * What saving the entered rights sends. The recorded rights gate the portal,
 * so saving them withdraws the image's approval (ADR 0017): they are sent
 * only when one of them changed. The statement only describes the rights,
 * so sending it alone keeps the approval (ADR 0022). Empty when nothing
 * changed.
 */
export function mediaRightsUpdate(
  entered: MediaRightsValues,
  stored: MediaRightsValues,
): MediaRightsUpdate {
  const usageRestrictions = entered.usageRestrictions.trim();
  const recordedRightsChanged =
    entered.rightsStatus !== stored.rightsStatus ||
    entered.licenseType !== stored.licenseType ||
    entered.licenseExpiry !== stored.licenseExpiry ||
    usageRestrictions !== stored.usageRestrictions ||
    entered.requiresAcknowledgment !== stored.requiresAcknowledgment;
  return {
    ...(recordedRightsChanged && {
      rightsStatus: entered.rightsStatus,
      licenseType: entered.licenseType || null,
      licenseExpiry: entered.licenseExpiry
        ? expiryTimestamp(entered.licenseExpiry)
        : null,
      usageRestrictions: usageRestrictions || null,
      requiresAcknowledgment: entered.requiresAcknowledgment,
    }),
    ...(entered.rightsStatement !== stored.rightsStatement && {
      rightsStatement: entered.rightsStatement ?? null,
    }),
  };
}
