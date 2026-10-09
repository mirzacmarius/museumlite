import { describe, expect, test } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { partyErrorFromError } from "../convex/utils/partyErrors";
import {
  type ProvenanceErrorData,
  provenanceErrorFromError,
} from "../convex/utils/provenanceErrors";
import {
  ADMIN_ROLE_NAME,
  CATALOGER_ROLE_NAME,
  LEGACY_REGISTRAR_ROLE_NAME,
  LEGACY_VIEWER_ROLE_NAME,
} from "../convex/utils/systemRoles";
import {
  authedForUser,
  type ConvexTest,
  capabilityFailureOf,
  createConvexTest,
  createOrgUserWithPermissions,
} from "./testHarness";

const RESEARCHER = [
  "collections.read",
  "collections.update",
  "media.read",
  "accounts.read",
];
const REVIEWER = [...RESEARCHER, "collections.review_provenance"];

type Client = ReturnType<typeof authedForUser>;

async function createMuseum(t: ConvexTest, permissions = REVIEWER) {
  const setup = await createOrgUserWithPermissions(t, permissions, {
    subscriptionTier: "pro",
    enabledModules: ["accounts"],
    roleName: "Provenance researcher",
  });
  const objectId = await insertObject(t, setup.organizationId, setup.userId);
  return { ...setup, objectId, staff: authedForUser(t, setup.userId) };
}

async function insertObject(
  t: ConvexTest,
  organizationId: Id<"organizations">,
  userId: Id<"users">,
  status: "active" | "archived" = "active",
) {
  return await t.run(async (ctx) =>
    ctx.db.insert("collections", {
      organizationId,
      accessionNumber: `OBJ-${Math.random().toString(36).slice(2, 7)}`,
      title: "Portrait of a lady",
      status,
      catalogedBy: userId,
      catalogedAt: Date.now(),
    }),
  );
}

async function addMember(
  t: ConvexTest,
  organizationId: Id<"organizations">,
  permissions: string[],
  name = "Member",
) {
  const userId = await t.run(async (ctx) => {
    const [userId, roleId] = await Promise.all([
      ctx.db.insert("users", {
        name,
        email: `${name.toLowerCase().replace(/\s+/g, "-")}-${Math.random().toString(36).slice(2, 7)}@example.com`,
      }),
      ctx.db.insert("roles", { organizationId, name, isSystemRole: false }),
    ]);
    for (const permissionName of permissions) {
      const permissionId = await ctx.db.insert("permissions", {
        name: permissionName,
        category: permissionName.split(".")[0] ?? "collections",
      });
      await ctx.db.insert("rolePermissions", { roleId, permissionId });
    }
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId,
      joinedAt: Date.now(),
    });
    return userId;
  });
  return { userId, client: authedForUser(t, userId) };
}

async function insertParty(
  t: ConvexTest,
  organizationId: Id<"organizations">,
  createdBy: Id<"users">,
  businessName: string,
) {
  return await t.run(async (ctx) =>
    ctx.db.insert("accounts", {
      organizationId,
      accountNumber: `ACC-${Math.random().toString(36).slice(2, 7)}`,
      accountType: "institution",
      holderType: "privatePerson",
      businessName,
      createdBy,
      createdAt: Date.now(),
    }),
  );
}

async function insertDocument(
  t: ConvexTest,
  organizationId: Id<"organizations">,
  collectionId: Id<"collections">,
  userId: Id<"users">,
  fileName = "sale-catalogue-1925.pdf",
) {
  return await t.run(async (ctx) => {
    const storageId = await ctx.storage.store(new Blob(["catalogue"]));
    return await ctx.db.insert("mediaFiles", {
      organizationId,
      collectionId,
      storageId,
      fileName,
      fileType: "document",
      fileSize: 9,
      mimeType: "application/pdf",
      mediaCategory: "document",
      isPrimary: false,
      uploadedBy: userId,
      uploadedAt: Date.now(),
      uploadStatus: "completed",
    });
  });
}

async function provenanceErrorOf(
  call: Promise<unknown>,
): Promise<ProvenanceErrorData> {
  try {
    await call;
  } catch (error) {
    const data = provenanceErrorFromError(error);
    if (!data) throw error;
    return data;
  }
  throw new Error("Expected the call to be rejected");
}

async function claimsOf(client: Client, objectId: Id<"collections">) {
  const result = await client.query(api.provenance.listForObject, {
    objectId,
  });
  if (!result) throw new Error("Object not found");
  return result.claims;
}

