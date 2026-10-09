import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import * as objectEntries from "../convex/objectEntries";
import {
  type EntryErrorData,
  entryErrorFromError,
} from "../convex/utils/objectEntryErrors";
import { expectMatchesReturns } from "./returnsValidation";
import {
  authedForUser,
  type ConvexTest,
  createConvexTest,
  createOrgUserWithPermissions,
  custodyConflictOf,
  rebuildProjection,
} from "./testHarness";

const T0 = Date.UTC(2026, 3, 14, 9);
const DAY = 24 * 60 * 60 * 1000;

const REGISTRAR_PERMISSIONS = [
  "collections.create",
  "collections.read",
  "collections.update",
  "collections.approve_accession",
  "locations.read",
  "loans.read",
  "accounts.read",
];

type Client = ReturnType<typeof authedForUser>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});

afterEach(() => {
  vi.useRealTimers();
});

async function createMuseum(
  t: ConvexTest,
  permissions: string[] = REGISTRAR_PERMISSIONS,
) {
  const setup = await createOrgUserWithPermissions(t, permissions, {
    subscriptionTier: "pro",
    enabledModules: ["accounts"],
    roleName: "Registrar",
  });
  const locationId = await t.run((ctx) =>
    ctx.db.insert("locations", {
      organizationId: setup.organizationId,
      name: "Receiving room",
      type: "storage",
      sortOrder: 0,
      isActive: true,
    }),
  );
  return { ...setup, locationId, staff: authedForUser(t, setup.userId) };
}
type Museum = Awaited<ReturnType<typeof createMuseum>>;

async function insertParty(
  t: ConvexTest,
  museum: Museum,
  businessName: string,
) {
  return await t.run((ctx) =>
    ctx.db.insert("accounts", {
      organizationId: museum.organizationId,
      accountNumber: `ACC-${Math.random().toString(36).slice(2, 7)}`,
      accountType: "institution",
      businessName,
      createdBy: museum.userId,
      createdAt: T0,
    }),
  );
}

async function entryErrorOf(call: Promise<unknown>): Promise<EntryErrorData> {
  try {
    await call;
  } catch (error) {
    const data = entryErrorFromError(error);
    if (!data) throw error;
    return data;
  }
  throw new Error("Expected the call to be rejected");
}

function receiveArgs(museum: Museum) {
  return {
    organizationId: museum.organizationId,
    purpose: "deposit" as const,
    depositorName: "Ana Popescu",
    ownerName: "Ana Popescu",
    receivedAt: T0,
    locationId: museum.locationId,
    conditionAtEntry: "Good; light surface dust",
    responsibleUserId: museum.userId,
    responsibilityTerms: "Depositor insures while held",
    returnDueAt: T0 + 30 * DAY,
    object: { title: "Silver brooch", description: "Filigree, c. 1900" },
  };
}

async function receive(
  museum: Museum,
  overrides: Partial<ReturnType<typeof receiveArgs>> = {},
) {
  return await museum.staff.mutation(api.objectEntries.receive, {
    ...receiveArgs(museum),
    ...overrides,
  });
}

async function getEntry(client: Client, entryId: Id<"objectEntries">) {
  const entry = await client.query(api.objectEntries.get, { entryId });
  expectMatchesReturns(objectEntries.get, entry);
  if (!entry) throw new Error("Entry not found");
  return entry;
}

describe("receiving property into temporary custody", () => {
  test("creates one object, held at the receiving location, under a temporary number", async () => {
    const t = createConvexTest();
    const museum = await createMuseum(t);

    const { entryId, collectionId, entryNumber } = await receive(museum);

    expect(entryNumber).toBe("TE-2026-0001");
    const entry = await getEntry(museum.staff, entryId);
    expect(entry).toMatchObject({
      entryNumber: "TE-2026-0001",
      status: "in_custody",
      purpose: "deposit",
      depositorName: "Ana Popescu",
      ownerName: "Ana Popescu",
      receivedAt: T0,
      receivedLocationName: "Receiving room",
      conditionAtEntry: "Good; light surface dust",
      responsibleName: "Test User",
      responsibilityTerms: "Depositor insures while held",
      returnDueAt: T0 + 30 * DAY,
      object: {
        _id: collectionId,
        identifier: "TE-2026-0001",
        title: "Silver brooch",
        currentLocationName: "Receiving room",
      },
      accession: null,
      exit: null,
    });

    const [object, movements] = await t.run(async (ctx) => [
      await ctx.db.get(collectionId),
      await ctx.db
        .query("locationHistory")
        .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
        .collect(),
    ]);
    expect(object).toMatchObject({
      accessionNumber: "TE-2026-0001",
      status: "active",
      currentLocationId: museum.locationId,
    });
    expect(movements).toMatchObject([
      {
        toLocationId: museum.locationId,
        movementKind: "entry_receipt",
        movedBy: museum.userId,
      },
    ]);
  });

  test("numbers entries per year and accepts a staff-supplied unused number", async () => {
    const t = createConvexTest();
    const museum = await createMuseum(t);

    const first = await receive(museum);
    const second = await receive(museum, { object: { title: "Ring" } });
    const supplied = await receive(museum, {
      entryNumber: "DEP/2026/7",
      object: { title: "Locket" },
    });

    expect([
      first.entryNumber,
      second.entryNumber,
      supplied.entryNumber,
    ]).toEqual(["TE-2026-0001", "TE-2026-0002", "DEP/2026/7"]);
    expect(
      (
        await entryErrorOf(
          receive(museum, {
            entryNumber: "dep/2026/7",
            object: { title: "Duplicate" },
          }),
        )
      ).code,
    ).toBe("ENTRY_NUMBER_IN_USE");
  });
});

