import { getAuthUserId } from "@convex-dev/auth/server";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { type MutationCtx, type QueryCtx, query } from "./_generated/server";
import { syncAccessionSearchDocument } from "./utils/accessionSearch";
import { syncCollectionOptionUsages } from "./utils/collectionOptionUsages";
import { custodyConflict } from "./utils/custodyErrors";
import { enforceObjectQuota } from "./utils/featureGates";
import {
  ensureIdentifierAvailable,
  findIdentifierMatches,
  generateConfiguredIdentifier,
  normalizeIdentifier,
} from "./utils/identifiers";
import {
  assertExitNotBlockedByExhibition,
  observedSourceMatches,
} from "./utils/loanCustody";
import {
  moveCollectionToLocation,
  recordCustodyDeparture,
  requireUsableLocation,
  visibleLocationName,
} from "./utils/locationIntegrity";
import { mutation } from "./utils/mutationBuilders";
import { entryError } from "./utils/objectEntryErrors";
import { entryForObject } from "./utils/objectEntryLifecycle";
import {
  entryPurposeValidator,
  entryStatusValidator,
} from "./utils/objectEntryValidators";
import { applyUsageCounterDelta } from "./utils/organizationUsageCounters";
import { partyDisplayName, requireLinkableParty } from "./utils/parties";
import { ENTRY_PARTY_ROLES, recordPartyLink } from "./utils/partyLinks";
import { canInitiateWorkflow, requirePermission } from "./utils/permissions";
import { emitWebhookEvent } from "./utils/webhookEvents";

const MAX_NAME_LENGTH = 300;
const MAX_TEXT_LENGTH = 4000;
/** Receipt times may run slightly ahead of the server clock. */
const CLOCK_SKEW_MS = 5 * 60 * 1000;
const NUMBERING_ATTEMPTS = 25;

