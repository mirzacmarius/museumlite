import { type Infer, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { evaluateCapability } from "./capabilities";
import {
  APPROVAL_CASE_TYPES,
  type ApprovalCaseType,
  CASE_TYPES,
  type CaseRecord,
  caseLabel,
  waitingApproval,
} from "./caseTypes";
import { organizationAccess } from "./featureGates";
import {
  PENDING_IMAGE_DELETION_LIMIT,
  resolveImageDeletionApproval,
} from "./imageDeletion";
import {
  getCurrentUserOrganization,
  getRolePermissionNames,
  hasPermission,
  resolveCaseApproval,
} from "./permissions";
import type { ColumnPage } from "./workBoardColumns";

const DAY = 24 * 60 * 60 * 1000;

const approvalTypeValidator = v.union(
  v.literal("accession"),
  v.literal("deaccession"),
  v.literal("loan"),
  v.literal("exhibition"),
  v.literal("conservation"),
  v.literal("imageDeletion"),
);

export type ApprovalType = Infer<typeof approvalTypeValidator>;

export const pendingApprovalValidator = v.object({
  /** The waiting case, or the image deletion request. */
  _id: v.string(),
  type: approvalTypeValidator,
  /** The case's label, or the image's file name. */
  label: v.string(),
  detail: v.optional(v.string()),
  workflowStep: v.optional(v.number()),
  waitingSince: v.number(),
  /** Past its SLA, or waiting for more than a week. */
  urgent: v.boolean(),
});

type PendingApproval = Infer<typeof pendingApprovalValidator>;

export const approvalCountsValidator = v.object({
  accession: v.number(),
  deaccession: v.number(),
  loan: v.number(),
  exhibition: v.number(),
  conservation: v.number(),
  imageDeletion: v.number(),
});

/**
 * Whether the viewer may approve a case of this kind at its workflow step and
 * open the list its card links to.
 */
async function loadCanActOnApproval(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
) {
  const [membership, organization] = await Promise.all([
    getCurrentUserOrganization(ctx, organizationId),
    ctx.db.get(organizationId),
  ]);
  const permissions = membership
    ? await getRolePermissionNames(ctx, membership.roleId)
    : [];
  const canOpenList = (caseType: ApprovalCaseType) => {
    const { readPermission, approval } = CASE_TYPES[caseType];
    if (!approval.listCapability) return permissions.includes(readPermission);
    return (
      organization !== null &&
      evaluateCapability(
        approval.listCapability,
        organizationAccess(organization),
        permissions,
      ).status === "available"
    );
  };
  const decisions = new Map<string, Promise<boolean>>();
  return (caseType: ApprovalCaseType, workflowStep: number | undefined) => {
    const key = `${caseType}:${workflowStep}`;
    let decision = decisions.get(key);
    if (!decision) {
      decision = canOpenList(caseType)
        ? resolveCaseApproval(ctx, organizationId, caseType, workflowStep).then(
            (approval) => approval.allowed,
          )
        : Promise.resolve(false);
      decisions.set(key, decision);
    }
    return decision;
  };
}

/** Every case of this kind in the status it waits for approval in. */
async function casesInApprovalStatus(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  caseType: ApprovalCaseType,
): Promise<CaseRecord<ApprovalCaseType>[]> {
  const { table, approval } = CASE_TYPES[caseType];
  const docs = await ctx.db
    .query(table)
    .withIndex("by_organization_and_status", (q) =>
      q.eq("organizationId", organizationId).eq("status", approval.status),
    )
    .collect();
  // Each document comes from this case type's own table.
  return docs.map((doc) => ({ caseType, doc }) as CaseRecord<ApprovalCaseType>);
}

/**
 * Image deletions waiting for approval, when the viewer may decide them and
 * open the page that lists them.
 */
async function loadPendingImageDeletions(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
) {
  const [canOpenPage, approval] = await Promise.all([
    hasPermission(ctx, organizationId, "media.read"),
    resolveImageDeletionApproval(ctx, organizationId),
  ]);
  if (!canOpenPage || !approval.allowed) return { requests: [], more: false };
  const requests = await ctx.db
    .query("mediaDeletionRequests")
    .withIndex("by_organization_and_status_and_requestedAt", (q) =>
      q.eq("organizationId", organizationId).eq("status", "pending"),
    )
    .take(PENDING_IMAGE_DELETION_LIMIT + 1);
  return {
    requests: await Promise.all(
      requests.slice(0, PENDING_IMAGE_DELETION_LIMIT).map(async (request) => ({
        ...request,
        objectTitle: (await ctx.db.get(request.collectionId))?.title,
      })),
    ),
    more: requests.length > PENDING_IMAGE_DELETION_LIMIT,
  };
}

/**
 * Cases and image deletions the viewer may approve now, most pressing first:
 * past their SLA, then waiting longest. Counts per kind cover every one, not
 * only the cards shown, except image deletions past the first
 * PENDING_IMAGE_DELETION_LIMIT, which `moreImageDeletions` flags.
 */
export async function readPendingApprovals(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  now: number,
  limit: number,
): Promise<
  ColumnPage<PendingApproval> & {
    byType: Record<ApprovalType, number>;
    moreImageDeletions: boolean;
  }
> {
  const [canActOn, slaConfigs, waiting, imageDeletions] = await Promise.all([
    loadCanActOnApproval(ctx, organizationId),
    ctx.db
      .query("workflowSlaConfigs")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .collect(),
    Promise.all(
      APPROVAL_CASE_TYPES.map((caseType) =>
        casesInApprovalStatus(ctx, organizationId, caseType),
      ),
    ),
    loadPendingImageDeletions(ctx, organizationId),
  ]);

  const ranked = (
    await Promise.all(
      waiting.flat().map(async (record) => {
        const card = waitingApproval(record);
        if (
          !card ||
          !(await canActOn(record.caseType, record.doc.workflowStep))
        ) {
          return [];
        }
        const slaDays = slaConfigs.find(
          (config) => config.workflowType === record.caseType,
        )?.slaDays;
        return [
          rank(
            {
              _id: record.doc._id,
              type: record.caseType,
              label: caseLabel(record),
              detail: card.detail,
              workflowStep: record.doc.workflowStep ?? 1,
              waitingSince: card.waitingSince,
            },
            now,
            slaDays,
          ),
        ];
      }),
    )
  ).flat();
  for (const request of imageDeletions.requests) {
    ranked.push(
      rank(
        {
          _id: request._id,
          type: "imageDeletion",
          label: request.fileName,
          detail: request.objectTitle,
          waitingSince: request.requestedAt,
        },
        now,
        undefined,
      ),
    );
  }
  ranked.sort(
    (a, b) =>
      Number(b.breached) - Number(a.breached) ||
      a.level - b.level ||
      a.card.waitingSince - b.card.waitingSince ||
      a.card._id.localeCompare(b.card._id),
  );

  const byType: Record<ApprovalType, number> = {
    accession: 0,
    deaccession: 0,
    loan: 0,
    exhibition: 0,
    conservation: 0,
    imageDeletion: 0,
  };
  for (const { card } of ranked) byType[card.type] += 1;
  return {
    cards: ranked.slice(0, limit).map(({ card }) => card),
    hasMore: ranked.length > limit || imageDeletions.more,
    byType,
    moreImageDeletions: imageDeletions.more,
  };
}

/**
 * Past its SLA ranks first, then waiting over a week, then over three days.
 * Kinds without an SLA are never past it.
 */
function rank(
  approval: Omit<PendingApproval, "urgent">,
  now: number,
  slaDays: number | undefined,
) {
  const age = now - approval.waitingSince;
  const breached = !!slaDays && age > slaDays * DAY;
  const level = breached || age > 7 * DAY ? 0 : age > 3 * DAY ? 1 : 2;
  return { breached, level, card: { ...approval, urgent: level === 0 } };
}