describe("entry validation and access", () => {
  test("refuses incomplete or inconsistent receipts without writing anything", async () => {
    const t = createConvexTest();
    const museum = await createMuseum(t);
    const outsider = await createOrgUserWithPermissions(t, [
      "collections.read",
    ]);
    const foreignLocation = await t.run((ctx) =>
      ctx.db.insert("locations", {
        organizationId: outsider.organizationId,
        name: "Elsewhere",
        type: "storage",
        sortOrder: 0,
        isActive: true,
      }),
    );

    const codes = [];
    for (const overrides of [
      { depositorName: "  " },
      { conditionAtEntry: "" },
      { object: { title: " " } },
      { returnDueAt: T0 - DAY },
      { decisionDueAt: T0 - 1 },
      { receivedAt: T0 + 2 * DAY },
      { responsibleUserId: outsider.userId },
    ]) {
      codes.push((await entryErrorOf(receive(museum, overrides))).code);
    }
    expect(codes).toEqual([
      "ENTRY_DEPOSITOR_REQUIRED",
      "ENTRY_CONDITION_REQUIRED",
      "ENTRY_TITLE_REQUIRED",
      "ENTRY_DATES_INVALID",
      "ENTRY_DATES_INVALID",
      "ENTRY_DATES_INVALID",
      "ENTRY_RESPONSIBLE_NOT_MEMBER",
    ]);
    expect(
      (
        await custodyConflictOf(
          receive(museum, { locationId: foreignLocation }),
        )
      )?.code,
    ).toBe("REFERENCE_NOT_FOUND");

    const written = await t.run(async (ctx) => ({
      objects: await ctx.db.query("collections").collect(),
      entries: await ctx.db.query("objectEntries").collect(),
    }));
    expect(written).toEqual({ objects: [], entries: [] });
  });

  test("only staff who may catalogue can receive, and only members can read an entry", async () => {
    const t = createConvexTest();
    const museum = await createMuseum(t);
    const reader = await createOrgUserWithPermissions(t, ["collections.read"]);
    await t.run(async (ctx) => {
      const roleId = await ctx.db.insert("roles", {
        organizationId: museum.organizationId,
        name: "Viewer",
        isSystemRole: false,
      });
      const permissionId = await ctx.db.insert("permissions", {
        name: "collections.read",
        category: "collections",
      });
      await ctx.db.insert("rolePermissions", { roleId, permissionId });
      await ctx.db.insert("userOrganizations", {
        userId: reader.userId,
        organizationId: museum.organizationId,
        roleId,
        joinedAt: T0,
      });
    });
    const readerInMuseum = authedForUser(t, reader.userId);
    const outsider = await createOrgUserWithPermissions(
      t,
      REGISTRAR_PERMISSIONS,
    );

    await expect(
      readerInMuseum.mutation(api.objectEntries.receive, receiveArgs(museum)),
    ).rejects.toThrow();
    const { entryId } = await receive(museum);
    expect((await getEntry(readerInMuseum, entryId)).entryNumber).toBe(
      "TE-2026-0001",
    );
    await expect(
      authedForUser(t, outsider.userId).query(api.objectEntries.get, {
        entryId,
      }),
    ).rejects.toThrow();
    await expect(t.query(api.objectEntries.get, { entryId })).rejects.toThrow();
  });

  test("reuses depositor and owner parties and records their roles on the entry", async () => {
    const t = createConvexTest();
    const museum = await createMuseum(t);
    const depositorId = await insertParty(t, museum, "Popescu Family Trust");
    const ownerId = await insertParty(t, museum, "Ana Popescu");
    const outsider = await createOrgUserWithPermissions(t, [], {
      enabledModules: ["accounts"],
    });
    const foreignParty = await t.run((ctx) =>
      ctx.db.insert("accounts", {
        organizationId: outsider.organizationId,
        accountNumber: "ACC-FOREIGN",
        accountType: "institution",
        businessName: "Elsewhere",
        createdBy: outsider.userId,
        createdAt: T0,
      }),
    );

    const { entryId } = await receive(museum, {
      depositorName: undefined,
      depositorAccountId: depositorId,
      ownerName: undefined,
      ownerAccountId: ownerId,
    });

    const entry = await getEntry(museum.staff, entryId);
    expect(entry).toMatchObject({
      depositorName: "Popescu Family Trust",
      depositorAccountId: depositorId,
      ownerName: "Ana Popescu",
      ownerAccountId: ownerId,
    });
    const { links, allowedRoles, policy } = await museum.staff.query(
      api.partyLinks.listForTarget,
      { target: { type: "entry", id: entryId } },
    );
    expect({ allowedRoles, policy }).toEqual({
      allowedRoles: ["depositor", "owner", "recipient"],
      policy: "open",
    });
    expect(
      links.map((link) => [link.role, link.accountId, link.effectiveFrom]),
    ).toEqual(
      expect.arrayContaining([
        ["depositor", depositorId, T0],
        ["owner", ownerId, T0],
      ]),
    );
    const history = await museum.staff.query(api.partyLinks.listForAccount, {
      accountId: depositorId,
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(history.page).toMatchObject([
      {
        role: "depositor",
        targetType: "entry",
        targetId: entryId,
        targetLabel: "TE-2026-0001",
      },
    ]);
    await expect(
      receive(museum, { depositorAccountId: foreignParty }),
    ).rejects.toThrow("Party not found");
  });
});

describe("exit to a recorded recipient", () => {
  test("returns deposited property to its recipient without recording a deaccession", async () => {
    const t = createConvexTest();
    const museum = await createMuseum(t);
    const recipientId = await insertParty(t, museum, "Ana Popescu");
    const { entryId, collectionId } = await receive(museum);
    vi.setSystemTime(T0 + 12 * DAY);

    await museum.staff.mutation(api.objectEntries.recordExit, {
      entryId,
      recipientAccountId: recipientId,
      exitedAt: T0 + 11 * DAY,
      reference: "Signed receipt 44",
      notes: "Collected in person",
      observedFromLocationId: museum.locationId,
    });

    const entry = await getEntry(museum.staff, entryId);
    expect(entry).toMatchObject({
      status: "exited",
      exit: {
        recipientName: "Ana Popescu",
        recipientAccountId: recipientId,
        exitedAt: T0 + 11 * DAY,
        reference: "Signed receipt 44",
        notes: "Collected in person",
        fromLocationName: "Receiving room",
        recordedByName: "Test User",
        recordedAt: T0 + 12 * DAY,
      },
      object: { _id: collectionId, currentLocationName: null },
    });
    const evidence = await t.run(async (ctx) => ({
      object: await ctx.db.get(collectionId),
      movements: await ctx.db
        .query("locationHistory")
        .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
        .collect(),
      deaccessions: await ctx.db.query("deaccessions").collect(),
    }));
    expect(evidence.object).toMatchObject({
      status: "archived",
      archivedReason: "Returned under entry TE-2026-0001 to Ana Popescu",
    });
    expect(evidence.object?.currentLocationId).toBeUndefined();
    expect(evidence.movements.map((row) => row.movementKind)).toEqual([
      "entry_receipt",
      "entry_exit",
    ]);
    expect(evidence.movements[1]?.fromLocationId).toBe(museum.locationId);
    expect(evidence.movements[1]).not.toHaveProperty("toLocationId");
    expect(evidence.deaccessions).toEqual([]);
    const { links } = await museum.staff.query(api.partyLinks.listForTarget, {
      target: { type: "entry", id: entryId },
    });
    expect(links).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "recipient",
          accountId: recipientId,
          effectiveFrom: T0 + 11 * DAY,
        }),
      ]),
    );
  });

  test("refuses an exit without a recipient, out of order, twice, or from a stale source", async () => {
    const t = createConvexTest();
    const museum = await createMuseum(t);
    const { entryId, collectionId } = await receive(museum);
    vi.setSystemTime(T0 + 2 * DAY);
    const exitArgs = {
      entryId,
      recipientName: "Ana Popescu",
      exitedAt: T0 + DAY,
    };

    expect(
      (
        await entryErrorOf(
          museum.staff.mutation(api.objectEntries.recordExit, {
            ...exitArgs,
            recipientName: " ",
          }),
        )
      ).code,
    ).toBe("ENTRY_RECIPIENT_REQUIRED");
    expect(
      (
        await entryErrorOf(
          museum.staff.mutation(api.objectEntries.recordExit, {
            ...exitArgs,
            exitedAt: T0 - DAY,
          }),
        )
      ).code,
    ).toBe("ENTRY_DATES_INVALID");

    const shelf = await t.run(async (ctx) => {
      const shelfId = await ctx.db.insert("locations", {
        organizationId: museum.organizationId,
        name: "Shelf 2",
        type: "storage",
        sortOrder: 1,
        isActive: true,
      });
      await ctx.db.patch(collectionId, { currentLocationId: shelfId });
      return shelfId;
    });
    expect(
      (
        await custodyConflictOf(
          museum.staff.mutation(api.objectEntries.recordExit, {
            ...exitArgs,
            observedFromLocationId: museum.locationId,
          }),
        )
      )?.code,
    ).toBe("SOURCE_CHANGED");

    await museum.staff.mutation(api.objectEntries.recordExit, {
      ...exitArgs,
      observedFromLocationId: shelf,
    });
    expect(
      (
        await entryErrorOf(
          museum.staff.mutation(api.objectEntries.recordExit, exitArgs),
        )
      ).code,
    ).toBe("ENTRY_CLOSED");
  });

  test("requires permission to update the collection", async () => {
    const t = createConvexTest();
    const museum = await createMuseum(t);
    const { entryId } = await receive(museum);
    vi.setSystemTime(T0 + 2 * DAY);
    const receiver = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { name: "Receiver" });
      const roleId = await ctx.db.insert("roles", {
        organizationId: museum.organizationId,
        name: "Reader",
        isSystemRole: false,
      });
      const permissionId = await ctx.db.insert("permissions", {
        name: "collections.read",
        category: "collections",
      });
      await ctx.db.insert("rolePermissions", { roleId, permissionId });
      await ctx.db.insert("userOrganizations", {
        userId,
        organizationId: museum.organizationId,
        roleId,
        joinedAt: T0,
      });
      return userId;
    });

    await expect(
      authedForUser(t, receiver).mutation(api.objectEntries.recordExit, {
        entryId,
        recipientName: "Ana Popescu",
        exitedAt: T0 + DAY,
      }),
    ).rejects.toThrow();
    expect((await getEntry(museum.staff, entryId)).status).toBe("in_custody");
  });
});