async function requireUserId(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

/** Trimmed text, or undefined when blank; refuses text over `max`. */
function optionalText(
  value: string | undefined,
  max = MAX_TEXT_LENGTH,
): string | undefined {
  const text = value?.trim();
  if (!text) return undefined;
  if (text.length > max)
    throw entryError("TEXT_TOO_LONG", `Text must be at most ${max} characters`);
  return text;
}

function requireValidDate(value: number | undefined) {
  if (value !== undefined && (!Number.isFinite(value) || value < 0))
    throw entryError("DATES_INVALID", "Dates must be valid");
}

/** Due dates cannot fall before the property was received. */
function requireDueDates(
  receivedAt: number,
  dates: { decisionDueAt?: number; returnDueAt?: number },
) {
  for (const due of [dates.decisionDueAt, dates.returnDueAt]) {
    requireValidDate(due);
    if (due !== undefined && due < receivedAt)
      throw entryError(
        "DATES_INVALID",
        "Due dates cannot be earlier than the receipt",
      );
  }
}

async function requireMember(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  userId: Id<"users">,
) {
  const membership = await ctx.db
    .query("userOrganizations")
    .withIndex("by_user_and_organization", (q) =>
      q.eq("userId", userId).eq("organizationId", organizationId),
    )
    .first();
  if (!membership)
    throw entryError(
      "RESPONSIBLE_NOT_MEMBER",
      "The responsible staff member must belong to this organization",
    );
}

async function entryNumberTaken(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  entryNumber: string,
) {
  const key = normalizeIdentifier(entryNumber);
  const [entry, catalog] = await Promise.all([
    ctx.db
      .query("objectEntries")
      .withIndex("by_organization_and_normalizedEntryNumber", (q) =>
        q.eq("organizationId", organizationId).eq("normalizedEntryNumber", key),
      )
      .first(),
    findIdentifierMatches(ctx, organizationId, "catalog", entryNumber),
  ]);
  return entry !== null || catalog.matches.length > 0;
}

function requireIdentifierText(entryNumber: string) {
  const key = normalizeIdentifier(entryNumber);
  if (
    !key ||
    key.length > 256 ||
    [...entryNumber].some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  )
    throw entryError(
      "TEXT_TOO_LONG",
      "An entry number must contain 1-256 visible characters",
    );
}

async function nextEntryCounterValue(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  year: number,
) {
  const counter = await ctx.db
    .query("objectEntryCounters")
    .withIndex("by_organization_and_year", (q) =>
      q.eq("organizationId", organizationId).eq("year", year),
    )
    .unique();
  const now = Date.now();
  if (counter) {
    const currentValue = counter.currentValue + 1;
    await ctx.db.patch(counter._id, { currentValue, lastGeneratedAt: now });
    return currentValue;
  }
  await ctx.db.insert("objectEntryCounters", {
    organizationId,
    year,
    currentValue: 1,
    lastGeneratedAt: now,
  });
  return 1;
}

/**
 * The supplied entry number, or the next free `TE-<year>-<sequence>` for the
 * receipt year. Entry numbers become catalog identifiers, so both registers
 * must be free.
 */
async function assignEntryNumber(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  receivedAt: number,
  supplied: string | undefined,
) {
  if (supplied !== undefined) {
    const entryNumber = supplied.trim();
    requireIdentifierText(entryNumber);
    if (await entryNumberTaken(ctx, organizationId, entryNumber))
      throw entryError(
        "NUMBER_IN_USE",
        `Identifier '${entryNumber}' is already in use`,
      );
    return entryNumber;
  }
  const year = new Date(receivedAt).getUTCFullYear();
  for (let attempt = 0; attempt < NUMBERING_ATTEMPTS; attempt++) {
    const value = await nextEntryCounterValue(ctx, organizationId, year);
    const entryNumber = `TE-${year}-${String(value).padStart(4, "0")}`;
    if (!(await entryNumberTaken(ctx, organizationId, entryNumber)))
      return entryNumber;
  }
  throw entryError(
    "NUMBERING_EXHAUSTED",
    "Entry numbering found only occupied identifiers; supply an entry number",
  );
}

async function linkableParty(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  accountId: Id<"accounts"> | undefined,
) {
  return accountId
    ? await requireLinkableParty(ctx, organizationId, accountId)
    : null;
}

/**
 * Receives property into temporary custody. The object is catalogued at
 * receipt under the entry number and placed at the receiving location, so
 * custody, condition and identity history start here. Nothing asserts that
 * the institution owns it.
 */
export const receive = mutation({
  args: {
    organizationId: v.id("organizations"),
    entryNumber: v.optional(v.string()),
    purpose: entryPurposeValidator,
    purposeNote: v.optional(v.string()),
    depositorName: v.optional(v.string()),
    depositorAccountId: v.optional(v.id("accounts")),
    ownerName: v.optional(v.string()),
    ownerAccountId: v.optional(v.id("accounts")),
    receivedAt: v.number(),
    locationId: v.id("locations"),
    conditionAtEntry: v.string(),
    responsibleUserId: v.id("users"),
    responsibilityTerms: v.optional(v.string()),
    decisionDueAt: v.optional(v.number()),
    returnDueAt: v.optional(v.number()),
    notes: v.optional(v.string()),
    object: v.object({
      title: v.string(),
      objectName: v.optional(v.string()),
      description: v.optional(v.string()),
    }),
  },
  returns: v.object({
    entryId: v.id("objectEntries"),
    collectionId: v.id("collections"),
    entryNumber: v.string(),
  }),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const { organizationId } = args;
    await requirePermission(ctx, organizationId, "collections.create");

    const now = Date.now();
    requireValidDate(args.receivedAt);
    if (args.receivedAt > now + CLOCK_SKEW_MS)
      throw entryError("DATES_INVALID", "Receipt cannot be in the future");
    requireDueDates(args.receivedAt, args);
    const title = optionalText(args.object.title, MAX_NAME_LENGTH);
    if (!title) throw entryError("TITLE_REQUIRED", "A title is required");
    const conditionAtEntry = optionalText(args.conditionAtEntry);
    if (!conditionAtEntry)
      throw entryError(
        "CONDITION_REQUIRED",
        "Condition at receipt is required",
      );
    const [depositor, owner] = await Promise.all([
      linkableParty(ctx, organizationId, args.depositorAccountId),
      linkableParty(ctx, organizationId, args.ownerAccountId),
      requireMember(ctx, organizationId, args.responsibleUserId),
      requireUsableLocation(ctx, organizationId, args.locationId),
      enforceObjectQuota(ctx, organizationId),
    ] as const);
    const depositorName =
      optionalText(args.depositorName, MAX_NAME_LENGTH) ??
      (depositor ? partyDisplayName(depositor) : undefined);
    if (!depositorName)
      throw entryError(
        "DEPOSITOR_REQUIRED",
        "Record who deposited the property",
      );
    const ownerName =
      optionalText(args.ownerName, MAX_NAME_LENGTH) ??
      (owner ? partyDisplayName(owner) : undefined);
    const fields = {
      purposeNote: optionalText(args.purposeNote),
      responsibilityTerms: optionalText(args.responsibilityTerms),
      notes: optionalText(args.notes),
      objectName: optionalText(args.object.objectName, MAX_NAME_LENGTH),
      description: optionalText(args.object.description),
    };

    const entryNumber = await assignEntryNumber(
      ctx,
      organizationId,
      args.receivedAt,
      args.entryNumber,
    );
    const collectionId = await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: entryNumber,
      normalizedIdentifier: normalizeIdentifier(entryNumber),
      accessionNumberHistory: [
        { number: entryNumber, validFrom: args.receivedAt },
      ],
      title,
      objectName: fields.objectName,
      description: fields.description,
      status: "active",
      catalogedBy: userId,
      catalogedAt: now,
      lastModifiedBy: userId,
      lastModifiedAt: now,
    });
    await syncCollectionOptionUsages(ctx, collectionId);
    await applyUsageCounterDelta(ctx, organizationId, { objectCount: 1 });
    const object = await ctx.db.get(collectionId);
    if (!object) throw new Error("Object was not recorded");
    await moveCollectionToLocation(
      ctx,
      object,
      args.locationId,
      userId,
      `Received under entry ${entryNumber}`,
      { kind: "entry_receipt" },
    );

    const entryId = await ctx.db.insert("objectEntries", {
      organizationId,
      entryNumber,
      normalizedEntryNumber: normalizeIdentifier(entryNumber),
      collectionId,
      purpose: args.purpose,
      purposeNote: fields.purposeNote,
      depositorName,
      depositorAccountId: depositor?._id,
      ownerName,
      ownerAccountId: owner?._id,
      receivedAt: args.receivedAt,
      receivedBy: userId,
      receivedLocationId: args.locationId,
      conditionAtEntry,
      responsibleUserId: args.responsibleUserId,
      responsibilityTerms: fields.responsibilityTerms,
      decisionDueAt: args.decisionDueAt,
      returnDueAt: args.returnDueAt,
      notes: fields.notes,
      status: "in_custody",
    });

    for (const [role, party, assertedName] of [
      ["depositor", depositor, args.depositorName],
      ["owner", owner, args.ownerName],
    ] as const) {
      if (!party) continue;
      await recordPartyLink(ctx, {
        organizationId,
        target: { type: "entry", id: entryId },
        account: party,
        role,
        allowedRoles: ENTRY_PARTY_ROLES,
        effectiveFrom: args.receivedAt,
        assertedName,
        userId,
        origin: "staff",
      });
    }
    await Promise.all([
      ctx.runMutation(internal.audit.logAction, {
        organizationId,
        userId,
        action: "created_collection",
        entityType: "collection",
        entityId: collectionId,
        changes: {
          accessionNumber: entryNumber,
          title,
          source: `Entry ${entryNumber}`,
        },
      }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId,
        userId,
        action: "entry_received",
        entityType: "objectEntry",
        entityId: entryId,
        changes: {
          entryNumber,
          collectionId,
          purpose: args.purpose,
          depositorName,
          locationId: args.locationId,
        },
      }),
      emitWebhookEvent(ctx, organizationId, "collection.created", {
        collectionId,
        title,
      }),
    ]);
    return { entryId, collectionId, entryNumber };
  },
});

