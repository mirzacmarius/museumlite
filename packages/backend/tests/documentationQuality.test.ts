import { afterEach, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import {
  type QualityErrorData,
  qualityErrorFromError,
} from "../convex/utils/documentationQualityErrors";
import { normalizeIdentifier } from "../convex/utils/identifiers";
import { notificationEntityHref } from "../convex/utils/notificationLinks";
import { workErrorFromError } from "../convex/utils/workErrors";
import {
  authedForUser,
  type ConvexTest,
  capabilityFailureOf,
  createConvexTest,
} from "./testHarness";

const OFFICER_PERMISSIONS = ["collections.read", "collections.update"];
const ADMIN_PERMISSIONS = [
  ...OFFICER_PERMISSIONS,
  "organization.manage_settings",
  "accounts.read",
  "accounts.write",
];

async function addMember(
  t: ConvexTest,
  organizationId: Id<"organizations">,
  name: string,
  permissions: string[],
) {
  return t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      name,
      email: `${name.toLowerCase().replaceAll(" ", ".")}@example.test`,
    });
    const roleId = await ctx.db.insert("roles", {
      organizationId,
      name: `${name} role`,
      isSystemRole: false,
    });
    const existing = new Map(
      (await ctx.db.query("permissions").collect()).map((row) => [
        row.name,
        row._id,
      ]),
    );
    for (const permission of permissions) {
      const permissionId =
        existing.get(permission) ??
        (await ctx.db.insert("permissions", {
          name: permission,
          category: permission.startsWith("organization.")
            ? "organization"
            : permission.startsWith("accounts.")
              ? "accounts"
              : "collections",
        }));
      await ctx.db.insert("rolePermissions", { roleId, permissionId });
    }
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId,
      joinedAt: 1,
    });
    return userId;
  });
}

async function createOrganization(t: ConvexTest, name: string) {
  return t.run((ctx) =>
    ctx.db.insert("organizations", {
      name,
      slug: name.toLowerCase().replaceAll(" ", "-"),
      type: "museum",
      subscriptionTier: "pro",
      settings: { enabledModules: ["accounts"] },
    }),
  );
}

async function setup() {
  const t = createConvexTest();
  const organizationId = await createOrganization(t, "Home Museum");
  const adminId = await addMember(
    t,
    organizationId,
    "Ada Admin",
    ADMIN_PERMISSIONS,
  );
  const officerId = await addMember(
    t,
    organizationId,
    "Otto Officer",
    OFFICER_PERMISSIONS,
  );
  const viewerId = await addMember(t, organizationId, "Vera Viewer", [
    "collections.read",
  ]);
  const foreignOrganizationId = await createOrganization(t, "Other Museum");
  const foreignAdminId = await addMember(
    t,
    foreignOrganizationId,
    "Fiona Foreign",
    ADMIN_PERMISSIONS,
  );
  return {
    t,
    organizationId,
    adminId,
    officerId,
    viewerId,
    foreignOrganizationId,
    admin: authedForUser(t, adminId),
    officer: authedForUser(t, officerId),
    viewer: authedForUser(t, viewerId),
    foreignAdmin: authedForUser(t, foreignAdminId),
  };
}

afterEach(() => {
  vi.useRealTimers();
});

type Staff = ReturnType<typeof authedForUser>;

interface ObjectFixture {
  accessionNumber: string;
  title?: string;
  objectType?: string;
  status?: "active" | "loaned" | "deaccessioned" | "archived";
  /** Leave the identifier out of the identifier index, like legacy rows. */
  unindexed?: boolean;
}

async function insertObject(
  t: ConvexTest,
  organizationId: Id<"organizations">,
  userId: Id<"users">,
  fixture: ObjectFixture,
) {
  return t.run((ctx) =>
    ctx.db.insert("collections", {
      organizationId,
      accessionNumber: fixture.accessionNumber,
      normalizedIdentifier: fixture.unindexed
        ? undefined
        : normalizeIdentifier(fixture.accessionNumber),
      title: fixture.title ?? `Object ${fixture.accessionNumber}`,
      objectType: fixture.objectType,
      status: fixture.status ?? "active",
      catalogedBy: userId,
      catalogedAt: 1,
    }),
  );
}

async function addImage(
  t: ConvexTest,
  organizationId: Id<"organizations">,
  userId: Id<"users">,
  objectId: Id<"collections">,
) {
  await t.run(async (ctx) => {
    await ctx.db.insert("mediaFiles", {
      collectionId: objectId,
      organizationId,
      storageId: await ctx.storage.store(new Blob(["photo"])),
      fileName: "front.jpg",
      fileType: "image",
      fileSize: 5,
      mimeType: "image/jpeg",
      isPrimary: true,
      uploadedBy: userId,
      uploadedAt: 2,
      uploadStatus: "completed",
    });
  });
}

async function addAcceptedAssessment(
  t: ConvexTest,
  organizationId: Id<"organizations">,
  userId: Id<"users">,
  objectId: Id<"collections">,
) {
  await t.run(async (ctx) => {
    await ctx.db.insert("conditionAssessments", {
      organizationId,
      collectionId: objectId,
      assessedBy: userId,
      assessedAt: 3,
      recordedAt: 3,
      condition: "good",
      summary: "Stable",
      observations: [],
      photos: [],
      status: "accepted",
      acceptedBy: userId,
      acceptedAt: 3,
    });
  });
}

async function insertAccession(
  t: ConvexTest,
  organizationId: Id<"organizations">,
  fixture: {
    accessionNumber: string;
    source?: string;
    collectionId?: Id<"collections">;
    donorAccountId?: Id<"accounts">;
  },
) {
  return t.run((ctx) =>
    ctx.db.insert("accessions", {
      organizationId,
      accessionNumber: fixture.accessionNumber,
      normalizedIdentifier: normalizeIdentifier(fixture.accessionNumber),
      dateReceived: Date.UTC(1990, 0, 1),
      source: fixture.source ?? "See linked account",
      method: "gift",
      status: "approved",
      collectionId: fixture.collectionId,
      donorAccountId: fixture.donorAccountId,
    }),
  );
}