async function requireAccessionApproval(t: ConvexTest, museum: Museum) {
  await t.run(async (ctx) => {
    await ctx.db.insert("workflowConfigs", {
      organizationId: museum.organizationId,
      workflowType: "accession",
      steps: [{ stepNumber: 1, roleId: museum.roleId, name: "Committee" }],
      canInitiateRoles: [museum.roleId],
    });
  });
}

async function beginAcquisition(
  museum: Museum,
  entryId: Id<"objectEntries">,
  accessionNumber = "2026.14",
) {
  return await museum.staff.mutation(api.objectEntries.beginAcquisition, {
    entryId,
    method: "gift",
    accessionNumber,
    notes: "Offered as a gift at receipt",
  });
}

describe("acquisition branch", () => {
  test("accessions the same object once the accession policy approves it", async () => {
    const t = createConvexTest();
    const museum = await createMuseum(t);
    await requireAccessionApproval(t, museum);
    const ownerId = await insertParty(t, museum, "Ana Popescu");
    const { entryId, collectionId } = await receive(museum, {
      purpose: "acquisition",
      ownerName: undefined,
      ownerAccountId: ownerId,
    });
    vi.setSystemTime(T0 + 3 * DAY);

    const accessionId = await beginAcquisition(museum, entryId);

    expect(await getEntry(museum.staff, entryId)).toMatchObject({
      status: "acquisition_review",
      accession: {
        _id: accessionId,
        accessionNumber: "2026.14",
        status: "pending",
        isDraft: true,
      },
      object: { identifier: "TE-2026-0001" },
    });
    const accession = await t.run((ctx) => ctx.db.get(accessionId));
    expect(accession).toMatchObject({
      collectionId,
      entryId,
      source: "Ana Popescu",
      method: "gift",
      dateReceived: T0,
      status: "pending",
      workflowStep: 0,
    });
    const accessionView = await museum.staff.query(api.accessions.get, {
      accessionId,
    });
    expect(accessionView).toMatchObject({
      collectionId,
      entry: { _id: entryId, entryNumber: "TE-2026-0001" },
    });
    const { links } = await museum.staff.query(api.partyLinks.listForTarget, {
      target: { type: "accession", id: accessionId },
    });
    expect(links).toMatchObject([{ role: "owner", accountId: ownerId }]);

    await museum.staff.mutation(api.accessions.submitForApproval, {
      accessionId,
    });
    vi.setSystemTime(T0 + 5 * DAY);
    await museum.staff.mutation(api.accessions.approve, { accessionId });

    expect(await getEntry(museum.staff, entryId)).toMatchObject({
      status: "accessioned",
      accessionedAt: T0 + 5 * DAY,
      accession: { status: "approved", isDraft: false },
      object: {
        _id: collectionId,
        identifier: "2026.14",
        status: "active",
        currentLocationName: "Receiving room",
      },
    });
    const objects = await t.run((ctx) => ctx.db.query("collections").collect());
    expect(objects).toHaveLength(1);
    expect(objects[0]).toMatchObject({
      accessionNumber: "2026.14",
      alternateAccessionNumbers: ["TE-2026-0001"],
      accessionNumberHistory: [
        { number: "TE-2026-0001", validFrom: T0, validTo: T0 + 5 * DAY },
        { number: "2026.14", validFrom: T0 + 5 * DAY },
      ],
    });
  });

  test("without an approval workflow the acquisition still waits for an approver", async () => {
    const t = createConvexTest();
    const museum = await createMuseum(t);
    const { entryId } = await receive(museum);

    const accessionId = await beginAcquisition(museum, entryId);
    expect((await getEntry(museum.staff, entryId)).status).toBe(
      "acquisition_review",
    );
    await museum.staff.mutation(api.accessions.submitForApproval, {
      accessionId,
    });
    await museum.staff.mutation(api.accessions.approve, { accessionId });

    expect(await getEntry(museum.staff, entryId)).toMatchObject({
      status: "accessioned",
      object: { identifier: "2026.14" },
    });
  });

  test("requires a recorded owner and a single open acquisition", async () => {
    const t = createConvexTest();
    const museum = await createMuseum(t);
    await requireAccessionApproval(t, museum);
    const unknownOwner = await receive(museum, { ownerName: undefined });
    const { entryId } = await receive(museum, { object: { title: "Ring" } });

    expect(
      (await entryErrorOf(beginAcquisition(museum, unknownOwner.entryId))).code,
    ).toBe("ENTRY_OWNER_REQUIRED");
    await beginAcquisition(museum, entryId);
    expect(
      (await entryErrorOf(beginAcquisition(museum, entryId, "2026.15"))).code,
    ).toBe("ENTRY_NOT_IN_CUSTODY");
    vi.setSystemTime(T0 + DAY);
    expect(
      (
        await entryErrorOf(
          museum.staff.mutation(api.objectEntries.recordExit, {
            entryId,
            recipientName: "Ana Popescu",
            exitedAt: T0 + DAY,
          }),
        )
      ).code,
    ).toBe("ENTRY_ACQUISITION_OPEN");
  });

  test("object details of an entry acquisition stay on the object record", async () => {
    const t = createConvexTest();
    const museum = await createMuseum(t);
    await requireAccessionApproval(t, museum);
    const { entryId } = await receive(museum);
    const accessionId = await beginAcquisition(museum, entryId);

    expect(
      (
        await entryErrorOf(
          museum.staff.mutation(api.accessions.upsertObjectDraft, {
            organizationId: museum.organizationId,
            accessionId,
            saveMode: "draft",
            objectData: { title: "Replacement draft" },
          }),
        )
      ).code,
    ).toBe("ENTRY_OBJECT_RECORDED");
  });

  test("a withdrawn acquisition reopens the entry for exit, after which it cannot be restored", async () => {
    const t = createConvexTest();
    const museum = await createMuseum(t);
    await requireAccessionApproval(t, museum);
    const { entryId, collectionId } = await receive(museum);
    const accessionId = await beginAcquisition(museum, entryId);
    await museum.staff.mutation(api.accessions.submitForApproval, {
      accessionId,
    });
    vi.setSystemTime(T0 + 4 * DAY);

    await museum.staff.mutation(api.accessions.reject, {
      accessionId,
      decision: "returnToDraft",
      reason: "Needs the deed of gift",
    });
    expect((await getEntry(museum.staff, entryId)).status).toBe(
      "acquisition_review",
    );
    await museum.staff.mutation(api.accessions.submitForApproval, {
      accessionId,
    });
    await museum.staff.mutation(api.accessions.reject, {
      accessionId,
      decision: "withdraw",
      reason: "Outside collecting policy",
    });
    expect(await getEntry(museum.staff, entryId)).toMatchObject({
      status: "in_custody",
      acquisitionDeclinedAt: T0 + 4 * DAY,
      accession: { _id: accessionId, status: "withdrawn" },
    });

    await museum.staff.mutation(api.accessions.restoreWithdrawn, {
      accessionId,
      reason: "Committee asked to reconsider",
    });
    expect((await getEntry(museum.staff, entryId)).status).toBe(
      "acquisition_review",
    );
    await museum.staff.mutation(api.accessions.submitForApproval, {
      accessionId,
    });
    await museum.staff.mutation(api.accessions.reject, {
      accessionId,
      decision: "withdraw",
      reason: "Declined after reconsideration",
    });
    await museum.staff.mutation(api.objectEntries.recordExit, {
      entryId,
      recipientName: "Ana Popescu",
      exitedAt: T0 + 4 * DAY,
    });

    expect(
      (
        await entryErrorOf(
          museum.staff.mutation(api.accessions.restoreWithdrawn, {
            accessionId,
            reason: "Too late",
          }),
        )
      ).code,
    ).toBe("ENTRY_EXITED");
    const evidence = await t.run(async (ctx) => ({
      object: await ctx.db.get(collectionId),
      deaccessions: await ctx.db.query("deaccessions").collect(),
    }));
    expect(evidence.object?.status).toBe("archived");
    expect(evidence.deaccessions).toEqual([]);
  });
});