const entryObjectValidator = v.object({
  _id: v.id("collections"),
  identifier: v.string(),
  title: v.string(),
  status: v.string(),
  currentLocationName: v.union(v.string(), v.null()),
});

const entryAccessionValidator = v.object({
  _id: v.id("accessions"),
  accessionNumber: v.string(),
  status: v.string(),
  isDraft: v.boolean(),
});

const entryExitViewValidator = v.object({
  recipientName: v.string(),
  recipientAccountId: v.optional(v.id("accounts")),
  exitedAt: v.number(),
  reference: v.optional(v.string()),
  notes: v.optional(v.string()),
  fromLocationName: v.union(v.string(), v.null()),
  recordedByName: v.union(v.string(), v.null()),
  recordedAt: v.number(),
});

const entryViewValidator = v.object({
  _id: v.id("objectEntries"),
  _creationTime: v.number(),
  organizationId: v.id("organizations"),
  entryNumber: v.string(),
  status: entryStatusValidator,
  purpose: entryPurposeValidator,
  purposeNote: v.optional(v.string()),
  depositorName: v.string(),
  depositorAccountId: v.optional(v.id("accounts")),
  ownerName: v.optional(v.string()),
  ownerAccountId: v.optional(v.id("accounts")),
  receivedAt: v.number(),
  receivedByName: v.union(v.string(), v.null()),
  receivedLocationName: v.union(v.string(), v.null()),
  conditionAtEntry: v.string(),
  responsibleUserId: v.id("users"),
  responsibleName: v.union(v.string(), v.null()),
  responsibilityTerms: v.optional(v.string()),
  decisionDueAt: v.optional(v.number()),
  returnDueAt: v.optional(v.number()),
  notes: v.optional(v.string()),
  acquisitionDeclinedAt: v.optional(v.number()),
  accessionedAt: v.optional(v.number()),
  object: v.union(entryObjectValidator, v.null()),
  accession: v.union(entryAccessionValidator, v.null()),
  exit: v.union(entryExitViewValidator, v.null()),
});