const rosenbergClaim = {
  statement:
    "Paul Rosenberg, Paris, by 1937 (probably acquired from the artist).",
  role: "owner" as const,
  partyKind: "named" as const,
  partyText: "Paul Rosenberg",
  method: "purchase" as const,
  place: "Paris",
  startDate: {
    precision: "year" as const,
    year: 1937,
    qualifier: "notAfter" as const,
  },
  confidence: "probable" as const,
  evidence: [
    {
      source: {
        kind: "citation" as const,
        citation: "Rosenberg stock book, 1937",
      },
      excerpt: "No. 4521, portrait de femme",
      locator: "fol. 12",
    },
  ],
};

/** The assertion alone, for corrections that keep the carried evidence. */
const { evidence: _rosenbergEvidence, ...rosenbergAssertion } = rosenbergClaim;

describe("recording provenance claims", () => {
  test("a researcher records a claim exactly as stated, with partial dates and its evidence", async () => {
    const t = createConvexTest();
    const { staff, objectId } = await createMuseum(t);

    const claimId = await staff.mutation(api.provenance.recordClaim, {
      objectId,
      ...rosenbergClaim,
    });

    const [claim] = await claimsOf(staff, objectId);
    expect(claim).toMatchObject({
      _id: claimId,
      statement: rosenbergClaim.statement,
      role: "owner",
      partyKind: "named",
      partyText: "Paul Rosenberg",
      method: "purchase",
      place: "Paris",
      startDate: { precision: "year", year: 1937, qualifier: "notAfter" },
      confidence: "probable",
      reviewStatus: "unreviewed",
      isCurrent: true,
    });
    expect(claim?.endDate).toBeUndefined();
    expect(claim?.startDate?.month).toBeUndefined();
    expect(claim?.evidence).toEqual([
      expect.objectContaining({
        kind: "citation",
        citation: "Rosenberg stock book, 1937",
        excerpt: "No. 4521, portrait de femme",
        locator: "fol. 12",
        isActive: true,
      }),
    ]);
  });

  test("anonymous and unknown holders are kept without inventing a Party, a date or a method", async () => {
    const t = createConvexTest();
    const { staff, objectId, organizationId } = await createMuseum(t);

    await staff.mutation(api.provenance.recordClaim, {
      objectId,
      statement: "Private collection, Switzerland, c. 1950s.",
      role: "owner",
      partyKind: "anonymous",
      partyText: "Private collection, Switzerland",
      startDate: { precision: "decade", year: 1950, qualifier: "circa" },
      confidence: "unassessed",
      evidence: [],
    });
    await staff.mutation(api.provenance.recordClaim, {
      objectId,
      statement: "Whereabouts unknown, 1939 to 1945.",
      role: "owner",
      partyKind: "unknown",
      startDate: { precision: "year", year: 1939 },
      endDate: { precision: "year", year: 1945 },
      confidence: "possible",
      evidence: [],
    });

    const claims = await claimsOf(staff, objectId);
    expect(claims.map((claim) => claim.partyKind)).toEqual([
      "unknown",
      "anonymous",
    ]);
    const anonymous = claims.find((claim) => claim.partyKind === "anonymous");
    expect(anonymous?.method).toBeUndefined();
    expect(anonymous?.endDate).toBeUndefined();
    expect(anonymous?.party).toBeNull();
    const accounts = await t.run(async (ctx) =>
      ctx.db
        .query("accounts")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", organizationId),
        )
        .collect(),
    );
    expect(accounts).toEqual([]);
  });

  test("incomplete or impossible assertions are refused with stable codes", async () => {
    const t = createConvexTest();
    const { staff, objectId } = await createMuseum(t);
    const base = {
      objectId,
      statement: "A claim",
      role: "owner" as const,
      partyKind: "anonymous" as const,
      confidence: "possible" as const,
      evidence: [],
    };

    expect(
      await provenanceErrorOf(
        staff.mutation(api.provenance.recordClaim, { ...base, statement: " " }),
      ),
    ).toMatchObject({ code: "PROVENANCE_STATEMENT_REQUIRED" });
    expect(
      await provenanceErrorOf(
        staff.mutation(api.provenance.recordClaim, {
          ...base,
          partyKind: "named",
        }),
      ),
    ).toMatchObject({ code: "PROVENANCE_PARTY_NAME_REQUIRED" });
    expect(
      await provenanceErrorOf(
        staff.mutation(api.provenance.recordClaim, {
          ...base,
          partyKind: "unknown",
          partyText: "Someone",
        }),
      ),
    ).toMatchObject({ code: "PROVENANCE_PARTY_INVALID" });
    for (const startDate of [
      { precision: "month" as const, year: 1925, month: 13 },
      { precision: "day" as const, year: 1925, month: 2, day: 29 },
      { precision: "decade" as const, year: 1925 },
      { precision: "year" as const, year: 1925, month: 3 },
      { precision: "year" as const, year: 1925.5 },
    ]) {
      expect(
        await provenanceErrorOf(
          staff.mutation(api.provenance.recordClaim, { ...base, startDate }),
        ),
      ).toMatchObject({ code: "PROVENANCE_DATE_INVALID" });
    }
    expect(
      await provenanceErrorOf(
        staff.mutation(api.provenance.recordClaim, {
          ...base,
          startDate: { precision: "year", year: 1930, qualifier: "notBefore" },
          endDate: { precision: "year", year: 1920, qualifier: "notAfter" },
        }),
      ),
    ).toMatchObject({ code: "PROVENANCE_DATE_ORDER_INVALID" });
    // A leap day and an approximate overlap are valid.
    await staff.mutation(api.provenance.recordClaim, {
      ...base,
      startDate: { precision: "day", year: 1924, month: 2, day: 29 },
      endDate: { precision: "year", year: 1920, qualifier: "circa" },
    });
    expect(await claimsOf(staff, objectId)).toHaveLength(1);
  });

  test("a documented claim needs evidence, and cited files must belong to the Object", async () => {
    const t = createConvexTest();
    const { staff, objectId, organizationId, userId } = await createMuseum(t);
    const otherObjectId = await insertObject(t, organizationId, userId);
    const ownDocument = await insertDocument(
      t,
      organizationId,
      objectId,
      userId,
    );
    const otherDocument = await insertDocument(
      t,
      organizationId,
      otherObjectId,
      userId,
    );
    const claim = {
      ...rosenbergClaim,
      objectId,
      confidence: "documented" as const,
    };

    expect(
      await provenanceErrorOf(
        staff.mutation(api.provenance.recordClaim, { ...claim, evidence: [] }),
      ),
    ).toMatchObject({ code: "PROVENANCE_EVIDENCE_REQUIRED" });
    expect(
      await provenanceErrorOf(
        staff.mutation(api.provenance.recordClaim, {
          ...claim,
          evidence: [{ source: { kind: "media", mediaId: otherDocument } }],
        }),
      ),
    ).toMatchObject({ code: "PROVENANCE_EVIDENCE_INVALID" });
    expect(
      await provenanceErrorOf(
        staff.mutation(api.provenance.recordClaim, {
          ...claim,
          evidence: [
            {
              source: {
                kind: "citation",
                citation: "Archive",
                url: "javascript:alert(1)",
              },
            },
          ],
        }),
      ),
    ).toMatchObject({ code: "PROVENANCE_EVIDENCE_INVALID" });

    await staff.mutation(api.provenance.recordClaim, {
      ...claim,
      evidence: [
        { source: { kind: "media", mediaId: ownDocument }, locator: "lot 45" },
      ],
    });
    const [recorded] = await claimsOf(staff, objectId);
    expect(recorded?.evidence).toEqual([
      expect.objectContaining({
        kind: "media",
        mediaId: ownDocument,
        fileName: "sale-catalogue-1925.pdf",
        restricted: false,
        locator: "lot 45",
      }),
    ]);

    // The cited file name stays as recorded when the file is renamed.
    await t.run(async (ctx) =>
      ctx.db.patch(ownDocument, { fileName: "renamed.pdf" }),
    );
    const [afterRename] = await claimsOf(staff, objectId);
    expect(afterRename?.evidence[0]).toMatchObject({
      fileName: "sale-catalogue-1925.pdf",
    });
  });
});