async function holdUnderOpenEntry(
  t: ConvexTest,
  organizationId: Id<"organizations">,
  userId: Id<"users">,
  objectId: Id<"collections">,
) {
  await t.run(async (ctx) => {
    const locationId = await ctx.db.insert("locations", {
      organizationId,
      name: "Receiving room",
      type: "room",
      sortOrder: 0,
      isActive: true,
    });
    await ctx.db.insert("objectEntries", {
      organizationId,
      entryNumber: "E-2026-1",
      normalizedEntryNumber: "e-2026-1",
      collectionId: objectId,
      purpose: "identification",
      depositorName: "Walk-in visitor",
      receivedAt: 1,
      receivedBy: userId,
      receivedLocationId: locationId,
      conditionAtEntry: "Unknown",
      responsibleUserId: userId,
      status: "in_custody",
    });
  });
}

const MAX_CHECK_PAGES = 1000;

/** Starts a check as `member`, runs it to the end and returns its summary. */
async function runCheck(
  t: ConvexTest,
  member: Staff,
  organizationId: Id<"organizations">,
) {
  vi.useFakeTimers();
  const checkId = await member.mutation(api.documentationQuality.startCheck, {
    organizationId,
  });
  await t.finishAllScheduledFunctions(vi.runAllTimers, MAX_CHECK_PAGES);
  const overview = await member.query(
    api.documentationQuality.getCheckOverview,
    { organizationId },
  );
  expect(overview.current?._id).toBe(checkId);
  return overview.current;
}

async function findings(
  member: Staff,
  organizationId: Id<"organizations">,
  status: "open" | "accepted" | "resolved" = "open",
  kind?:
    | "duplicate_identifier"
    | "missing_evidence"
    | "legacy_link"
    | "orphan_reference",
) {
  const result = await member.query(api.documentationQuality.listFindings, {
    organizationId,
    status,
    kind,
    paginationOpts: { numItems: 100, cursor: null },
  });
  return result.page;
}

async function qualityFailureOf(
  call: Promise<unknown>,
): Promise<QualityErrorData> {
  try {
    await call;
  } catch (error) {
    const data = qualityErrorFromError(error);
    if (!data) throw error;
    return data;
  }
  throw new Error("Expected the call to be rejected");
}

const PAINTINGS = {
  name: "Paintings in the collection",
  objectType: "Painting",
  stages: ["collection" as const],
  requirements: ["image" as const, "condition_assessment" as const],
};

test("an administrator configures a profile by object type and stage that documentation staff can read", async () => {
  const { admin, officer, organizationId } = await setup();

  const profileId = await admin.mutation(
    api.documentationQuality.createProfile,
    {
      organizationId,
      name: "  Paintings in the collection ",
      objectType: " Painting ",
      stages: ["borrowed", "collection"],
      requirements: ["image", "maker", "condition_assessment", "image"],
    },
  );

  expect(
    await officer.query(api.documentationQuality.listProfiles, {
      organizationId,
    }),
  ).toEqual({
    canManage: false,
    profiles: [
      expect.objectContaining({
        _id: profileId,
        name: "Paintings in the collection",
        objectType: "Painting",
        stages: ["collection", "borrowed"],
        requirements: ["maker", "condition_assessment", "image"],
        status: "active",
        version: 1,
      }),
    ],
  });
  expect(
    await capabilityFailureOf(
      officer.mutation(api.documentationQuality.createProfile, {
        organizationId,
        ...PAINTINGS,
      }),
    ),
  ).toMatchObject({ reason: "permission_missing" });
});

test("a profile without an object type applies to every type, and edits, archive and restore keep its identity", async () => {
  const { admin, organizationId } = await setup();
  const profileId = await admin.mutation(
    api.documentationQuality.createProfile,
    { organizationId, ...PAINTINGS },
  );

  await admin.mutation(api.documentationQuality.updateProfile, {
    profileId,
    name: "Everything held under an entry",
    stages: ["entry"],
    requirements: ["current_location"],
  });
  await admin.mutation(api.documentationQuality.archiveProfile, {
    profileId,
  });
  let { profiles } = await admin.query(api.documentationQuality.listProfiles, {
    organizationId,
  });
  expect(profiles).toEqual([
    expect.objectContaining({
      _id: profileId,
      name: "Everything held under an entry",
      stages: ["entry"],
      requirements: ["current_location"],
      status: "archived",
      version: 2,
    }),
  ]);
  expect(profiles[0]).not.toHaveProperty("objectType");

  await admin.mutation(api.documentationQuality.restoreProfile, {
    profileId,
  });
  ({ profiles } = await admin.query(api.documentationQuality.listProfiles, {
    organizationId,
  }));
  expect(profiles).toMatchObject([{ _id: profileId, status: "active" }]);
});

test("profile definitions are validated with coded errors", async () => {
  const { admin, organizationId } = await setup();
  const create = (overrides: Record<string, unknown>) =>
    admin.mutation(api.documentationQuality.createProfile, {
      organizationId,
      ...PAINTINGS,
      ...overrides,
    });

  expect(await qualityFailureOf(create({ name: "   " }))).toMatchObject({
    code: "PROFILE_INVALID",
    field: "name",
  });
  expect(await qualityFailureOf(create({ stages: [] }))).toMatchObject({
    code: "PROFILE_INVALID",
    field: "stages",
  });
  expect(await qualityFailureOf(create({ requirements: [] }))).toMatchObject({
    code: "PROFILE_INVALID",
    field: "requirements",
  });
  expect(
    await qualityFailureOf(create({ objectType: "x".repeat(201) })),
  ).toMatchObject({ code: "PROFILE_INVALID", field: "objectType" });

  for (let index = 0; index < 20; index++)
    await create({ name: `Profile ${index}` });
  expect(
    await qualityFailureOf(create({ name: "One too many" })),
  ).toMatchObject({ code: "PROFILE_LIMIT_REACHED" });
});