function userName(user: Doc<"users"> | null) {
  return user?.name ?? user?.username ?? user?.email ?? null;
}

async function locationName(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  locationId: Id<"locations"> | undefined,
) {
  if (!locationId) return null;
  return (
    visibleLocationName(await ctx.db.get(locationId), organizationId) ?? null
  );
}

async function toEntryView(ctx: QueryCtx, entry: Doc<"objectEntries">) {
  const organizationId = entry.organizationId;
  const [object, accession, receivedBy, responsible, receivedLocationName] =
    await Promise.all([
      ctx.db.get(entry.collectionId),
      entry.accessionId ? ctx.db.get(entry.accessionId) : null,
      ctx.db.get(entry.receivedBy),
      ctx.db.get(entry.responsibleUserId),
      locationName(ctx, organizationId, entry.receivedLocationId),
    ] as const);
  const heldObject = object?.organizationId === organizationId ? object : null;
  const exit = entry.exit;
  return {
    _id: entry._id,
    _creationTime: entry._creationTime,
    organizationId,
    entryNumber: entry.entryNumber,
    status: entry.status,
    purpose: entry.purpose,
    purposeNote: entry.purposeNote,
    depositorName: entry.depositorName,
    depositorAccountId: entry.depositorAccountId,
    ownerName: entry.ownerName,
    ownerAccountId: entry.ownerAccountId,
    receivedAt: entry.receivedAt,
    receivedByName: userName(receivedBy),
    receivedLocationName,
    conditionAtEntry: entry.conditionAtEntry,
    responsibleUserId: entry.responsibleUserId,
    responsibleName: userName(responsible),
    responsibilityTerms: entry.responsibilityTerms,
    decisionDueAt: entry.decisionDueAt,
    returnDueAt: entry.returnDueAt,
    notes: entry.notes,
    acquisitionDeclinedAt: entry.acquisitionDeclinedAt,
    accessionedAt: entry.accessionedAt,
    object: heldObject
      ? {
          _id: heldObject._id,
          identifier: heldObject.accessionNumber,
          title: heldObject.title,
          status: heldObject.status,
          currentLocationName: await locationName(
            ctx,
            organizationId,
            heldObject.currentLocationId,
          ),
        }
      : null,
    accession:
      accession && accession.organizationId === organizationId
        ? {
            _id: accession._id,
            accessionNumber: accession.accessionNumber,
            status: accession.status,
            isDraft:
              accession.status === "pending" && accession.workflowStep === 0,
          }
        : null,
    exit: exit
      ? {
          recipientName: exit.recipientName,
          recipientAccountId: exit.recipientAccountId,
          exitedAt: exit.exitedAt,
          reference: exit.reference,
          notes: exit.notes,
          fromLocationName: await locationName(
            ctx,
            organizationId,
            exit.fromLocationId,
          ),
          recordedByName: userName(await ctx.db.get(exit.recordedBy)),
          recordedAt: exit.recordedAt,
        }
      : null,
  };
}