describe("historical parties", () => {
  test("a named holder can be identified as a Party without dating the link, and appears in the Party's role history", async () => {
    const t = createConvexTest();
    const { staff, objectId, organizationId, userId } = await createMuseum(t);
    const partyId = await insertParty(
      t,
      organizationId,
      userId,
      "Paul Rosenberg & Co.",
    );

    const claimId = await staff.mutation(api.provenance.recordClaim, {
      objectId,
      ...rosenbergClaim,
      partyAccountId: partyId,
    });

    const [claim] = await claimsOf(staff, objectId);
    expect(claim?.party).toMatchObject({
      accountId: partyId,
      partyName: "Paul Rosenberg & Co.",
      nameSnapshot: "Paul Rosenberg & Co.",
    });
    const links = await staff.query(api.partyLinks.listForTarget, {
      target: { type: "provenanceClaim", id: claimId },
    });
    expect(links.allowedRoles).toEqual(["owner"]);
    expect(links.links).toEqual([
      expect.objectContaining({
        role: "owner",
        accountId: partyId,
        assertedName: "Paul Rosenberg",
        isCurrent: true,
      }),
    ]);
    expect(links.links[0]?.effectiveFrom).toBeUndefined();

    const history = await staff.query(api.partyLinks.listForAccount, {
      accountId: partyId,
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(history.page).toEqual([
      expect.objectContaining({
        restricted: false,
        role: "owner",
        targetType: "provenanceClaim",
        targetId: claimId,
        provenance: {
          objectId,
          startDate: { precision: "year", year: 1937, qualifier: "notAfter" },
        },
      }),
    ]);
  });

  test("a holder identified later through party links keeps the claim's wording, and anonymous holders cannot be identified", async () => {
    const t = createConvexTest();
    const { staff, objectId, organizationId, userId } = await createMuseum(t);
    const partyId = await insertParty(t, organizationId, userId, "Rosenberg");
    const namedId = await staff.mutation(api.provenance.recordClaim, {
      objectId,
      ...rosenbergClaim,
    });
    const anonymousId = await staff.mutation(api.provenance.recordClaim, {
      objectId,
      statement: "Private collection.",
      role: "owner",
      partyKind: "anonymous",
      confidence: "unassessed",
      evidence: [],
    });

    await staff.mutation(api.partyLinks.link, {
      target: { type: "provenanceClaim", id: namedId },
      accountId: partyId,
      role: "owner",
    });
    const named = await staff.query(api.partyLinks.listForTarget, {
      target: { type: "provenanceClaim", id: namedId },
    });
    expect(named.links[0]).toMatchObject({ assertedName: "Paul Rosenberg" });

    const datedLink = staff.mutation(api.partyLinks.link, {
      target: { type: "provenanceClaim", id: namedId },
      accountId: await insertParty(t, organizationId, userId, "Other"),
      role: "owner",
      effectiveFrom: Date.UTC(1937, 0, 1),
    });
    expect(partyErrorFromError(await datedLink.catch((e) => e))).toMatchObject({
      code: "PARTY_DATES_INVALID",
    });

    const anonymousLink = staff.mutation(api.partyLinks.link, {
      target: { type: "provenanceClaim", id: anonymousId },
      accountId: partyId,
      role: "owner",
    });
    expect(
      partyErrorFromError(await anonymousLink.catch((e) => e)),
    ).toMatchObject({ code: "PARTY_ROLE_NOT_ALLOWED" });
    expect(
      await provenanceErrorOf(
        staff.mutation(api.provenance.recordClaim, {
          objectId,
          statement: "Private collection.",
          role: "owner",
          partyKind: "anonymous",
          confidence: "unassessed",
          evidence: [],
          partyAccountId: partyId,
        }),
      ),
    ).toMatchObject({ code: "PROVENANCE_PARTY_INVALID" });
  });

  test("a Party from another organization is refused and nothing is written", async () => {
    const t = createConvexTest();
    const { staff, objectId } = await createMuseum(t);
    const other = await createMuseum(t);
    const foreignParty = await insertParty(
      t,
      other.organizationId,
      other.userId,
      "Foreign dealer",
    );

    const call = staff.mutation(api.provenance.recordClaim, {
      objectId,
      ...rosenbergClaim,
      partyAccountId: foreignParty,
    });
    expect(partyErrorFromError(await call.catch((e) => e))).toMatchObject({
      code: "PARTY_NOT_FOUND",
    });
    expect(await claimsOf(staff, objectId)).toEqual([]);
  });
});

describe("corrections and contradictions", () => {
  test("a correction supersedes the claim, keeps the original wording and carries the evidence forward", async () => {
    const t = createConvexTest();
    const { staff, objectId, organizationId, userId } = await createMuseum(t);
    const partyId = await insertParty(t, organizationId, userId, "Rosenberg");
    const originalId = await staff.mutation(api.provenance.recordClaim, {
      objectId,
      ...rosenbergClaim,
      partyAccountId: partyId,
    });

    expect(
      await provenanceErrorOf(
        staff.mutation(api.provenance.correctClaim, {
          claimId: originalId,
          reason: "  ",
          ...rosenbergAssertion,
        }),
      ),
    ).toMatchObject({ code: "PROVENANCE_REASON_REQUIRED" });

    const correctedId = await staff.mutation(api.provenance.correctClaim, {
      claimId: originalId,
      reason: "Stock book gives 1936",
      ...rosenbergAssertion,
      statement: "Paul Rosenberg, Paris, by 1936.",
      startDate: { precision: "year", year: 1936, qualifier: "notAfter" },
      partyAccountId: partyId,
    });

    const claims = await claimsOf(staff, objectId);
    const original = claims.find((claim) => claim._id === originalId);
    const corrected = claims.find((claim) => claim._id === correctedId);
    expect(original).toMatchObject({
      statement: rosenbergClaim.statement,
      startDate: { year: 1937 },
      isCurrent: false,
      supersededByClaimId: correctedId,
      supersessionReason: "Stock book gives 1936",
    });
    expect(original?.evidence).toHaveLength(1);
    expect(corrected).toMatchObject({
      statement: "Paul Rosenberg, Paris, by 1936.",
      supersedesClaimId: originalId,
      reviewStatus: "unreviewed",
      isCurrent: true,
      party: expect.objectContaining({ accountId: partyId }),
    });
    expect(corrected?.evidence).toEqual([
      expect.objectContaining({
        citation: "Rosenberg stock book, 1937",
        isActive: true,
      }),
    ]);

    // Retrying the correction against the superseded claim writes nothing.
    expect(
      await provenanceErrorOf(
        staff.mutation(api.provenance.correctClaim, {
          claimId: originalId,
          reason: "Stock book gives 1936",
          ...rosenbergAssertion,
        }),
      ),
    ).toMatchObject({ code: "PROVENANCE_CLAIM_SUPERSEDED" });
    expect(await claimsOf(staff, objectId)).toHaveLength(2);
    // The superseded claim's party link is closed to changes.
    const links = await staff.query(api.partyLinks.listForTarget, {
      target: { type: "provenanceClaim", id: originalId },
    });
    expect(links.policy).toBe("closed");
  });

  test("a correction may keep a holder whose Party was archived since, but not pick another archived Party", async () => {
    const t = createConvexTest();
    const { staff, objectId, organizationId, userId } = await createMuseum(t);
    const partyId = await insertParty(t, organizationId, userId, "Rosenberg");
    const otherId = await insertParty(t, organizationId, userId, "Other");
    const claimId = await staff.mutation(api.provenance.recordClaim, {
      objectId,
      ...rosenbergClaim,
      partyAccountId: partyId,
    });
    await t.run(async (ctx) => {
      await ctx.db.patch(partyId, { status: "archived" });
      await ctx.db.patch(otherId, { status: "archived" });
    });

    const refused = staff.mutation(api.provenance.correctClaim, {
      claimId,
      reason: "Wrong dealer",
      ...rosenbergAssertion,
      partyAccountId: otherId,
    });
    expect(partyErrorFromError(await refused.catch((e) => e))).toMatchObject({
      code: "PARTY_ARCHIVED",
    });
    const correctedId = await staff.mutation(api.provenance.correctClaim, {
      claimId,
      reason: "Stock book gives 1936",
      ...rosenbergAssertion,
      partyAccountId: partyId,
    });
    const corrected = (await claimsOf(staff, objectId)).find(
      (claim) => claim._id === correctedId,
    );
    expect(corrected?.party).toMatchObject({
      accountId: partyId,
      partyArchived: true,
    });
  });

  test("contradictory claims are both kept for review, and a reviewer's decision changes neither", async () => {
    const t = createConvexTest();
    const { staff, objectId, organizationId, userId } = await createMuseum(t);
    const firstId = await staff.mutation(api.provenance.recordClaim, {
      objectId,
      ...rosenbergClaim,
    });
    const secondId = await staff.mutation(api.provenance.recordClaim, {
      objectId,
      statement: "Galerie Wildenstein, Paris, 1935 to 1938.",
      role: "custodian",
      partyKind: "named",
      partyText: "Galerie Wildenstein",
      startDate: { precision: "year", year: 1935 },
      endDate: { precision: "year", year: 1938 },
      confidence: "possible",
      contradictsClaimId: firstId,
      evidence: [],
    });

    let claims = await claimsOf(staff, objectId);
    expect(claims.find((claim) => claim._id === secondId)).toMatchObject({
      contradictsClaimId: firstId,
      isCurrent: true,
    });
    expect(claims.find((claim) => claim._id === firstId)).toMatchObject({
      contradictedByClaimIds: [secondId],
      isCurrent: true,
    });

    expect(
      await provenanceErrorOf(
        staff.mutation(api.provenance.reviewClaim, {
          claimId: secondId,
          decision: "rejected",
        }),
      ),
    ).toMatchObject({ code: "PROVENANCE_REVIEW_NOTE_REQUIRED" });
    await staff.mutation(api.provenance.reviewClaim, {
      claimId: secondId,
      decision: "rejected",
      note: "Wildenstein invoice is for a different portrait",
    });
    await staff.mutation(api.provenance.reviewClaim, {
      claimId: firstId,
      decision: "accepted",
    });

    claims = await claimsOf(staff, objectId);
    expect(claims.find((claim) => claim._id === secondId)).toMatchObject({
      statement: "Galerie Wildenstein, Paris, 1935 to 1938.",
      reviewStatus: "rejected",
      reviewNote: "Wildenstein invoice is for a different portrait",
      isCurrent: true,
    });
    expect(claims.find((claim) => claim._id === firstId)).toMatchObject({
      reviewStatus: "accepted",
      statement: rosenbergClaim.statement,
    });

    // A contradiction must point at a current claim about the same Object.
    const otherObjectId = await insertObject(t, organizationId, userId);
    expect(
      await provenanceErrorOf(
        staff.mutation(api.provenance.recordClaim, {
          objectId: otherObjectId,
          ...rosenbergClaim,
          contradictsClaimId: firstId,
        }),
      ),
    ).toMatchObject({ code: "PROVENANCE_CONTRADICTION_INVALID" });
  });

  test("a retracted claim leaves current provenance but stays in the history", async () => {
    const t = createConvexTest();
    const { staff, objectId } = await createMuseum(t);
    const claimId = await staff.mutation(api.provenance.recordClaim, {
      objectId,
      ...rosenbergClaim,
    });

    await staff.mutation(api.provenance.retractClaim, {
      claimId,
      reason: "Recorded on the wrong object",
    });

    const [claim] = await claimsOf(staff, objectId);
    expect(claim).toMatchObject({
      statement: rosenbergClaim.statement,
      isCurrent: false,
      supersessionReason: "Recorded on the wrong object",
    });
    expect(claim?.supersededByClaimId).toBeUndefined();
    expect(
      await provenanceErrorOf(
        staff.mutation(api.provenance.reviewClaim, {
          claimId,
          decision: "accepted",
        }),
      ),
    ).toMatchObject({ code: "PROVENANCE_CLAIM_SUPERSEDED" });
  });
});

describe("evidence", () => {
  test("evidence is added and retracted with a reason, never removed, and a documented claim keeps at least one", async () => {
    const t = createConvexTest();
    const { staff, objectId } = await createMuseum(t);
    const claimId = await staff.mutation(api.provenance.recordClaim, {
      objectId,
      ...rosenbergClaim,
      confidence: "documented",
    });
    const [first] = (await claimsOf(staff, objectId))[0]?.evidence ?? [];
    if (!first) throw new Error("Expected evidence");

    expect(
      await provenanceErrorOf(
        staff.mutation(api.provenance.retractEvidence, {
          evidenceId: first._id,
          reason: "Wrong stock book",
        }),
      ),
    ).toMatchObject({ code: "PROVENANCE_EVIDENCE_REQUIRED" });

    await staff.mutation(api.provenance.addEvidence, {
      claimId,
      source: {
        kind: "citation",
        citation: "Rosenberg archive, MoMA",
        url: "https://example.org/rosenberg",
      },
    });
    await staff.mutation(api.provenance.retractEvidence, {
      evidenceId: first._id,
      reason: "Wrong stock book",
    });
    expect(
      await provenanceErrorOf(
        staff.mutation(api.provenance.retractEvidence, {
          evidenceId: first._id,
          reason: "Wrong stock book",
        }),
      ),
    ).toMatchObject({ code: "PROVENANCE_EVIDENCE_RETRACTED" });

    const [claim] = await claimsOf(staff, objectId);
    expect(claim?.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          _id: first._id,
          citation: "Rosenberg stock book, 1937",
          isActive: false,
          retractionReason: "Wrong stock book",
        }),
        expect.objectContaining({
          citation: "Rosenberg archive, MoMA",
          url: "https://example.org/rosenberg",
          isActive: true,
        }),
      ]),
    );
  });

  test("file evidence is redacted for staff without media access", async () => {
    const t = createConvexTest();
    const { staff, objectId, organizationId, userId } = await createMuseum(t);
    const documentId = await insertDocument(
      t,
      organizationId,
      objectId,
      userId,
    );
    await staff.mutation(api.provenance.recordClaim, {
      objectId,
      ...rosenbergClaim,
      evidence: [{ source: { kind: "media", mediaId: documentId } }],
    });
    const reader = await addMember(t, organizationId, ["collections.read"]);

    const [claim] = await claimsOf(reader.client, objectId);
    expect(claim?.evidence).toEqual([
      expect.objectContaining({ kind: "media", restricted: true }),
    ]);
    expect(claim?.evidence[0]).not.toHaveProperty("fileName");
    expect(claim?.evidence[0]).not.toHaveProperty("mediaId");
  });
});