test("members without the documentation quality capability are refused and outsiders learn nothing", async () => {
  const { admin, viewer, foreignAdmin, officer, organizationId } =
    await setup();
  const profileId = await admin.mutation(
    api.documentationQuality.createProfile,
    { organizationId, ...PAINTINGS },
  );

  expect(
    await capabilityFailureOf(
      viewer.query(api.documentationQuality.listProfiles, { organizationId }),
    ),
  ).toMatchObject({
    reason: "permission_missing",
    capability: "documentation_quality",
  });
  const outsider = await capabilityFailureOf(
    foreignAdmin.query(api.documentationQuality.listProfiles, {
      organizationId,
    }),
  );
  // Non-members get the uncoded refusal (ADR 0004).
  expect(outsider).toBeNull();
  expect(
    await capabilityFailureOf(
      foreignAdmin.mutation(api.documentationQuality.archiveProfile, {
        profileId,
      }),
    ),
  ).toBeNull();

  const states = async (member: typeof viewer) =>
    (
      await member.query(api.capabilities.forOrganization, { organizationId })
    )?.find((state) => state.capability === "documentation_quality");
  expect(await states(viewer)).toMatchObject({ status: "permission_missing" });
  expect(await states(officer)).toMatchObject({ status: "available" });
});

test("a check reports missing evidence for objects of the profile's type and stage, without changing them", async () => {
  const { t, admin, officer, adminId, organizationId } = await setup();
  await admin.mutation(api.documentationQuality.createProfile, {
    organizationId,
    ...PAINTINGS,
  });
  const undocumented = await insertObject(t, organizationId, adminId, {
    accessionNumber: "1990.1",
    title: "Harbour at dusk",
    objectType: "Painting",
  });
  const documented = await insertObject(t, organizationId, adminId, {
    accessionNumber: "1990.2",
    objectType: "Painting",
  });
  await addImage(t, organizationId, adminId, documented);
  await addAcceptedAssessment(t, organizationId, adminId, documented);
  const spelledDifferently = await insertObject(t, organizationId, adminId, {
    accessionNumber: "1990.3",
    objectType: " painting",
    status: "loaned",
  });
  await addImage(t, organizationId, adminId, spelledDifferently);
  await insertObject(t, organizationId, adminId, {
    accessionNumber: "1990.4",
    objectType: "Sculpture",
  });
  const entered = await insertObject(t, organizationId, adminId, {
    accessionNumber: "E-2026-1",
    objectType: "Painting",
  });
  await holdUnderOpenEntry(t, organizationId, adminId, entered);
  await insertObject(t, organizationId, adminId, {
    accessionNumber: "1990.5",
    objectType: "Painting",
    status: "archived",
  });
  const before = await officer.query(api.collections.getObjectDetail, {
    collectionId: undocumented,
  });

  const check = await runCheck(t, officer, organizationId);

  expect(check).toMatchObject({
    status: "completed",
    number: 1,
    detected: 2,
    opened: 2,
    reopened: 0,
    resolved: 0,
  });
  const open = await findings(officer, organizationId);
  expect(open).toHaveLength(2);
  expect(open).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        kind: "missing_evidence",
        status: "open",
        objectId: undocumented,
        objectIdentifier: "1990.1",
        objectTitle: "Harbour at dusk",
        stage: "collection",
        profileName: "Paintings in the collection",
        missing: ["condition_assessment", "image"],
        firstCheckNumber: 1,
        lastCheckNumber: 1,
      }),
      expect.objectContaining({
        kind: "missing_evidence",
        objectId: spelledDifferently,
        missing: ["condition_assessment"],
      }),
    ]),
  );
  expect(
    await officer.query(api.collections.getObjectDetail, {
      collectionId: undocumented,
    }),
  ).toEqual(before);
});

test("duplicate identifiers are surfaced without renumbering and reviewed through the identifier register", async () => {
  const { t, admin, officer, adminId, organizationId } = await setup();
  const first = await insertObject(t, organizationId, adminId, {
    accessionNumber: "Old-01",
    title: "Bowl",
  });
  const second = await insertObject(t, organizationId, adminId, {
    accessionNumber: " old-01 ",
    title: "Cup",
  });
  await insertObject(t, organizationId, adminId, { accessionNumber: "Old-02" });
  await insertObject(t, organizationId, adminId, {
    accessionNumber: "LEGACY-9",
    unindexed: true,
  });
  const accessionA = await insertAccession(t, organizationId, {
    accessionNumber: "1950.7",
    collectionId: first,
  });
  const accessionB = await insertAccession(t, organizationId, {
    accessionNumber: "1950.7",
  });

  const check = await runCheck(t, officer, organizationId);

  expect(check).toMatchObject({
    status: "completed",
    identifierIndexIncomplete: true,
  });
  const duplicates = await findings(
    officer,
    organizationId,
    "open",
    "duplicate_identifier",
  );
  expect(duplicates).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        register: "catalog",
        normalizedIdentifier: "old-01",
        identifier: "Old-01",
        recordCount: 2,
        records: [
          { id: first, identifier: "Old-01", label: "Bowl" },
          { id: second, identifier: " old-01 ", label: "Cup" },
        ],
      }),
      expect.objectContaining({
        register: "accession",
        normalizedIdentifier: "1950.7",
        recordCount: 2,
        records: [
          { id: accessionA, identifier: "1950.7", label: "Bowl" },
          { id: accessionB, identifier: "1950.7", label: "" },
        ],
      }),
    ]),
  );
  expect(duplicates).toHaveLength(2);

  const catalogFinding = duplicates.find(
    (finding) =>
      finding.kind === "duplicate_identifier" && finding.register === "catalog",
  );
  if (!catalogFinding) throw new Error("Catalog duplicate missing");
  await officer.mutation(api.documentationQuality.acceptFinding, {
    findingId: catalogFinding._id,
    note: "Both register entries are historical; kept as recorded.",
  });
  const register = await officer.query(api.identifiers.listConflicts, {
    organizationId,
    register: "catalog",
    paginationOpts: { numItems: 10, cursor: null },
  });
  expect(
    register.page.map((row) => [row.identifier, row.review?.note]),
  ).toEqual([
    ["Old-01", "Both register entries are historical; kept as recorded."],
    [" old-01 ", "Both register entries are historical; kept as recorded."],
  ]);

  // Reviewing the accession duplicates in the identifier register is enough.
  for (const recordId of [accessionA, accessionB])
    await admin.mutation(api.identifiers.reviewConflict, {
      organizationId,
      register: "accession",
      recordId,
      note: "Two lots received under one number in 1950.",
    });
  await runCheck(t, officer, organizationId);
  expect(
    (await findings(officer, organizationId, "accepted")).map((finding) => [
      finding.kind === "duplicate_identifier" ? finding.register : null,
      finding.review?.note,
    ]),
  ).toEqual(
    expect.arrayContaining([
      ["catalog", "Both register entries are historical; kept as recorded."],
      ["accession", "Two lots received under one number in 1950."],
    ]),
  );
  expect(await findings(officer, organizationId, "open")).toEqual([]);
  expect(
    (
      await officer.query(api.collections.getObjectDetail, {
        collectionId: second,
      })
    )?.collection.accessionNumber,
  ).toBe(" old-01 ");
});