/** One entry with its object, acquisition case and exit, for staff who may read the collection. */
export const get = query({
  args: { entryId: v.id("objectEntries") },
  returns: v.union(entryViewValidator, v.null()),
  handler: async (ctx, args) => {
    await requireUserId(ctx);
    const entry = await ctx.db.get(args.entryId);
    if (!entry) return null;
    await requirePermission(ctx, entry.organizationId, "collections.read");
    return await toEntryView(ctx, entry);
  },
});

async function requireEntry(ctx: QueryCtx, entryId: Id<"objectEntries">) {
  const entry = await ctx.db.get(entryId);
  if (!entry) throw entryError("ENTRY_NOT_FOUND", "Entry not found");
  return entry;
}

function requireOpenEntry(entry: Doc<"objectEntries">) {
  if (entry.status === "accessioned" || entry.status === "exited")
    throw entryError(
      "ENTRY_CLOSED",
      `Entry ${entry.entryNumber} is already closed`,
    );
}

/**
 * Hands unaccessioned property to a recorded recipient: the depositor, the
 * owner or whoever they authorize. The object leaves custody and is withdrawn
 * from routine views; no deaccession is recorded because nothing was
 * accessioned. Refused while an acquisition case is open.
 */
export const recordExit = mutation({
  args: {
    entryId: v.id("objectEntries"),
    recipientName: v.optional(v.string()),
    recipientAccountId: v.optional(v.id("accounts")),
    exitedAt: v.number(),
    reference: v.optional(v.string()),
    notes: v.optional(v.string()),
    /** Where staff saw the object; a mismatch refuses the exit. */
    observedFromLocationId: v.optional(v.union(v.id("locations"), v.null())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const entry = await requireEntry(ctx, args.entryId);
    const { organizationId } = entry;
    await requirePermission(ctx, organizationId, "collections.update");
    requireOpenEntry(entry);
    if (entry.status === "acquisition_review")
      throw entryError(
        "ACQUISITION_OPEN",
        "Withdraw the open acquisition before recording an exit",
      );
    const now = Date.now();
    requireValidDate(args.exitedAt);
    if (args.exitedAt < entry.receivedAt || args.exitedAt > now + CLOCK_SKEW_MS)
      throw entryError(
        "DATES_INVALID",
        "The exit must fall between the receipt and now",
      );
    const recipient = await linkableParty(
      ctx,
      organizationId,
      args.recipientAccountId,
    );
    const recipientName =
      optionalText(args.recipientName, MAX_NAME_LENGTH) ??
      (recipient ? partyDisplayName(recipient) : undefined);
    if (!recipientName)
      throw entryError(
        "RECIPIENT_REQUIRED",
        "Record who received the property",
      );
    const reference = optionalText(args.reference, MAX_NAME_LENGTH);
    const notes = optionalText(args.notes);

    const object = await ctx.db.get(entry.collectionId);
    if (!object || object.organizationId !== organizationId)
      throw custodyConflict(
        "REFERENCE_NOT_FOUND",
        "The entry's object is not held by this organization",
      );
    await assertExitNotBlockedByExhibition(
      ctx,
      object._id,
      "Cannot return an object while its exhibition outcome is unresolved",
    );
    if (
      !observedSourceMatches(
        args.observedFromLocationId,
        object.currentLocationId,
      )
    )
      throw custodyConflict(
        "SOURCE_CHANGED",
        "Object is not at the source observed for this exit",
        {
          currentLocationName: await locationName(
            ctx,
            organizationId,
            object.currentLocationId,
          ),
        },
      );
    const fromLocationId = object.currentLocationId;
    const reason = `Returned under entry ${entry.entryNumber} to ${recipientName}`;
    const movementId = await recordCustodyDeparture(
      ctx,
      object,
      userId,
      reason,
      { kind: "entry_exit", notes },
    );
    await ctx.db.patch(object._id, {
      status: "archived",
      currentLocationId: undefined,
      archivedAt: now,
      archivedBy: userId,
      archivedReason: reason,
      lastModifiedBy: userId,
      lastModifiedAt: now,
    });
    await ctx.db.patch(entry._id, {
      status: "exited",
      exit: {
        recipientName,
        recipientAccountId: recipient?._id,
        exitedAt: args.exitedAt,
        reference,
        notes,
        fromLocationId,
        movementId: movementId ?? undefined,
        recordedBy: userId,
        recordedAt: now,
      },
    });
    if (recipient)
      await recordPartyLink(ctx, {
        organizationId,
        target: { type: "entry", id: entry._id },
        account: recipient,
        role: "recipient",
        allowedRoles: ENTRY_PARTY_ROLES,
        effectiveFrom: args.exitedAt,
        assertedName: args.recipientName,
        userId,
        origin: "staff",
      });
    await ctx.runMutation(internal.audit.logAction, {
      organizationId,
      userId,
      action: "entry_exited",
      entityType: "objectEntry",
      entityId: entry._id,
      changes: {
        entryNumber: entry.entryNumber,
        collectionId: object._id,
        recipientName,
        exitedAt: args.exitedAt,
        reference,
      },
    });
    return null;
  },
});

const acquisitionMethodValidator = v.union(
  v.literal("purchase"),
  v.literal("gift"),
  v.literal("transfer"),
  v.literal("donation"),
  v.literal("bequest"),
  v.literal("other"),
);

/** The accession initiation rule, exactly as for intakes started elsewhere. */
async function requireAcquisitionInitiator(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
) {
  const organization = await ctx.db.get(organizationId);
  if (organization?.settings?.accessionWorkflowEnabled ?? true) {
    if (!(await canInitiateWorkflow(ctx, organizationId, "accession")))
      throw new Error("Permission denied: cannot initiate accession workflow");
    return;
  }
  await requirePermission(ctx, organizationId, "collections.create");
}

/**
 * Starts the acquisition branch: a draft accession case for the entry's
 * object, naming the recorded owner as the source of title. Title evidence
 * and approval follow the institution's accession policy; until approval
 * the object stays in temporary custody under its entry number.
 */
export const beginAcquisition = mutation({
  args: {
    entryId: v.id("objectEntries"),
    method: acquisitionMethodValidator,
    accessionNumber: v.optional(v.string()),
    cost: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  returns: v.id("accessions"),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const entry = await requireEntry(ctx, args.entryId);
    const { organizationId } = entry;
    await requireAcquisitionInitiator(ctx, organizationId);
    requireOpenEntry(entry);
    if (entry.status !== "in_custody")
      throw entryError(
        "NOT_IN_CUSTODY",
        `Entry ${entry.entryNumber} already has an open acquisition`,
      );
    if (!entry.ownerName)
      throw entryError(
        "OWNER_REQUIRED",
        "Record the owner before beginning an acquisition",
      );
    if (
      args.cost !== undefined &&
      (!Number.isFinite(args.cost) || args.cost < 0)
    )
      throw new Error("Cost must be a non-negative number");
    const notes = optionalText(args.notes);
    const supplied = args.accessionNumber?.trim();
    const accessionNumber = supplied
      ? supplied
      : await generateConfiguredIdentifier(ctx, organizationId, "accession");
    if (supplied)
      await ensureIdentifierAvailable(
        ctx,
        organizationId,
        "accession",
        accessionNumber,
      );
    // The object takes this identifier on approval; refuse a clash now.
    await ensureIdentifierAvailable(
      ctx,
      organizationId,
      "catalog",
      accessionNumber,
      entry.collectionId,
    );
    const owner = entry.ownerAccountId
      ? await requireLinkableParty(ctx, organizationId, entry.ownerAccountId, {
          allowArchived: true,
        })
      : null;

    const now = Date.now();
    const accessionId = await ctx.db.insert("accessions", {
      organizationId,
      accessionNumber,
      normalizedIdentifier: normalizeIdentifier(accessionNumber),
      collectionId: entry.collectionId,
      entryId: entry._id,
      dateReceived: entry.receivedAt,
      source: entry.ownerName,
      method: args.method,
      cost: args.cost,
      notes,
      status: "pending",
      workflowStep: 0,
      workflowHistory: [
        {
          step: 0,
          approvedBy: userId,
          approvedAt: now,
          comment: `Acquisition begun from entry ${entry.entryNumber}`,
        },
      ],
    });
    await ctx.db.patch(entry._id, {
      status: "acquisition_review",
      accessionId,
    });
    if (owner)
      await recordPartyLink(ctx, {
        organizationId,
        target: { type: "accession", id: accessionId },
        account: owner,
        role: "owner",
        allowedRoles: ["owner"],
        effectiveFrom: entry.receivedAt,
        assertedName: entry.ownerName,
        userId,
        origin: "staff",
      });
    await Promise.all([
      syncAccessionSearchDocument(ctx, accessionId),
      ctx.runMutation(internal.audit.logAction, {
        organizationId,
        userId,
        action: "created",
        entityType: "accession",
        entityId: accessionId,
        changes: {
          accessionNumber,
          status: "pending",
          collectionId: entry.collectionId,
          entryId: entry._id,
        },
      }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId,
        userId,
        action: "entry_acquisition_begun",
        entityType: "objectEntry",
        entityId: entry._id,
        changes: {
          entryNumber: entry.entryNumber,
          collectionId: entry.collectionId,
          accessionId,
          method: args.method,
        },
      }),
    ]);
    return accessionId;
  },
});