describe("access", () => {
  test("readers see claims, only researchers record and only reviewers review", async () => {
    const t = createConvexTest();
    const { staff, objectId, organizationId } = await createMuseum(t);
    const claimId = await staff.mutation(api.provenance.recordClaim, {
      objectId,
      ...rosenbergClaim,
    });
    const reader = await addMember(t, organizationId, ["collections.read"]);
    const researcher = await addMember(t, organizationId, RESEARCHER);

    const readerView = await reader.client.query(api.provenance.listForObject, {
      objectId,
    });
    expect(readerView?.viewer).toEqual({
      canRecord: false,
      canReview: false,
      canLinkParties: false,
    });
    expect(readerView?.claims).toHaveLength(1);
    expect(
      await capabilityFailureOf(
        reader.client.mutation(api.provenance.recordClaim, {
          objectId,
          ...rosenbergClaim,
        }),
      ),
    ).toMatchObject({ reason: "permission_missing" });
    expect(
      await capabilityFailureOf(
        researcher.client.mutation(api.provenance.reviewClaim, {
          claimId,
          decision: "accepted",
        }),
      ),
    ).toMatchObject({ reason: "permission_missing" });
    expect(
      (
        await researcher.client.query(api.provenance.listForObject, {
          objectId,
        })
      )?.viewer,
    ).toEqual({ canRecord: true, canReview: false, canLinkParties: true });
  });

  test("non-members and anonymous callers learn nothing and write nothing", async () => {
    const t = createConvexTest();
    const { staff, objectId, organizationId } = await createMuseum(t);
    const claimId = await staff.mutation(api.provenance.recordClaim, {
      objectId,
      ...rosenbergClaim,
    });
    const outsider = await createMuseum(t);

    await expect(
      outsider.staff.query(api.provenance.listForObject, { objectId }),
    ).rejects.toThrow();
    await expect(
      t.query(api.provenance.listForObject, { objectId }),
    ).rejects.toThrow();
    await expect(
      outsider.staff.mutation(api.provenance.reviewClaim, {
        claimId,
        decision: "accepted",
      }),
    ).rejects.toThrow();
    await expect(
      outsider.staff.mutation(api.provenance.recordClaim, {
        objectId,
        ...rosenbergClaim,
      }),
    ).rejects.toThrow();
    await expect(
      outsider.staff.query(api.provenance.reviewQueue, {
        organizationId,
        status: "unreviewed",
        paginationOpts: { numItems: 10, cursor: null },
      }),
    ).rejects.toThrow();
    const [claim] = await claimsOf(staff, objectId);
    expect(claim?.reviewStatus).toBe("unreviewed");
  });

  test("provenance is read-only while the Object is withdrawn", async () => {
    const t = createConvexTest();
    const { staff, objectId } = await createMuseum(t);
    const claimId = await staff.mutation(api.provenance.recordClaim, {
      objectId,
      ...rosenbergClaim,
    });
    await t.run(async (ctx) =>
      ctx.db.patch(objectId, { status: "archived", archivedAt: Date.now() }),
    );

    expect(
      await provenanceErrorOf(
        staff.mutation(api.provenance.recordClaim, {
          objectId,
          ...rosenbergClaim,
        }),
      ),
    ).toMatchObject({ code: "PROVENANCE_OBJECT_WITHDRAWN" });
    expect(
      await provenanceErrorOf(
        staff.mutation(api.provenance.reviewClaim, {
          claimId,
          decision: "accepted",
        }),
      ),
    ).toMatchObject({ code: "PROVENANCE_OBJECT_WITHDRAWN" });
    const view = await staff.query(api.provenance.listForObject, { objectId });
    expect(view).toMatchObject({ objectWithdrawn: true });
    expect(view?.claims).toHaveLength(1);
    const links = await staff.query(api.partyLinks.listForTarget, {
      target: { type: "provenanceClaim", id: claimId },
    });
    expect(links.policy).toBe("closed");
  });
});