async function insertParty(
  t: ConvexTest,
  organizationId: Id<"organizations">,
  userId: Id<"users">,
  name: string,
) {
  return t.run((ctx) =>
    ctx.db.insert("accounts", {
      organizationId,
      accountNumber: `ACC-${name.length}`,
      accountType: "institution",
      businessName: name,
      createdBy: userId,
      createdAt: 1,
    }),
  );
}

test("records that name a party only in text are surfaced until staff confirm a typed link", async () => {
  const { t, admin, officer, adminId, organizationId } = await setup();
  const partyId = await insertParty(
    t,
    organizationId,
    adminId,
    "Holm Family Collection",
  );
  const nameOnly = await insertAccession(t, organizationId, {
    accessionNumber: "1987.4",
    source: "Mrs. Edith Holm",
  });
  const unlinkedAccount = await insertAccession(t, organizationId, {
    accessionNumber: "1999.2",
    source: "Holm family",
    donorAccountId: partyId,
  });
  const linked = await insertAccession(t, organizationId, {
    accessionNumber: "2003.1",
    source: "Holm Family Collection",
  });
  await admin.mutation(api.partyLinks.link, {
    target: { type: "accession", id: linked },
    accountId: partyId,
    role: "donor",
  });
  const soldObject = await insertObject(t, organizationId, adminId, {
    accessionNumber: "1970.3",
    status: "deaccessioned",
  });
  const deaccessionId = await t.run((ctx) =>
    ctx.db.insert("deaccessions", {
      organizationId,
      collectionId: soldObject,
      deaccessionNumber: "D-2012-2",
      dateDeaccessioned: Date.UTC(2012, 0, 1),
      reason: "Duplicate",
      method: "sale",
      status: "approved",
      exitRecord: {
        exitDate: Date.UTC(2012, 1, 1),
        recipient: "Antique Dealer AS",
        recordedBy: adminId,
        recordedAt: Date.UTC(2012, 1, 1),
      },
    }),
  );

  await runCheck(t, officer, organizationId);

  const legacy = await findings(officer, organizationId, "open", "legacy_link");
  expect(legacy).toHaveLength(3);
  expect(legacy).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        target: { type: "accession", id: nameOnly },
        label: "1987.4",
        assertedName: "Mrs. Edith Holm",
        suggestedRole: "donor",
      }),
      expect.objectContaining({
        target: { type: "accession", id: unlinkedAccount },
        assertedName: "Holm family",
        existingAccountId: partyId,
      }),
      expect.objectContaining({
        target: { type: "deaccession", id: deaccessionId },
        label: "D-2012-2",
        assertedName: "Antique Dealer AS",
        suggestedRole: "recipient",
      }),
    ]),
  );

  await admin.mutation(api.partyLinks.link, {
    target: { type: "accession", id: nameOnly },
    accountId: partyId,
    role: "donor",
  });
  const second = await runCheck(t, officer, organizationId);

  expect(second).toMatchObject({ number: 2, resolved: 1, opened: 0 });
  expect(
    (await findings(officer, organizationId, "resolved", "legacy_link")).map(
      (finding) => finding.kind === "legacy_link" && finding.target.id,
    ),
  ).toEqual([nameOnly]);
  expect(
    (await officer.query(api.accessions.get, { accessionId: nameOnly }))
      ?.source,
  ).toBe("Mrs. Edith Holm");
});

test("without the Accounts module party links are not checked and earlier findings stand", async () => {
  const { t, officer, organizationId } = await setup();
  await insertAccession(t, organizationId, {
    accessionNumber: "1987.4",
    source: "Mrs. Edith Holm",
  });
  await runCheck(t, officer, organizationId);
  await t.run((ctx) =>
    ctx.db.patch(organizationId, { settings: { enabledModules: [] } }),
  );

  const check = await runCheck(t, officer, organizationId);

  expect(check).toMatchObject({ partiesChecked: false, resolved: 0 });
  expect(
    await findings(officer, organizationId, "open", "legacy_link"),
  ).toHaveLength(1);
});

