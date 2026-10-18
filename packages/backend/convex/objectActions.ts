import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { findWaitingDeaccession } from "./deaccessions";
import { deaccessionInitiationState } from "./utils/deaccessionInitiation";
import { isCollectionOnLoan } from "./utils/loanOccupancy";
import {
  isHeldUnderOpenEntry,
  isUnaccessionedEntryObject,
} from "./utils/objectEntryLifecycle";
import { hasPermission } from "./utils/permissions";
import { canReadRecord } from "./utils/recordAccess";
import {
  getWorkflowConfig,
  isDeaccessionWorkflowEnabled,
} from "./utils/workflowConfigs";

const hidden = v.object({ state: v.literal("hidden") });

const deaccessionActionValidator = v.union(
  hidden,
  v.object({
    state: v.literal("blocked"),
    reason: v.union(v.literal("on_loan"), v.literal("not_accessioned")),
  }),
  v.object({
    state: v.literal("in_progress"),
    deaccessionId: v.id("deaccessions"),
  }),
  // Without approval steps the request may still wait for an approver when
  // decision checks fail; `deaccessions.create` decides that per request.
  v.object({ state: v.literal("available"), approvalSteps: v.number() }),
);

const removeActionValidator = v.union(
  hidden,
  v.object({
    state: v.literal("blocked"),
    reason: v.union(v.literal("on_loan"), v.literal("not_accessioned")),
  }),
  v.object({ state: v.literal("available") }),
);

/** Withdrawn, deaccessioned or exited objects are restored, not removed. */
function isInCatalog(collection: Doc<"collections">) {
  return collection.status === "active" || collection.status === "loaned";
}

/**
 * What the Object allows now, from the same guards `deaccessions.create` and
 * `collections.archiveCollection` run: hidden without access, blocked with
 * the reason the mutation would refuse, otherwise available. Null when the
 * caller is not a member of the Object's organization.
 */
export const get = query({
  args: { collectionId: v.id("collections") },
  returns: v.union(
    v.object({
      deaccession: deaccessionActionValidator,
      remove: removeActionValidator,
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const [userId, collection] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.collectionId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (
      !collection ||
      !(await canReadRecord(ctx, collection.organizationId, "collections.read"))
    ) {
      return null;
    }
    const { organizationId } = collection;

    const [initiation, canRemove, onLoan, unaccessioned, openEntry, waiting] =
      await Promise.all([
        deaccessionInitiationState(ctx, organizationId, userId),
        hasPermission(ctx, organizationId, "collections.delete"),
        isCollectionOnLoan(ctx, collection._id),
        isUnaccessionedEntryObject(ctx, collection._id),
        isHeldUnderOpenEntry(ctx, collection._id),
        findWaitingDeaccession(ctx, organizationId, collection._id),
      ]);

    const deaccession = async () => {
      if (initiation?.status !== "available" || !isInCatalog(collection)) {
        return { state: "hidden" as const };
      }
      if (waiting) {
        return { state: "in_progress" as const, deaccessionId: waiting._id };
      }
      if (unaccessioned) {
        return {
          state: "blocked" as const,
          reason: "not_accessioned" as const,
        };
      }
      if (onLoan) {
        return { state: "blocked" as const, reason: "on_loan" as const };
      }
      const workflowConfig = (await isDeaccessionWorkflowEnabled(
        ctx,
        organizationId,
      ))
        ? await getWorkflowConfig(ctx, organizationId, "deaccession")
        : null;
      return {
        state: "available" as const,
        approvalSteps: workflowConfig?.steps.length ?? 0,
      };
    };

    const remove = () => {
      if (!canRemove || !isInCatalog(collection)) {
        return { state: "hidden" as const };
      }
      if (onLoan) {
        return { state: "blocked" as const, reason: "on_loan" as const };
      }
      if (openEntry) {
        return {
          state: "blocked" as const,
          reason: "not_accessioned" as const,
        };
      }
      return { state: "available" as const };
    };

    return { deaccession: await deaccession(), remove: remove() };
  },
});
