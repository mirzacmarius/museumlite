import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireExportAccess } from "./utils/exportAccess";
import {
  exportColumnType,
  registerCriteria,
  registerProfile,
} from "./utils/exportContract";
import { requirePermission } from "./utils/permissions";
import { readRegisterPage } from "./utils/registerPages";
import {
  REGISTER_COLUMNS,
  REGISTER_PROFILE_VERSIONS,
} from "./utils/registerProfiles";
import { validateRegisterCriteria } from "./utils/registerSources";

const PREVIEW_ROWS = 10;

/**
 * First rows of a register from one bounded source page, with the typed
 * column schema the export will use. Run the export for the complete register.
 * `now` is the client's clock: the as-of when the criteria name none.
 */
export const preview = query({
  args: {
    organizationId: v.id("organizations"),
    profile: registerProfile,
    criteria: registerCriteria,
    now: v.number(),
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
    await requireExportAccess(
      ctx,
      args.organizationId,
      { kind: "register", profile: args.profile, criteria: args.criteria },
      (permission) => requirePermission(ctx, args.organizationId, permission),
    );
    await validateRegisterCriteria(
      ctx,
      args.organizationId,
      args.profile,
      args.criteria,
      args.now,
    );
    const page = await readRegisterPage(
      ctx,
      {
        organizationId: args.organizationId,
        profile: args.profile,
        criteria: args.criteria,
        asOf: args.criteria.asOf ?? args.now,
        capturedAt: null,
      },
      null,
    );
    return {
      profileVersion: REGISTER_PROFILE_VERSIONS[args.profile],
      columns: REGISTER_COLUMNS[args.profile],
      rows: page.rows.slice(0, PREVIEW_ROWS),
      pageRows: page.rows.length,
      scanned: page.scanned,
      hasMore: !page.done || page.rows.length > PREVIEW_ROWS,
    };
  },
});