test("orphan references are reported as stored and the references are kept", async () => {
  const { t, officer, adminId, organizationId, foreignOrganizationId } =
    await setup();
  const foreign = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { name: "Foreign" });
    const objectId = await ctx.db.insert("collections", {
      organizationId: foreignOrganizationId,
      accessionNumber: "F-1",
      title: "Foreign object",
      status: "active",
      catalogedBy: userId,
      catalogedAt: 1,
    });
    const groupId = await ctx.db.insert("collectionGroups", {
      organizationId: foreignOrganizationId,
      name: "Foreign group",
      createdAt: 1,
      createdBy: userId,
    });
    const accountId = await ctx.db.insert("accounts", {
      organizationId: foreignOrganizationId,
      accountNumber: "ACC-F",
      accountType: "institution",
      businessName: "Foreign donor",
      createdBy: userId,
      createdAt: 1,
    });
    return { objectId, groupId, accountId };
  });
  const goneLocation = await t.run(async (ctx) => {
    const locationId = await ctx.db.insert("locations", {
      organizationId,
      name: "Demolished store",
      type: "room",
      sortOrder: 0,
      isActive: true,
    });
    await ctx.db.delete(locationId);
    return locationId;
  });
  const goneObject = await insertObject(t, organizationId, adminId, {
    accessionNumber: "GONE-1",
  });
  await t.run((ctx) => ctx.db.delete(goneObject));
  const orphan = await insertObject(t, organizationId, adminId, {
    accessionNumber: "1960.1",
    title: "Lid",
  });
  await t.run((ctx) =>
    ctx.db.patch(orphan, {
      parentObjectId: foreign.objectId,
      currentLocationId: goneLocation,
      collectionGroupId: foreign.groupId,
    }),
  );
  const selfParent = await insertObject(t, organizationId, adminId, {
    accessionNumber: "1960.2",
  });
  await t.run((ctx) =>
    ctx.db.patch(selfParent, { parentObjectId: selfParent }),
  );
  const accessionId = await insertAccession(t, organizationId, {
    accessionNumber: "1960.A",
    collectionId: goneObject,
    donorAccountId: foreign.accountId,
  });

  await runCheck(t, officer, organizationId);

  const orphans = await findings(
    officer,
    organizationId,
    "open",
    "orphan_reference",
  );
  const summary = orphans.map((finding) =>
    finding.kind === "orphan_reference"
      ? [
          finding.subject.id,
          finding.field,
          finding.referencedId,
          finding.problem,
        ]
      : null,
  );
  expect(summary).toEqual(
    expect.arrayContaining([
      [orphan, "parentObject", foreign.objectId, "other_organization"],
      [orphan, "currentLocation", goneLocation, "missing"],
      [orphan, "collectionGroup", foreign.groupId, "other_organization"],
      [selfParent, "parentObject", selfParent, "self"],
      [accessionId, "object", goneObject, "missing"],
      [accessionId, "donorAccount", foreign.accountId, "other_organization"],
    ]),
  );
  expect(summary).toHaveLength(6);
  expect(
    (
      await officer.query(api.collections.getObjectDetail, {
        collectionId: orphan,
      })
    )?.collection,
  ).toMatchObject({
    parentObjectId: foreign.objectId,
    currentLocationId: goneLocation,
  });
});

async function onlyFinding(
  member: Staff,
  organizationId: Id<"organizations">,
  status: "open" | "accepted" | "resolved",
) {
  const [finding, ...rest] = await findings(member, organizationId, status);
  expect(rest).toEqual([]);
  if (!finding) throw new Error(`No ${status} finding`);
  return finding;
}

test("an accepted exception keeps its reason until a later check finds something different", async () => {
  const { t, admin, officer, officerId, adminId, organizationId } =
    await setup();
  await admin.mutation(api.documentationQuality.createProfile, {
    organizationId,
    ...PAINTINGS,
  });
  const objectId = await insertObject(t, organizationId, adminId, {
    accessionNumber: "1990.1",
    objectType: "Painting",
  });
  await runCheck(t, officer, organizationId);
  const finding = await onlyFinding(officer, organizationId, "open");

  expect(
    await qualityFailureOf(
      officer.mutation(api.documentationQuality.acceptFinding, {
        findingId: finding._id,
        note: "  ",
      }),
    ),
  ).toMatchObject({ code: "REVIEW_NOTE_REQUIRED" });
  await officer.mutation(api.documentationQuality.acceptFinding, {
    findingId: finding._id,
    note: "Photography not permitted by the lender.",
  });
  expect(
    await qualityFailureOf(
      officer.mutation(api.documentationQuality.acceptFinding, {
        findingId: finding._id,
        note: "Again",
      }),
    ),
  ).toMatchObject({ code: "FINDING_STATUS_CHANGED" });

  expect(await runCheck(t, officer, organizationId)).toMatchObject({
    detected: 1,
    reopened: 0,
  });
  expect(await onlyFinding(officer, organizationId, "accepted")).toMatchObject({
    review: {
      note: "Photography not permitted by the lender.",
      reviewedBy: officerId,
    },
  });

  await addImage(t, organizationId, adminId, objectId);
  expect(await runCheck(t, officer, organizationId)).toMatchObject({
    reopened: 1,
  });
  expect(await onlyFinding(officer, organizationId, "open")).toMatchObject({
    _id: finding._id,
    missing: ["condition_assessment"],
    review: { note: "Photography not permitted by the lender." },
  });
});

test("a repaired finding resolves on the next check and reopens if the gap returns", async () => {
  const { t, admin, officer, adminId, organizationId } = await setup();
  await admin.mutation(api.documentationQuality.createProfile, {
    organizationId,
    name: "Located",
    stages: ["collection"],
    requirements: ["current_location"],
  });
  const objectId = await insertObject(t, organizationId, adminId, {
    accessionNumber: "1990.1",
  });
  await runCheck(t, officer, organizationId);
  const locationId = await t.run((ctx) =>
    ctx.db.insert("locations", {
      organizationId,
      name: "Store A",
      type: "room",
      sortOrder: 0,
      isActive: true,
    }),
  );
  await t.run((ctx) =>
    ctx.db.patch(objectId, { currentLocationId: locationId }),
  );

  expect(await runCheck(t, officer, organizationId)).toMatchObject({
    resolved: 1,
  });
  expect(await onlyFinding(officer, organizationId, "resolved")).toMatchObject({
    resolvedCheckNumber: 2,
    standing: false,
  });

  await t.run((ctx) =>
    ctx.db.patch(objectId, { currentLocationId: undefined }),
  );
  expect(await runCheck(t, officer, organizationId)).toMatchObject({
    reopened: 1,
    opened: 0,
  });
  expect(await onlyFinding(officer, organizationId, "open")).toMatchObject({
    firstCheckNumber: 1,
    lastCheckNumber: 3,
  });
});