describe("property held under an entry is not part of the collection", () => {
  test("cannot be deaccessioned, lent or transferred until it is accessioned", async () => {
    const t = createConvexTest();
    const museum = await createMuseum(t, [
      ...REGISTRAR_PERMISSIONS,
      "collections.delete",
      "loans.create",
      "loans.update",
    ]);
    const { entryId, collectionId } = await receive(museum);
    const target = await createOrgUserWithPermissions(t, [
      "collections.create",
    ]);
    await t.run(async (ctx) => {
      await ctx.db.insert("userOrganizations", {
        userId: museum.userId,
        organizationId: target.organizationId,
        roleId: target.roleId,
        joinedAt: T0,
      });
    });
    const deaccession = () =>
      museum.staff.mutation(api.deaccessions.create, {
        organizationId: museum.organizationId,
        collectionId,
        dateDeaccessioned: T0,
        reason: "Not wanted",
        method: "donation",
      });

    for (const type of ["outgoing", "incoming"] as const) {
      expect(
        (
          await entryErrorOf(
            museum.staff.mutation(api.loans.create, {
              organizationId: museum.organizationId,
              loanNumber: `L-${type}`,
              type,
              lenderBorrowerName: "Partner Museum",
              startDate: T0,
              collectionIds: [collectionId],
            }),
          )
        ).code,
      ).toBe("ENTRY_TEMPORARY_CUSTODY");
    }
    const emptyLoan = await museum.staff.mutation(api.loans.create, {
      organizationId: museum.organizationId,
      loanNumber: "L-empty",
      type: "outgoing",
      lenderBorrowerName: "Partner Museum",
      startDate: T0,
    });
    expect(
      (
        await entryErrorOf(
          museum.staff.mutation(api.loans.addItems, {
            loanId: emptyLoan,
            collectionIds: [collectionId],
          }),
        )
      ).code,
    ).toBe("ENTRY_TEMPORARY_CUSTODY");
    expect((await entryErrorOf(deaccession())).code).toBe("ENTRY_TEMPORARY_CUSTODY");
    const eligibility = await museum.staff.query(
      api.objectMoves.getEligibility,
      {
        collectionId,
        targetOrganizationId: target.organizationId,
      },
    );
    expect(eligibility.blockers.map((blocker) => blocker.code)).toContain(
      "temporary_custody",
    );
    await expect(
      museum.staff.mutation(api.objectMoves.createRequest, {
        collectionId,
        targetOrganizationId: target.organizationId,
        accessionMode: "keep",
        reason: "Transfer",
      }),
    ).rejects.toThrow();

    const accessionId = await beginAcquisition(museum, entryId);
    await museum.staff.mutation(api.accessions.submitForApproval, {
      accessionId,
    });
    await museum.staff.mutation(api.accessions.approve, { accessionId });
    await expect(deaccession()).resolves.toBeDefined();
  });

  test("counts as incoming rather than owned inventory until accessioned", async () => {
    const t = createConvexTest();
    const museum = await createMuseum(t, [
      ...REGISTRAR_PERMISSIONS,
      "organization.view_analytics",
    ]);
    await t.run((ctx) =>
      ctx.db.insert("collections", {
        organizationId: museum.organizationId,
        accessionNumber: "1990.1",
        title: "Owned vase",
        status: "active",
        catalogedBy: museum.userId,
        catalogedAt: T0,
      }),
    );
    const { entryId } = await receive(museum);
    const inventory = async () => {
      const analytics = await museum.staff.query(api.dashboard.getAnalytics, {
        organizationId: museum.organizationId,
      });
      if (analytics.availability !== "ready")
        throw new Error("Metrics unavailable");
      const scope = async (inventoryMetricScope: "owned" | "incoming") =>
        (
          await museum.staff.query(api.collections.list, {
            organizationId: museum.organizationId,
            inventoryMetricScope,
            paginationOpts: { numItems: 50, cursor: null },
          })
        ).page.map((item) => item.title);
      return {
        owned: analytics.objects.total,
        incoming: analytics.objects.incomingLoanExcluded,
        ownedList: await scope("owned"),
        incomingList: await scope("incoming"),
      };
    };
    await rebuildProjection(t, museum.organizationId);

    expect(await inventory()).toEqual({
      owned: 1,
      incoming: 1,
      ownedList: ["Owned vase"],
      incomingList: ["Silver brooch"],
    });

    const accessionId = await beginAcquisition(museum, entryId);
    await museum.staff.mutation(api.accessions.submitForApproval, {
      accessionId,
    });
    await museum.staff.mutation(api.accessions.approve, { accessionId });
    const accessioned = await inventory();
    expect(accessioned).toMatchObject({ owned: 2, incoming: 0 });
    expect(accessioned.ownedList.sort()).toEqual([
      "Owned vase",
      "Silver brooch",
    ]);
    await rebuildProjection(t, museum.organizationId);
    expect(await inventory()).toMatchObject({ owned: 2, incoming: 0 });
  });
});

