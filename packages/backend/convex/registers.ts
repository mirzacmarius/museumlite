import { v } from "convex/values";
import { query } from "./_generated/server";
import {
  exportColumnType,
  registerCriteria,
  registerProfile,
} from "./utils/exportContract";
import { requireFeatureAccess } from "./utils/featureGates";
import { requirePermission } from "./utils/permissions";
import {
  REGISTER_COLUMNS,
  REGISTER_PERMISSIONS,
  REGISTER_PROFILE_VERSION,
} from "./utils/registerProfiles";
import {
  readRegisterPage,
  validateRegisterCriteria,
} from "./utils/registerSources";

const PREVIEW_ROWS = 10;

/**
 * First rows of a register from one bounded source page, with the typed
 * column schema the export will use. Run the export for the complete register.
 */
export const preview = query({
  args: {
    organizationId: v.id("organizations"),
    profile: registerProfile,
    criteria: registerCriteria,
  },
  returns: v.object({
    profileVersion: v.number(),
    columns: v.array(v.object({ name: v.string(), type: exportColumnType })),
    rows: v.array(
      v.record(
        v.string(),
        v.union(v.string(), v.number(), v.boolean(), v.null()),
      ),
    ),
    pageRows: v.number(),
    scanned: v.number(),
    hasMore: v.boolean(),
  }),
  handler: async (ctx, args) => {
    for (const permission of REGISTER_PERMISSIONS[args.profile])
      await requirePermission(ctx, args.organizationId, permission);
    await requireFeatureAccess(ctx, args.organizationId, "reporting");
    await validateRegisterCriteria(
      ctx,
      args.organizationId,
      args.profile,
      args.criteria,
    );
    const page = await readRegisterPage(
      ctx,
      {
        organizationId: args.organizationId,
        profile: args.profile,
        criteria: args.criteria,
        asOf: args.criteria.asOf ?? Number.MAX_SAFE_INTEGER,
        capturedAt: null,
      },
      null,
    );
    return {
      profileVersion: REGISTER_PROFILE_VERSION,
      columns: REGISTER_COLUMNS[args.profile],
      rows: page.rows.slice(0, PREVIEW_ROWS),
      pageRows: page.rows.length,
      scanned: page.scanned,
      hasMore: !page.done || page.rows.length > PREVIEW_ROWS,
    };
  },
});