test("a mistaken acceptance can be withdrawn, except for duplicates reviewed in the identifier register", async () => {
  const { t, admin, officer, adminId, organizationId } = await setup();
  await admin.mutation(api.documentationQuality.createProfile, {
    organizationId,
    name: "Located paintings",
    objectType: "Painting",
    stages: ["collection"],
    requirements: ["current_location"],
  });
  await insertObject(t, organizationId, adminId, {
    accessionNumber: "A-1",
    objectType: "Painting",
  });
  await insertObject(t, organizationId, adminId, { accessionNumber: "a-1" });
  await runCheck(t, officer, organizationId);
  const open = await findings(officer, organizationId);
  const missing = open.find((finding) => finding.kind === "missing_evidence");
  const duplicate = open.find(
    (finding) => finding.kind === "duplicate_identifier",
  );
  if (!missing || !duplicate) throw new Error("Findings missing");
  for (const finding of [missing, duplicate])
    await officer.mutation(api.documentationQuality.acceptFinding, {
      findingId: finding._id,
      note: "Reviewed",
    });

  await officer.mutation(api.documentationQuality.reopenFinding, {
    findingId: missing._id,
  });
  expect(
    await qualityFailureOf(
      officer.mutation(api.documentationQuality.reopenFinding, {
        findingId: duplicate._id,
      }),
    ),
  ).toMatchObject({ code: "REVIEWED_IN_IDENTIFIER_REGISTER" });
  expect(
    (await findings(officer, organizationId, "open")).map(
      (finding) => finding._id,
    ),
  ).toEqual([missing._id]);
});

test("a finding opens with its repair context, and outsiders see nothing", async () => {
  const { t, admin, officer, viewer, foreignAdmin, adminId, organizationId } =
    await setup();
  const partyId = await insertParty(t, organizationId, adminId, "Holm Estate");
  const accessionId = await insertAccession(t, organizationId, {
    accessionNumber: "1987.4",
    source: "Holm family",
    donorAccountId: partyId,
  });
  await runCheck(t, officer, organizationId);
  const finding = await onlyFinding(officer, organizationId, "open");

  expect(
    await officer.query(api.documentationQuality.getFinding, {
      findingId: finding._id,
    }),
  ).toMatchObject({
    finding: {
      _id: finding._id,
      kind: "legacy_link",
      assertedName: "Holm family",
    },
    records: [
      { type: "accession", id: accessionId, label: "1987.4", available: true },
    ],
    existingPartyName: "Holm Estate",
    canLinkParties: false,
  });
  expect(
    await admin.query(api.documentationQuality.getFinding, {
      findingId: finding._id,
    }),
  ).toMatchObject({ canLinkParties: true });
  expect(
    await foreignAdmin.query(api.documentationQuality.getFinding, {
      findingId: finding._id,
    }),
  ).toBeNull();
  expect(
    await officer.query(api.documentationQuality.getFinding, {
      findingId: "not-an-id",
    }),
  ).toBeNull();
  expect(
    await capabilityFailureOf(
      viewer.query(api.documentationQuality.getFinding, {
        findingId: finding._id,
      }),
    ),
  ).toMatchObject({ reason: "permission_missing" });
  expect(
    await capabilityFailureOf(
      foreignAdmin.mutation(api.documentationQuality.acceptFinding, {
        findingId: finding._id,
        note: "Not ours",
      }),
    ),
  ).toBeNull();
});

const LOCATED = {
  name: "Located objects",
  stages: ["collection" as const],
  requirements: ["current_location" as const],
};

async function overviewOf(member: Staff, organizationId: Id<"organizations">) {
  const { current } = await member.query(
    api.documentationQuality.getCheckOverview,
    { organizationId },
  );
  if (!current) throw new Error("No check");
  return current;
}

test("one check runs at a time, and a cancelled check closes no findings", async () => {
  const { t, admin, officer, adminId, organizationId } = await setup();
  await admin.mutation(api.documentationQuality.createProfile, {
    organizationId,
    ...LOCATED,
  });
  const objectId = await insertObject(t, organizationId, adminId, {
    accessionNumber: "1990.1",
  });
  await runCheck(t, officer, organizationId);
  const locationId = await t.run((ctx) =>
    ctx.db.insert("locations", {
      organizationId,
      name: "Store A",
      type: "room",
      sortOrder: 0,
      isActive: true,
    }),
  );
  await t.run((ctx) =>
    ctx.db.patch(objectId, { currentLocationId: locationId }),
  );

  const checkId = await officer.mutation(api.documentationQuality.startCheck, {
    organizationId,
  });
  expect(
    await qualityFailureOf(
      admin.mutation(api.documentationQuality.startCheck, { organizationId }),
    ),
  ).toMatchObject({ code: "CHECK_RUNNING" });
  await admin.mutation(api.documentationQuality.cancelCheck, { checkId });
  await t.finishAllScheduledFunctions(vi.runAllTimers);

  expect(await overviewOf(officer, organizationId)).toMatchObject({
    _id: checkId,
    status: "cancelled",
    resolved: 0,
  });
  expect(await findings(officer, organizationId, "open")).toHaveLength(1);
  expect(await runCheck(t, officer, organizationId)).toMatchObject({
    number: 3,
    status: "completed",
    resolved: 1,
  });
});