describe("registers", () => {
  test("custody and condition registers report the entry; the disposal register does not", async () => {
    const t = createConvexTest();
    const museum = await createMuseum(t);
    const { entryId, collectionId } = await receive(museum);
    vi.setSystemTime(T0 + 9 * DAY);
    await museum.staff.mutation(api.objectEntries.recordExit, {
      entryId,
      recipientName: "Ana Popescu",
      exitedAt: T0 + 8 * DAY,
      reference: "Signed receipt 44",
    });
    const preview = (profile: "custody" | "condition" | "disposal") =>
      museum.staff.query(api.registers.preview, {
        organizationId: museum.organizationId,
        profile,
        criteria: profile === "disposal" ? {} : { objectId: collectionId },
      });

    const custody = await preview("custody");
    expect(custody.profileVersion).toBe(2);
    expect(
      custody.rows.map((row) => [
        row.evidenceSource,
        row.eventType,
        row.movementKind,
      ]),
    ).toEqual([
      ["locationHistory", "movement", "entry_receipt"],
      ["locationHistory", "movement", "entry_exit"],
      ["objectEntries", "entry_received", null],
      ["objectEntries", "entry_exit", null],
    ]);
    expect(custody.rows[2]).toMatchObject({
      eventId: entryId,
      eventAt: T0,
      objectAccessionNumber: "TE-2026-0001",
      toLocationId: museum.locationId,
      toLocationName: "Receiving room",
      actorId: museum.userId,
      counterparty: "Ana Popescu",
      reason: "deposit",
      evidenceStatus: "recorded",
    });
    expect(custody.rows[3]).toMatchObject({
      eventId: entryId,
      eventAt: T0 + 8 * DAY,
      fromLocationName: "Receiving room",
      counterparty: "Ana Popescu",
      reason: null,
      recordedAt: T0 + 9 * DAY,
    });

    const condition = await preview("condition");
    expect(condition.rows).toMatchObject([
      {
        eventId: entryId,
        evidenceSource: "objectEntries",
        eventType: "entry_condition",
        assessedAt: T0,
        condition: "Good; light surface dust",
        assessorId: museum.userId,
        reportDirection: "in",
        evidenceStatus: "recorded",
      },
    ]);
    expect((await preview("disposal")).rows).toEqual([]);
  });
});

