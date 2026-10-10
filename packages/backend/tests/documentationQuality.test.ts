import { afterEach, expect, test, vi } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import {
  type QualityErrorData,
  qualityErrorFromError,
} from "../convex/utils/documentationQualityErrors";
import { normalizeIdentifier } from "../convex/utils/identifiers";
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
  await t.finishAllScheduledFunctions(vi.runAllTimers);
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
  let { profiles } = await admin.query(
    api.documentationQuality.listProfiles,
    { organizationId },
  );
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
  expect(await qualityFailureOf(create({ name: "One too many" }))).toMatchObject(
    { code: "PROFILE_LIMIT_REACHED" },
  );
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
  expect(outsider).toMatchObject({ reason: "permission_missing" });
  expect(outsider).not.toHaveProperty("capability");
  expect(
    await capabilityFailureOf(
      foreignAdmin.mutation(api.documentationQuality.archiveProfile, {
        profileId,
      }),
    ),
  ).toMatchObject({ reason: "permission_missing" });

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
  expect(register.page.map((row) => [row.identifier, row.review?.note])).toEqual(
    [
      ["Old-01", "Both register entries are historical; kept as recorded."],
      [" old-01 ", "Both register entries are historical; kept as recorded."],
    ],
  );

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
  await t.run((ctx) => ctx.db.patch(selfParent, { parentObjectId: selfParent }));
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
      ? [finding.subject.id, finding.field, finding.referencedId, finding.problem]
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
    (await officer.query(api.collections.getObjectDetail, { collectionId: orphan }))
      ?.collection,
  ).toMatchObject({
    parentObjectId: foreign.objectId,
    currentLocationId: goneLocation,
  });
});