test("a check stops when its runner loses access and another member resumes it from the last page", async () => {
  const { t, admin, officer, officerId, adminId, organizationId } =
    await setup();
  await admin.mutation(api.documentationQuality.createProfile, {
    organizationId,
    ...LOCATED,
  });
  for (let index = 0; index < 30; index++)
    await insertObject(t, organizationId, adminId, {
      accessionNumber: `1990.${index}`,
    });
  vi.useFakeTimers();
  const checkId = await officer.mutation(api.documentationQuality.startCheck, {
    organizationId,
  });
  let checkedRecords = 0;
  for (let page = 0; page < 10 && checkedRecords === 0; page++) {
    vi.advanceTimersByTime(1);
    await t.finishInProgressScheduledFunctions();
    ({ checkedRecords } = await overviewOf(officer, organizationId));
  }
  expect(await overviewOf(officer, organizationId)).toMatchObject({
    phase: "objects_active",
    checkedRecords: 25,
  });
  await t.run(async (ctx) => {
    const membership = await ctx.db
      .query("userOrganizations")
      .withIndex("by_user_and_organization", (q) =>
        q.eq("userId", officerId).eq("organizationId", organizationId),
      )
      .unique();
    if (!membership) throw new Error("Membership missing");
    await ctx.db.delete(membership._id);
  });
  await t.finishAllScheduledFunctions(vi.runAllTimers);

  expect(await overviewOf(admin, organizationId)).toMatchObject({
    _id: checkId,
    status: "failed",
    failureCode: "ACTOR_NOT_PERMITTED",
    checkedRecords: 25,
  });
  expect(
    await capabilityFailureOf(
      officer.mutation(api.documentationQuality.resumeCheck, { checkId }),
    ),
  ).toBeNull();

  await admin.mutation(api.documentationQuality.resumeCheck, { checkId });
  await t.finishAllScheduledFunctions(vi.runAllTimers);

  expect(await overviewOf(admin, organizationId)).toMatchObject({
    status: "completed",
    attempts: 2,
    checkedRecords: 30,
    detected: 30,
    opened: 30,
  });
  expect(await findings(admin, organizationId)).toHaveLength(30);
});

test("a running check that stopped making progress can be resumed, but not before", async () => {
  const { t, admin, officer, adminId, organizationId } = await setup();
  await admin.mutation(api.documentationQuality.createProfile, {
    organizationId,
    ...LOCATED,
  });
  await insertObject(t, organizationId, adminId, { accessionNumber: "1990.1" });
  vi.useFakeTimers();
  const checkId = await officer.mutation(api.documentationQuality.startCheck, {
    organizationId,
  });
  expect(
    await qualityFailureOf(
      officer.mutation(api.documentationQuality.resumeCheck, { checkId }),
    ),
  ).toMatchObject({ code: "CHECK_NOT_RESUMABLE" });

  vi.setSystemTime(Date.now() + 11 * 60 * 1000);
  await officer.mutation(api.documentationQuality.resumeCheck, { checkId });
  await t.finishAllScheduledFunctions(vi.runAllTimers);

  expect(await overviewOf(officer, organizationId)).toMatchObject({
    status: "completed",
    attempts: 2,
    detected: 1,
    opened: 1,
  });
});

test("repair work on a finding is assigned as a case task that reaches the owner's My work", async () => {
  const {
    t,
    admin,
    officer,
    adminId,
    officerId,
    viewerId,
    organizationId,
    foreignOrganizationId,
  } = await setup();
  const ownerId = await addMember(t, organizationId, "Rosa Repairer", [
    ...OFFICER_PERMISSIONS,
    "media.read",
  ]);
  const owner = authedForUser(t, ownerId);
  await admin.mutation(api.documentationQuality.createProfile, {
    organizationId,
    ...PAINTINGS,
  });
  const objectId = await insertObject(t, organizationId, adminId, {
    accessionNumber: "1990.1",
    objectType: "Painting",
  });
  await runCheck(t, officer, organizationId);
  const finding = await onlyFinding(officer, organizationId, "open");
  const caseRef = {
    organizationId,
    caseType: "documentationFinding" as const,
    caseId: finding._id,
  };

  expect(
    (await officer.query(api.caseTasks.listAssignableMembers, caseRef)).map(
      (member) => member.userId,
    ),
  ).toEqual(expect.arrayContaining([adminId, officerId, ownerId]));
  expect(
    (await officer.query(api.caseTasks.listAssignableMembers, caseRef)).map(
      (member) => member.userId,
    ),
  ).not.toContain(viewerId);
  const ineligible = await officer
    .mutation(api.caseTasks.create, {
      ...caseRef,
      title: "Photograph",
      ownerId: viewerId,
    })
    .then(
      () => null,
      (error) => workErrorFromError(error)?.code,
    );
  expect(ineligible).toBe("ASSIGNEE_NOT_ELIGIBLE");

  const taskId = await officer.mutation(api.caseTasks.create, {
    ...caseRef,
    title: "Photograph and assess 1990.1",
    ownerId,
    reviewerId: adminId,
    dueDate: Date.UTC(2026, 11, 1),
  });

  expect(
    (
      await owner.query(api.caseTasks.listMyWork, {
        organizationId,
        paginationOpts: { numItems: 10, cursor: null },
      })
    ).page,
  ).toMatchObject([
    {
      _id: taskId,
      caseType: "documentationFinding",
      caseId: finding._id,
      caseLabel: "1990.1",
      ownerId,
    },
  ]);
  const notification = (
    await owner.query(api.notifications.getNotificationCenter, {
      organizationId,
    })
  ).notifications.find((row) => row.type === "task_assigned");
  expect(
    notificationEntityHref(
      notification?.relatedEntityType,
      notification?.relatedEntityId,
    ),
  ).toBe(`/documentation-quality/${finding._id}`);

  await addImage(t, organizationId, adminId, objectId);
  expect(
    (await owner.query(api.caseTasks.listEvidenceCandidates, caseRef)).map(
      (candidate) => candidate.reference.kind,
    ),
  ).toContain("media");

  // Finishing the task does not resolve the finding; the next check does.
  await owner.mutation(api.caseTasks.submitForReview, { taskId });
  await admin.mutation(api.caseTasks.approve, { taskId });
  expect((await onlyFinding(officer, organizationId, "open"))._id).toBe(
    finding._id,
  );

  const foreignCase = await officer
    .query(api.caseTasks.listForCase, {
      ...caseRef,
      organizationId: foreignOrganizationId,
    })
    .then(
      () => null,
      (error) => error,
    );
  expect(foreignCase).not.toBeNull();
});