const entryListItemValidator = v.object({
  entryId: v.id("objectEntries"),
  entryNumber: v.string(),
  status: entryStatusValidator,
  purpose: entryPurposeValidator,
  depositorName: v.string(),
  receivedAt: v.number(),
  decisionDueAt: v.optional(v.number()),
  returnDueAt: v.optional(v.number()),
  acquisitionDeclinedAt: v.optional(v.number()),
  objectId: v.id("collections"),
  objectTitle: v.union(v.string(), v.null()),
  responsibleName: v.union(v.string(), v.null()),
});

/** Entries newest receipt first, optionally in one status. */
export const list = query({
  args: {
    organizationId: v.id("organizations"),
    status: v.optional(entryStatusValidator),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(entryListItemValidator),
  handler: async (ctx, args) => {
    await requireUserId(ctx);
    const { organizationId, status } = args;
    await requirePermission(ctx, organizationId, "collections.read");
    const result = status
      ? await ctx.db
          .query("objectEntries")
          .withIndex("by_organization_and_status_and_receivedAt", (q) =>
            q.eq("organizationId", organizationId).eq("status", status),
          )
          .order("desc")
          .paginate(args.paginationOpts)
      : await ctx.db
          .query("objectEntries")
          .withIndex("by_organization_and_receivedAt", (q) =>
            q.eq("organizationId", organizationId),
          )
          .order("desc")
          .paginate(args.paginationOpts);
    const page = await Promise.all(
      result.page.map(async (entry) => {
        const [object, responsible] = await Promise.all([
          ctx.db.get(entry.collectionId),
          ctx.db.get(entry.responsibleUserId),
        ] as const);
        return {
          entryId: entry._id,
          entryNumber: entry.entryNumber,
          status: entry.status,
          purpose: entry.purpose,
          depositorName: entry.depositorName,
          receivedAt: entry.receivedAt,
          decisionDueAt: entry.decisionDueAt,
          returnDueAt: entry.returnDueAt,
          acquisitionDeclinedAt: entry.acquisitionDeclinedAt,
          objectId: entry.collectionId,
          objectTitle:
            object?.organizationId === organizationId ? object.title : null,
          responsibleName: userName(responsible),
        };
      }),
    );
    return { ...result, page };
  },
});

/** The entry an object was received under, for the object's record. */
export const getForObject = query({
  args: { collectionId: v.id("collections") },
  returns: v.union(
    v.object({
      _id: v.id("objectEntries"),
      entryNumber: v.string(),
      status: entryStatusValidator,
      purpose: entryPurposeValidator,
      depositorName: v.string(),
      ownerName: v.optional(v.string()),
      receivedAt: v.number(),
      conditionAtEntry: v.string(),
      returnDueAt: v.optional(v.number()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    await requireUserId(ctx);
    const object = await ctx.db.get(args.collectionId);
    if (!object) return null;
    await requirePermission(ctx, object.organizationId, "collections.read");
    const entry = await entryForObject(ctx, object._id);
    if (!entry || entry.organizationId !== object.organizationId) return null;
    return {
      _id: entry._id,
      entryNumber: entry.entryNumber,
      status: entry.status,
      purpose: entry.purpose,
      depositorName: entry.depositorName,
      ownerName: entry.ownerName,
      receivedAt: entry.receivedAt,
      conditionAtEntry: entry.conditionAtEntry,
      returnDueAt: entry.returnDueAt,
    };
  },
});

/**
 * Corrects the working details of an open entry. Receipt facts (who
 * deposited what, when, where and in what condition) are evidence and stay
 * as recorded; parties change through party links.
 */
export const update = mutation({
  args: {
    entryId: v.id("objectEntries"),
    purposeNote: v.optional(v.string()),
    responsibleUserId: v.optional(v.id("users")),
    responsibilityTerms: v.optional(v.string()),
    decisionDueAt: v.optional(v.union(v.number(), v.null())),
    returnDueAt: v.optional(v.union(v.number(), v.null())),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const entry = await requireEntry(ctx, args.entryId);
    const { organizationId } = entry;
    await requirePermission(ctx, organizationId, "collections.update");
    requireOpenEntry(entry);
    if (args.responsibleUserId)
      await requireMember(ctx, organizationId, args.responsibleUserId);
    const dueDate = (value: number | null | undefined, current?: number) =>
      value === undefined ? current : (value ?? undefined);
    const decisionDueAt = dueDate(args.decisionDueAt, entry.decisionDueAt);
    const returnDueAt = dueDate(args.returnDueAt, entry.returnDueAt);
    requireDueDates(entry.receivedAt, { decisionDueAt, returnDueAt });
    const text = (value: string | undefined, current?: string) =>
      value === undefined ? current : optionalText(value);
    const changes = {
      purposeNote: text(args.purposeNote, entry.purposeNote),
      responsibleUserId: args.responsibleUserId ?? entry.responsibleUserId,
      responsibilityTerms: text(
        args.responsibilityTerms,
        entry.responsibilityTerms,
      ),
      decisionDueAt,
      returnDueAt,
      notes: text(args.notes, entry.notes),
    };
    await ctx.db.patch(entry._id, changes);
    await ctx.runMutation(internal.audit.logAction, {
      organizationId,
      userId,
      action: "entry_updated",
      entityType: "objectEntry",
      entityId: entry._id,
      changes: {
        entryNumber: entry.entryNumber,
        collectionId: entry.collectionId,
        ...changes,
      },
    });
    return null;
  },
});