describe("working with entries", () => {
  test("lists entries newest first, optionally by status, for members only", async () => {
    const t = createConvexTest();
    const museum = await createMuseum(t);
    const outsider = await createOrgUserWithPermissions(
      t,
      REGISTRAR_PERMISSIONS,
    );
    const first = await receive(museum, { receivedAt: T0 - 2 * DAY });
    const second = await receive(museum, {
      receivedAt: T0 - DAY,
      object: { title: "Ring" },
    });
    await museum.staff.mutation(api.objectEntries.recordExit, {
      entryId: first.entryId,
      recipientName: "Ana Popescu",
      exitedAt: T0,
    });

    const all = await museum.staff.query(api.objectEntries.list, {
      organizationId: museum.organizationId,
      paginationOpts: { numItems: 10, cursor: null },
    });
    expectMatchesReturns(objectEntries.list, all);
    expect(
      all.page.map((item) => [item.entryNumber, item.status, item.objectTitle]),
    ).toEqual([
      [second.entryNumber, "in_custody", "Ring"],
      [first.entryNumber, "exited", "Silver brooch"],
    ]);
    expect(all.page[0]).toMatchObject({
      depositorName: "Ana Popescu",
      responsibleName: "Test User",
      returnDueAt: T0 + 30 * DAY,
    });
    const open = await museum.staff.query(api.objectEntries.list, {
      organizationId: museum.organizationId,
      status: "in_custody",
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(open.page.map((item) => item.entryId)).toEqual([second.entryId]);
    await expect(
      authedForUser(t, outsider.userId).query(api.objectEntries.list, {
        organizationId: museum.organizationId,
        paginationOpts: { numItems: 10, cursor: null },
      }),
    ).rejects.toThrow();
  });

  test("finds the entry an object is held under", async () => {
    const t = createConvexTest();
    const museum = await createMuseum(t);
    const { entryId, collectionId } = await receive(museum);
    const owned = await t.run((ctx) =>
      ctx.db.insert("collections", {
        organizationId: museum.organizationId,
        accessionNumber: "1990.1",
        title: "Owned vase",
        status: "active",
        catalogedBy: museum.userId,
        catalogedAt: T0,
      }),
    );

    const held = await museum.staff.query(api.objectEntries.getForObject, {
      collectionId,
    });
    expectMatchesReturns(objectEntries.getForObject, held);
    expect(held).toMatchObject({
      _id: entryId,
      entryNumber: "TE-2026-0001",
      status: "in_custody",
      depositorName: "Ana Popescu",
      receivedAt: T0,
    });
    expect(
      await museum.staff.query(api.objectEntries.getForObject, {
        collectionId: owned,
      }),
    ).toBeNull();
  });

  test("corrects open-entry details and refuses edits once closed", async () => {
    const t = createConvexTest();
    const museum = await createMuseum(t);
    const colleague = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { name: "Colleague" });
      await ctx.db.insert("userOrganizations", {
        userId,
        organizationId: museum.organizationId,
        roleId: museum.roleId,
        joinedAt: T0,
      });
      return userId;
    });
    const { entryId } = await receive(museum);

    await museum.staff.mutation(api.objectEntries.update, {
      entryId,
      responsibleUserId: colleague,
      decisionDueAt: T0 + 7 * DAY,
      returnDueAt: null,
      responsibilityTerms: "Museum insures while held",
      notes: "Box kept with object",
    });
    const updated = await getEntry(museum.staff, entryId);
    expect(updated).toMatchObject({
      responsibleName: "Colleague",
      decisionDueAt: T0 + 7 * DAY,
      responsibilityTerms: "Museum insures while held",
      notes: "Box kept with object",
    });
    expect(updated.returnDueAt).toBeUndefined();
    expect(
      (
        await entryErrorOf(
          museum.staff.mutation(api.objectEntries.update, {
            entryId,
            decisionDueAt: T0 - DAY,
          }),
        )
      ).code,
    ).toBe("ENTRY_DATES_INVALID");

    vi.setSystemTime(T0 + DAY);
    await museum.staff.mutation(api.objectEntries.recordExit, {
      entryId,
      recipientName: "Ana Popescu",
      exitedAt: T0 + DAY,
    });
    expect(
      (
        await entryErrorOf(
          museum.staff.mutation(api.objectEntries.update, {
            entryId,
            notes: "Too late",
          }),
        )
      ).code,
    ).toBe("ENTRY_CLOSED");
  });
});