test("a check of a large collection runs in bounded pages and reports complete, deterministic results", async () => {
  const { t, admin, officer, adminId, organizationId } = await setup();
  await admin.mutation(api.documentationQuality.createProfile, {
    organizationId,
    ...LOCATED,
  });
  await admin.mutation(api.documentationQuality.createProfile, {
    organizationId,
    name: "Described paintings",
    objectType: "Painting",
    stages: ["collection"],
    requirements: ["description"],
  });
  const locationId = await t.run((ctx) =>
    ctx.db.insert("locations", {
      organizationId,
      name: "Store",
      type: "room",
      sortOrder: 0,
      isActive: true,
    }),
  );
  const total = 1200;
  for (let batch = 0; batch < total; batch += 200)
    await t.run(async (ctx) => {
      for (let index = batch; index < batch + 200; index++) {
        // 30 objects share one identifier, so the group spans pages.
        const accessionNumber =
          index < 30 ? "SHARED-1" : `2000.${String(index).padStart(4, "0")}`;
        await ctx.db.insert("collections", {
          organizationId,
          accessionNumber,
          normalizedIdentifier: normalizeIdentifier(accessionNumber),
          title: `Object ${index}`,
          objectType: index % 3 === 0 ? "Painting" : "Print",
          status: "active",
          catalogedBy: adminId,
          catalogedAt: 1,
          currentLocationId: index % 2 === 0 ? locationId : undefined,
        });
      }
    });

  const check = await runCheck(t, officer, organizationId);

  // Odd objects lack a location (600); every third object is an
  // undescribed painting (400); one identifier is shared by 30 objects.
  expect(check).toMatchObject({
    status: "completed",
    checkedRecords: total,
    detected: 600 + 400 + 1,
    opened: 1001,
  });
  const duplicates = await findings(
    officer,
    organizationId,
    "open",
    "duplicate_identifier",
  );
  expect(duplicates).toMatchObject([
    { normalizedIdentifier: "shared-1", recordCount: 30 },
  ]);
  expect(
    duplicates[0]?.kind === "duplicate_identifier" &&
      duplicates[0].records.length,
  ).toBe(10);

  const rerun = await runCheck(t, officer, organizationId);
  expect(rerun).toMatchObject({
    detected: 1001,
    opened: 0,
    reopened: 0,
    resolved: 0,
  });
}, 120_000);

test("purging an organization without permanent evidence removes its quality records", async () => {
  const { t, adminId, organizationId } = await setup();
  await t.run(async (ctx) => {
    await ctx.db.patch(organizationId, { type: "library" });
    const profileId = await ctx.db.insert("documentationProfiles", {
      organizationId,
      name: "Located",
      stages: ["collection"],
      requirements: ["current_location"],
      status: "active",
      version: 1,
      createdBy: adminId,
      createdAt: 1,
      updatedBy: adminId,
      updatedAt: 1,
    });
    await ctx.db.insert("documentationChecks", {
      organizationId,
      number: 1,
      status: "completed",
      requestedBy: adminId,
      actorId: adminId,
      profiles: [],
      partiesChecked: false,
      identifierIndexIncomplete: false,
      phase: "finished",
      cursor: null,
      checkpoint: 1,
      attempts: 1,
      checkedRecords: 0,
      detected: 0,
      opened: 0,
      reopened: 0,
      resolved: 0,
      startedAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("documentationFindings", {
      organizationId,
      key: "missing_evidence:seeded",
      kind: "missing_evidence",
      // Objects are permanent evidence, so the seeded one lives elsewhere.
      objectId: await ctx.db.insert("collections", {
        organizationId: await ctx.db.insert("organizations", {
          name: "Elsewhere",
          slug: "elsewhere",
          type: "museum",
        }),
        accessionNumber: "X-1",
        title: "Elsewhere",
        status: "active",
        catalogedBy: adminId,
        catalogedAt: 1,
      }),
      objectIdentifier: "X-1",
      objectTitle: "Elsewhere",
      stage: "collection",
      profileId,
      profileName: "Located",
      missing: ["current_location"],
      status: "open",
      standing: true,
      signature: "current_location",
      firstCheckNumber: 1,
      lastCheckNumber: 1,
      firstDetectedAt: 1,
      lastDetectedAt: 1,
    });
  });

  await t.mutation(internal.organizationCleanup.purgeOrganizationsInternal, {
    organizationIds: [organizationId],
    dryRun: false,
  });

  expect(
    await t.run(async (ctx) => ({
      profiles: await ctx.db
        .query("documentationProfiles")
        .withIndex("by_organization_and_status", (q) =>
          q.eq("organizationId", organizationId),
        )
        .take(1),
      checks: await ctx.db
        .query("documentationChecks")
        .withIndex("by_organization_and_number", (q) =>
          q.eq("organizationId", organizationId),
        )
        .take(1),
      findings: await ctx.db
        .query("documentationFindings")
        .withIndex("by_organization_and_status", (q) =>
          q.eq("organizationId", organizationId),
        )
        .take(1),
    })),
  ).toEqual({ profiles: [], checks: [], findings: [] });
});