describe("review queue", () => {
  test("lists current unreviewed or disputed claims with their Object, newest first", async () => {
    const t = createConvexTest();
    const { staff, objectId, organizationId } = await createMuseum(t);
    const firstId = await staff.mutation(api.provenance.recordClaim, {
      objectId,
      ...rosenbergClaim,
    });
    const secondId = await staff.mutation(api.provenance.recordClaim, {
      objectId,
      ...rosenbergClaim,
      statement: "Second claim",
    });
    const correctedId = await staff.mutation(api.provenance.correctClaim, {
      claimId: firstId,
      reason: "Typo",
      ...rosenbergAssertion,
      statement: "Corrected claim",
    });
    await staff.mutation(api.provenance.reviewClaim, {
      claimId: secondId,
      decision: "disputed",
      note: "Conflicts with the dealer's records",
    });

    const unreviewed = await staff.query(api.provenance.reviewQueue, {
      organizationId,
      status: "unreviewed",
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(unreviewed.page.map((item) => item.claimId)).toEqual([correctedId]);
    expect(unreviewed.page[0]).toMatchObject({
      objectId,
      objectLabel: expect.stringContaining("Portrait of a lady"),
      statement: "Corrected claim",
    });
    const disputed = await staff.query(api.provenance.reviewQueue, {
      organizationId,
      status: "disputed",
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(disputed.page.map((item) => item.claimId)).toEqual([secondId]);

    const researcher = await addMember(t, organizationId, RESEARCHER);
    expect(
      await capabilityFailureOf(
        researcher.client.query(api.provenance.reviewQueue, {
          organizationId,
          status: "unreviewed",
          paginationOpts: { numItems: 10, cursor: null },
        }),
      ),
    ).toMatchObject({ reason: "permission_missing" });
  });

  test("repeating the same review decision records it once", async () => {
    const t = createConvexTest();
    const { staff, objectId, organizationId } = await createMuseum(t);
    const claimId = await staff.mutation(api.provenance.recordClaim, {
      objectId,
      ...rosenbergClaim,
    });
    for (let attempt = 0; attempt < 2; attempt++) {
      await staff.mutation(api.provenance.reviewClaim, {
        claimId,
        decision: "accepted",
      });
    }
    const reviewEntries = await t.run(async (ctx) =>
      (
        await ctx.db
          .query("auditLog")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organizationId),
          )
          .collect()
      ).filter((entry) => entry.action === "provenance_claim_reviewed"),
    );
    expect(reviewEntries).toHaveLength(1);
  });
});

describe("review permission rollout", () => {
  test("grants collections.review_provenance to reviewer system roles only, once", async () => {
    const t = createConvexTest();
    const roles = await t.run(async (ctx) => {
      const organizationId = await ctx.db.insert("organizations", {
        name: "Rollout Museum",
        slug: `rollout-${Math.random().toString(36).slice(2, 8)}`,
        type: "museum",
      });
      const role = (name: string, isSystemRole = true) =>
        ctx.db.insert("roles", { organizationId, name, isSystemRole });
      return {
        organizationId,
        admin: await role(ADMIN_ROLE_NAME),
        registrar: await role(LEGACY_REGISTRAR_ROLE_NAME),
        cataloger: await role(CATALOGER_ROLE_NAME),
        viewer: await role(LEGACY_VIEWER_ROLE_NAME),
        custom: await role("Volunteer", false),
      };
    });
    for (let run = 0; run < 2; run++) {
      await t.mutation(internal.provenanceMigration.grantReviewPermission, {
        organizationId: roles.organizationId,
      });
    }
    const grants = await t.run(async (ctx) => {
      const permission = (
        await ctx.db
          .query("permissions")
          .withIndex("by_category", (q) => q.eq("category", "collections"))
          .collect()
      ).find((row) => row.name === "collections.review_provenance");
      const count = async (roleId: Id<"roles">) =>
        (
          await ctx.db
            .query("rolePermissions")
            .withIndex("by_role", (q) => q.eq("roleId", roleId))
            .collect()
        ).filter((grant) => grant.permissionId === permission?._id).length;
      return {
        admin: await count(roles.admin),
        registrar: await count(roles.registrar),
        cataloger: await count(roles.cataloger),
        viewer: await count(roles.viewer),
        custom: await count(roles.custom),
      };
    });
    expect(grants).toEqual({
      admin: 1,
      registrar: 1,
      cataloger: 0,
      viewer: 0,
      custom: 0,
    });
  });
});