test("offers the organization's members as accountable staff", async () => {
  const t = createConvexTest();
  const museum = await createMuseum(t);
  const outsider = await createOrgUserWithPermissions(
    t,
    REGISTRAR_PERMISSIONS,
    {
      userName: "Outsider",
    },
  );
  await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { name: "Colleague" });
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId: museum.organizationId,
      roleId: museum.roleId,
      joinedAt: T0,
    });
  });

  const members = await museum.staff.query(
    api.objectEntries.listResponsibleMembers,
    { organizationId: museum.organizationId },
  );
  expect(members.map((member) => member.name)).toEqual([
    "Colleague",
    "Test User",
  ]);
  await expect(
    authedForUser(t, outsider.userId).query(
      api.objectEntries.listResponsibleMembers,
      { organizationId: museum.organizationId },
    ),
  ).rejects.toThrow();
});

describe("review follow-ups", () => {
  test("records the owner after receipt so the acquisition branch opens", async () => {
    const t = createConvexTest();
    const museum = await createMuseum(t);
    const ownerId = await insertParty(t, museum, "Popescu Estate");
    const { entryId } = await receive(museum, { ownerName: undefined });
    expect((await getEntry(museum.staff, entryId)).ownerName).toBeUndefined();

    await museum.staff.mutation(api.objectEntries.update, {
      entryId,
      ownerName: "Ana Popescu",
    });
    expect((await getEntry(museum.staff, entryId)).ownerName).toBe(
      "Ana Popescu",
    );
    await museum.staff.mutation(api.partyLinks.link, {
      target: { type: "entry", id: entryId },
      accountId: ownerId,
      role: "owner",
    });
    expect(await getEntry(museum.staff, entryId)).toMatchObject({
      ownerName: "Popescu Estate",
      ownerAccountId: ownerId,
    });
    await expect(beginAcquisition(museum, entryId)).resolves.toBeDefined();
  });

  test("withdraws a draft acquisition from its entry with a reason", async () => {
    const t = createConvexTest();
    const museum = await createMuseum(t);
    await requireAccessionApproval(t, museum);
    const { entryId } = await receive(museum);
    const accessionId = await beginAcquisition(museum, entryId);
    vi.setSystemTime(T0 + DAY);

    expect(
      (
        await entryErrorOf(
          museum.staff.mutation(api.objectEntries.withdrawAcquisition, {
            entryId,
            reason: " ",
          }),
        )
      ).code,
    ).toBe("ENTRY_REASON_REQUIRED");
    await museum.staff.mutation(api.objectEntries.withdrawAcquisition, {
      entryId,
      reason: "Owner decided to keep it",
    });

    expect(await getEntry(museum.staff, entryId)).toMatchObject({
      status: "in_custody",
      acquisitionDeclinedAt: T0 + DAY,
      accession: { _id: accessionId, status: "withdrawn" },
    });
    const accession = await museum.staff.query(api.accessions.get, {
      accessionId,
    });
    expect(accession?.reviewDecision).toMatchObject({
      decision: "withdrawn",
      reason: "Owner decided to keep it",
    });
    await museum.staff.mutation(api.objectEntries.recordExit, {
      entryId,
      recipientName: "Ana Popescu",
      exitedAt: T0 + DAY,
    });
    expect((await getEntry(museum.staff, entryId)).status).toBe("exited");
  });

  test("leaves an acquisition under review to its reviewers", async () => {
    const t = createConvexTest();
    const museum = await createMuseum(t);
    await requireAccessionApproval(t, museum);
    const { entryId } = await receive(museum);
    const accessionId = await beginAcquisition(museum, entryId);
    await museum.staff.mutation(api.accessions.submitForApproval, {
      accessionId,
    });

    expect(
      (
        await entryErrorOf(
          museum.staff.mutation(api.objectEntries.withdrawAcquisition, {
            entryId,
            reason: "Changed mind",
          }),
        )
      ).code,
    ).toBe("ENTRY_ACQUISITION_IN_REVIEW");
  });

  test("an entered object leaves custody only through its entry and is not restored after exit", async () => {
    const t = createConvexTest();
    const museum = await createMuseum(t, [
      ...REGISTRAR_PERMISSIONS,
      "collections.delete",
    ]);
    const { entryId, collectionId } = await receive(museum);

    expect(
      (
        await entryErrorOf(
          museum.staff.mutation(api.collections.archiveCollection, {
            collectionId,
            reason: "Not ours",
          }),
        )
      ).code,
    ).toBe("ENTRY_EXIT_REQUIRED");
    const bulk = await museum.staff.mutation(
      api.batchOperations.quickBulkStatusChange,
      {
      organizationId: museum.organizationId,
      collectionIds: [collectionId],
      newStatus: "archived",
        reason: "Bulk clean-up",
      },
    );
    expect(bulk.failureCount).toBe(1);
    expect(bulk.errors[0]?.error).toContain("Record the exit");
    expect((await t.run((ctx) => ctx.db.get(collectionId)))?.status).toBe(
      "active",
    );

    vi.setSystemTime(T0 + DAY);
    await museum.staff.mutation(api.objectEntries.recordExit, {
      entryId,
      recipientName: "Ana Popescu",
      exitedAt: T0 + DAY,
    });
    expect(
      (
        await entryErrorOf(
          museum.staff.mutation(api.collections.restoreCollection, {
            collectionId,
          }),
        )
      ).code,
    ).toBe("ENTRY_EXITED");
  });

  test("reports whether the caller may begin the acquisition", async () => {
    const t = createConvexTest();
    const museum = await createMuseum(t);
    const { entryId } = await receive(museum);
    expect(
      (await getEntry(museum.staff, entryId)).canInitiateAcquisition,
    ).toBe(true);
    await t.run(async (ctx) => {
      const otherRole = await ctx.db.insert("roles", {
        organizationId: museum.organizationId,
        name: "Acquisitions",
        isSystemRole: false,
      });
      await ctx.db.insert("workflowConfigs", {
        organizationId: museum.organizationId,
        workflowType: "accession",
        steps: [{ stepNumber: 1, roleId: otherRole, name: "Committee" }],
        canInitiateRoles: [otherRole],
      });
    });
    expect(
      (await getEntry(museum.staff, entryId)).canInitiateAcquisition,
    ).toBe(false);
  });

  test("does not announce entered property as a new collection object", async () => {
    const t = createConvexTest();
    const museum = await createMuseum(t);
    await t.run((ctx) =>
      ctx.db.insert("webhooks", {
        organizationId: museum.organizationId,
        name: "Catalogue sync",
        url: "https://example.test/hook",
        events: ["collection.created"],
        secret: "secret",
        isActive: true,
        createdBy: museum.userId,
        createdAt: T0,
      }),
    );
    await receive(museum);
    expect(
      await t.run((ctx) => ctx.db.query("webhookEvents").collect()),
    ).toEqual([]);
  });
});
