import { describe, expect, test } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import * as recordEdits from "../convex/recordEdits";
import {
  editVersionOf as digestOf,
  enteredRightsStatement,
  type RecordEditErrorData,
  recordEditErrorFromError,
} from "../convex/utils/recordEdits";
import { expectMatchesReturns } from "./returnsValidation";
import {
  authedForUser,
  type ConvexTest,
  capabilityFailureOf,
  createConvexTest,
  createOrgUserWithPermissions,
} from "./testHarness";

type Client = ReturnType<typeof authedForUser>;
type EditTarget = Parameters<typeof api.recordEdits.getEditState>[0]["target"];

const CC0 = "https://creativecommons.org/publicdomain/zero/1.0/";

const CATALOGUER_PERMISSIONS = [
  "collections.create",
  "collections.read",
  "collections.update",
];

/** Awaits a save expected to fail and returns its coded form error. */
async function recordEditErrorOf(
  call: Promise<unknown>,
): Promise<RecordEditErrorData> {
  try {
    await call;
  } catch (error) {
    const data = recordEditErrorFromError(error);
    if (!data) throw error;
    return data;
  }
  throw new Error("Expected the save to be rejected");
}

async function addMemberUser(
  t: ConvexTest,
  organizationId: Id<"organizations">,
  permissions: string[],
  name: string,
) {
  return await t.run(async (ctx) => {
    const [userId, roleId] = await Promise.all([
      ctx.db.insert("users", {
        name,
        email: `${name.toLowerCase().replace(/\s+/g, "-")}@example.com`,
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
}

async function addMember(
  t: ConvexTest,
  organizationId: Id<"organizations">,
  permissions: string[],
  name: string,
) {
  return authedForUser(
    t,
    await addMemberUser(t, organizationId, permissions, name),
  );
}

async function editVersionOf(client: Client, target: EditTarget) {
  const state = await client.query(api.recordEdits.getEditState, { target });
  expectMatchesReturns(recordEdits.getEditState, state);
  if (!state) throw new Error("Expected an edit state");
  return state.editVersion;
}

async function createCataloguedObject(t: ConvexTest) {
  const setup = await createOrgUserWithPermissions(t, CATALOGUER_PERMISSIONS, {
    roleName: "Cataloguer",
    userName: "Ana Cataloguer",
  });
  const collectionId = await t.run((ctx) =>
    ctx.db.insert("collections", {
      organizationId: setup.organizationId,
      accessionNumber: "1998.12.4",
      title: "Harbour at dusk",
      description: "Oil on canvas.",
      status: "active",
      catalogedBy: setup.userId,
      catalogedAt: Date.now(),
    }),
  );
  const ana = authedForUser(t, setup.userId);
  const ben = await addMember(
    t,
    setup.organizationId,
    CATALOGUER_PERMISSIONS,
    "Ben Registrar",
  );
  return { ...setup, collectionId, ana, ben };
}

describe("catalog object edits", () => {
  test("a save based on an outdated version is refused and keeps the colleague's change", async () => {
    const t = createConvexTest();
    const { collectionId, ana, ben } = await createCataloguedObject(t);
    const target = { type: "object" as const, id: collectionId };
    const anaOpened = await editVersionOf(ana, target);

    await ben.mutation(api.collections.update, {
      collectionId,
      title: "Harbour at Dusk (Bergen)",
      expectedEditVersion: await editVersionOf(ben, target),
    });

    const conflict = await recordEditErrorOf(
      ana.mutation(api.collections.update, {
        collectionId,
        description: "Oil on canvas, relined 1972.",
        expectedEditVersion: anaOpened,
      }),
    );
    expect(conflict.code).toBe("EDIT_CONFLICT");
    expect(
      await ana.query(api.collections.get, { collectionId }),
    ).toMatchObject({
      title: "Harbour at Dusk (Bergen)",
      description: "Oil on canvas.",
    });

    await ana.mutation(api.collections.update, {
      collectionId,
      description: "Oil on canvas, relined 1972.",
      expectedEditVersion: await editVersionOf(ana, target),
    });
    expect(
      await ana.query(api.collections.get, { collectionId }),
    ).toMatchObject({
      title: "Harbour at Dusk (Bergen)",
      description: "Oil on canvas, relined 1972.",
    });
  });

  test("a save returns the version the form sees next", async () => {
    const t = createConvexTest();
    const { collectionId, ana } = await createCataloguedObject(t);
    const target = { type: "object" as const, id: collectionId };

    const saved = await ana.mutation(api.collections.update, {
      collectionId,
      creator: "Hans Gude",
      expectedEditVersion: await editVersionOf(ana, target),
    });

    expect(saved.editVersion).toBe(await editVersionOf(ana, target));
  });

  test("a location move by a colleague outdates an open form", async () => {
    const t = createConvexTest();
    const { organizationId, collectionId, ana } =
      await createCataloguedObject(t);
    const lena = await addMember(
      t,
      organizationId,
      ["collections.read", "locations.update"],
      "Lena Store Manager",
    );
    const target = { type: "object" as const, id: collectionId };
    const anaOpened = await editVersionOf(ana, target);
    const storeId = await t.run((ctx) =>
      ctx.db.insert("locations", {
        organizationId,
        name: "Store B",
        type: "storage",
        sortOrder: 0,
        isActive: true,
      }),
    );

    await lena.mutation(api.collections.bulkUpdateLocation, {
      collectionIds: [collectionId],
      locationId: storeId,
    });

    const conflict = await recordEditErrorOf(
      ana.mutation(api.collections.update, {
        collectionId,
        description: "Oil on canvas, relined 1972.",
        expectedEditVersion: anaOpened,
      }),
    );
    expect(conflict).toMatchObject({
      code: "EDIT_CONFLICT",
      currentEditVersion: await editVersionOf(ana, target),
    });
  });

  test("a save that changes nothing leaves colleagues' forms current", async () => {
    const t = createConvexTest();
    const { collectionId, ana, ben } = await createCataloguedObject(t);
    const target = { type: "object" as const, id: collectionId };
    const anaOpened = await editVersionOf(ana, target);

    await ben.mutation(api.collections.update, {
      collectionId,
      title: "Harbour at dusk",
      description: "Oil on canvas.",
      expectedEditVersion: await editVersionOf(ben, target),
    });

    await ana.mutation(api.collections.update, {
      collectionId,
      description: "Oil on canvas, relined 1972.",
      expectedEditVersion: anaOpened,
    });
    expect(
      await ana.query(api.collections.get, { collectionId }),
    ).toMatchObject({ description: "Oil on canvas, relined 1972." });
  });

  test("an empty title is refused at the title field and the title stays", async () => {
    const t = createConvexTest();
    const { collectionId, ana } = await createCataloguedObject(t);

    const refusal = await recordEditErrorOf(
      ana.mutation(api.collections.update, { collectionId, title: "  " }),
    );

    expect(refusal).toMatchObject({ code: "FIELD_REQUIRED", field: "title" });
    expect(
      await ana.query(api.collections.get, { collectionId }),
    ).toMatchObject({ title: "Harbour at dusk" });
  });

  test("parents and groups must be other records of the same organization", async () => {
    const t = createConvexTest();
    const { collectionId, ana } = await createCataloguedObject(t);
    const elsewhere = await createOrgUserWithPermissions(
      t,
      CATALOGUER_PERMISSIONS,
      { organizationName: "Other Museum" },
    );
    const [foreignObjectId, foreignGroupId] = await t.run(async (ctx) => [
      await ctx.db.insert("collections", {
        organizationId: elsewhere.organizationId,
        accessionNumber: "X.1",
        title: "Foreign object",
        status: "active",
        catalogedBy: elsewhere.userId,
        catalogedAt: Date.now(),
      }),
      await ctx.db.insert("collectionGroups", {
        organizationId: elsewhere.organizationId,
        name: "Foreign group",
        createdAt: Date.now(),
        createdBy: elsewhere.userId,
      }),
    ]);

    expect(
      await recordEditErrorOf(
        ana.mutation(api.collections.update, {
          collectionId,
          parentObjectId: collectionId,
        }),
      ),
    ).toMatchObject({ code: "PARENT_IS_SELF", field: "parentObjectId" });
    expect(
      await recordEditErrorOf(
        ana.mutation(api.collections.update, {
          collectionId,
          parentObjectId: foreignObjectId,
        }),
      ),
    ).toMatchObject({
      code: "RELATED_RECORD_UNAVAILABLE",
      field: "parentObjectId",
    });
    expect(
      await recordEditErrorOf(
        ana.mutation(api.collections.update, {
          collectionId,
          collectionGroupIds: [foreignGroupId],
        }),
      ),
    ).toMatchObject({
      code: "RELATED_RECORD_UNAVAILABLE",
      field: "collectionGroupIds",
    });
    const stored = await ana.query(api.collections.get, { collectionId });
    expect(stored?.parentObjectId).toBeUndefined();
    expect(stored?.collectionGroupId).toBeUndefined();
  });

  test("a recorded condition changes only with a note, never over an accepted assessment", async () => {
    const t = createConvexTest();
    const { collectionId, ana } = await createCataloguedObject(t);
    await ana.mutation(api.collections.update, {
      collectionId,
      condition: "Good",
    });

    expect(
      await recordEditErrorOf(
        ana.mutation(api.collections.update, {
          collectionId,
          condition: "Fair",
        }),
      ),
    ).toMatchObject({
      code: "CONDITION_NOTE_REQUIRED",
      field: "conditionChangeNote",
    });

    await t.run(async (ctx) => {
      const object = await ctx.db.get(collectionId);
      if (!object) throw new Error("Expected the object");
      const assessmentId = await ctx.db.insert("conditionAssessments", {
        organizationId: object.organizationId,
        collectionId,
        assessedAt: Date.now(),
        recordedAt: Date.now(),
        assessedBy: object.catalogedBy,
        condition: "Good",
        summary: "Stable.",
        observations: [],
        photos: [],
        status: "accepted",
      });
      await ctx.db.patch(collectionId, {
        currentConditionAssessmentId: assessmentId,
      });
    });
    expect(
      await recordEditErrorOf(
        ana.mutation(api.collections.update, {
          collectionId,
          condition: "Fair",
          conditionChangeNote: "Flaking along the lower edge.",
        }),
      ),
    ).toMatchObject({
      code: "CONDITION_SET_BY_ASSESSMENT",
      field: "condition",
    });
    expect(
      await ana.query(api.collections.get, { collectionId }),
    ).toMatchObject({ condition: "Good" });
  });

  test("cleared measurements and parent object are saved as cleared", async () => {
    const t = createConvexTest();
    const { organizationId, userId, collectionId, ana } =
      await createCataloguedObject(t);
    const parentId = await t.run((ctx) =>
      ctx.db.insert("collections", {
        organizationId,
        accessionNumber: "1998.12",
        title: "Harbour series",
        status: "active",
        catalogedBy: userId,
        catalogedAt: Date.now(),
      }),
    );
    await ana.mutation(api.collections.update, {
      collectionId,
      parentObjectId: parentId,
      dimensionHeight: 61,
      dimensionWidth: 92,
      dimensionDepth: 3,
      dimensionUnit: "cm",
    });

    await ana.mutation(api.collections.update, {
      collectionId,
      parentObjectId: null,
      dimensionHeight: null,
      dimensionWidth: 90,
      dimensionDepth: null,
    });

    const stored = await ana.query(api.collections.get, { collectionId });
    expect(stored?.parentObjectId).toBeUndefined();
    expect(stored?.dimensionHeight).toBeUndefined();
    expect(stored?.dimensionDepth).toBeUndefined();
    expect(stored).toMatchObject({ dimensionWidth: 90, dimensionUnit: "cm" });
  });

  test("a member who may only read is refused at save and nothing changes", async () => {
    const t = createConvexTest();
    const { organizationId, collectionId } = await createCataloguedObject(t);
    const reader = await addMember(
      t,
      organizationId,
      ["collections.read"],
      "Rita Reader",
    );
    const target = { type: "object" as const, id: collectionId };

    const refusal = await capabilityFailureOf(
      reader.mutation(api.collections.update, {
        collectionId,
        title: "Renamed",
        expectedEditVersion: await editVersionOf(reader, target),
      }),
    );

    expect(refusal).toMatchObject({ reason: "permission_missing" });
    expect(
      await reader.query(api.collections.get, { collectionId }),
    ).toMatchObject({ title: "Harbour at dusk" });
  });

  test("a structured date made is stored canonical, refused at its field when it is not EDTF, and cleared by an empty value", async () => {
    const t = createConvexTest();
    const { collectionId, ana } = await createCataloguedObject(t);
    const stored = async () =>
      await ana.query(api.collections.get, { collectionId });

    await ana.mutation(api.collections.update, {
      collectionId,
      dateCreated: "about 1850",
      dateCreatedEdtf: " 1848/1852 ",
    });
    expect(await stored()).toMatchObject({
      dateCreated: "about 1850",
      dateCreatedEdtf: "1848/1852",
    });

    for (const invalid of ["1850s", "1850-02-30", "1860/1850"]) {
      expect(
        await recordEditErrorOf(
          ana.mutation(api.collections.update, {
            collectionId,
            dateCreatedEdtf: invalid,
          }),
        ),
      ).toMatchObject({
        code: "PRODUCTION_DATE_INVALID",
        field: "dateCreatedEdtf",
      });
    }
    expect((await stored())?.dateCreatedEdtf).toBe("1848/1852");

    await ana.mutation(api.collections.update, {
      collectionId,
      dateCreatedEdtf: "",
    });
    expect((await stored())?.dateCreatedEdtf).toBeUndefined();
    await ana.mutation(api.collections.update, {
      collectionId,
      dateCreatedEdtf: "/-0499~",
    });
    expect((await stored())?.dateCreatedEdtf).toBe("../-0499~");
    await ana.mutation(api.collections.update, {
      collectionId,
      dateCreatedEdtf: null,
    });
    expect(await stored()).toMatchObject({ dateCreated: "about 1850" });
    expect((await stored())?.dateCreatedEdtf).toBeUndefined();
  });

  test("a new Object's structured date made is checked the same way", async () => {
    const t = createConvexTest();
    const { organizationId, ana } = await createCataloguedObject(t);

    expect(
      await recordEditErrorOf(
        ana.mutation(api.collections.create, {
          organizationId,
          accessionNumber: "2026.1",
          title: "Jug",
          dateCreatedEdtf: "c. 1850",
        }),
      ),
    ).toMatchObject({
      code: "PRODUCTION_DATE_INVALID",
      field: "dateCreatedEdtf",
    });
    const collectionId = await ana.mutation(api.collections.create, {
      organizationId,
      accessionNumber: "2026.1",
      title: "Jug",
      dateCreatedEdtf: "185X~",
    });
    expect(
      await ana.query(api.collections.get, { collectionId }),
    ).toMatchObject({ dateCreatedEdtf: "185X~" });
  });

  test("an Object without a structured date keeps the edit version it had, and entering one outdates open forms", async () => {
    const t = createConvexTest();
    const { collectionId, ana, ben } = await createCataloguedObject(t);
    await t.run((ctx) =>
      ctx.db.patch(collectionId, { dateCreated: "c. 1850" }),
    );
    const target = { type: "object" as const, id: collectionId };
    const anaOpened = await editVersionOf(ana, target);

    // The fields this Object holds, hashed as before structured dates.
    expect(anaOpened).toBe(
      await digestOf({
        title: "Harbour at dusk",
        description: "Oil on canvas.",
        dateCreated: "c. 1850",
      }),
    );

    await ben.mutation(api.collections.update, {
      collectionId,
      dateCreatedEdtf: "1850~",
      expectedEditVersion: await editVersionOf(ben, target),
    });
    const conflict = await recordEditErrorOf(
      ana.mutation(api.collections.update, {
        collectionId,
        description: "Oil on canvas, relined 1972.",
        expectedEditVersion: anaOpened,
      }),
    );
    expect(conflict.code).toBe("EDIT_CONFLICT");
  });

  test("the number of objects, subject, completeness, measured parts and rights statement are stored canonical and refused at their fields", async () => {
    const t = createConvexTest();
    const { collectionId, ana } = await createCataloguedObject(t);
    const stored = async () =>
      await ana.query(api.collections.get, { collectionId });

    await ana.mutation(api.collections.update, {
      collectionId,
      numberOfObjects: 2,
      subjects: [" Harbour ", "harbour", "", "Pilots"],
      completeness: "incomplete",
      completenessNote: "  Lid missing ",
      dimensionMeasuredPart: "framed",
      measurementSets: [
        {
          part: "unframed",
          partNote: " ",
          height: 20,
          width: 32,
          unit: " in ",
        },
      ],
      rightsStatement: CC0,
    });
    const described = {
      numberOfObjects: 2,
      subjects: ["Harbour", "Pilots"],
      completeness: "incomplete",
      completenessNote: "Lid missing",
      dimensionMeasuredPart: "framed",
      measurementSets: [
        { part: "unframed", height: 20, width: 32, unit: "in" },
      ],
      rightsStatement: CC0,
    };
    expect(await stored()).toMatchObject(described);

    const refusals = [
      [{ numberOfObjects: 0 }, "OBJECT_COUNT_INVALID", "numberOfObjects"],
      [{ numberOfObjects: 1.5 }, "OBJECT_COUNT_INVALID", "numberOfObjects"],
      [{ numberOfObjects: 100_001 }, "OBJECT_COUNT_INVALID", "numberOfObjects"],
      [
        { subjects: Array.from({ length: 51 }, (_, index) => `Term ${index}`) },
        "SUBJECTS_INVALID",
        "subjects",
      ],
      [{ subjects: ["a".repeat(201)] }, "SUBJECTS_INVALID", "subjects"],
      [
        { measurementSets: [{ part: "base" as const }] },
        "MEASUREMENT_SETS_INVALID",
        "measurementSets",
      ],
      [
        { measurementSets: [{ part: "base" as const, width: 0 }] },
        "MEASUREMENT_SETS_INVALID",
        "measurementSets",
      ],
      [
        {
          measurementSets: Array.from({ length: 21 }, () => ({
            part: "base" as const,
            width: 1,
          })),
        },
        "MEASUREMENT_SETS_INVALID",
        "measurementSets",
      ],
      [
        { completenessNote: "a".repeat(4001) },
        "TEXT_TOO_LONG",
        "completenessNote",
      ],
    ] as const;
    for (const [fields, code, field] of refusals) {
      expect(
        await recordEditErrorOf(
          ana.mutation(api.collections.update, { collectionId, ...fields }),
        ),
      ).toMatchObject({ code, field });
    }
    expect(await stored()).toMatchObject(described);

    // A statement typed callers cannot send is refused at its field too.
    expect(
      await recordEditErrorOf(
        (async () =>
          enteredRightsStatement(
            "https://creativecommons.org/licenses/by/3.0/",
          ))(),
      ),
    ).toMatchObject({
      code: "RIGHTS_STATEMENT_INVALID",
      field: "rightsStatement",
    });
  });

  test("null, no terms and no sets clear the description fields, so the Organization's default rights statement applies", async () => {
    const t = createConvexTest();
    const { collectionId, ana } = await createCataloguedObject(t);
    const stored = async () =>
      await ana.query(api.collections.get, { collectionId });
    const fill = () =>
      ana.mutation(api.collections.update, {
        collectionId,
        numberOfObjects: 3,
        subjects: ["Harbour"],
        completeness: "fragment",
        completenessNote: "Rim only",
        dimensionMeasuredPart: "overall",
        measurementSets: [{ part: "base", diameter: 12 }],
        rightsStatement: CC0,
      });
    const cleared = [
      "numberOfObjects",
      "subjects",
      "completeness",
      "completenessNote",
      "dimensionMeasuredPart",
      "measurementSets",
      "rightsStatement",
    ];

    await fill();
    await ana.mutation(api.collections.update, {
      collectionId,
      numberOfObjects: null,
      subjects: [],
      completeness: null,
      completenessNote: "  ",
      dimensionMeasuredPart: null,
      measurementSets: [],
      rightsStatement: null,
    });
    for (const field of cleared)
      expect(await stored()).not.toHaveProperty(field);

    await fill();
    await ana.mutation(api.collections.update, {
      collectionId,
      subjects: null,
      measurementSets: null,
      completenessNote: null,
    });
    const object = await stored();
    expect(object).not.toHaveProperty("subjects");
    expect(object).not.toHaveProperty("measurementSets");
    expect(object).not.toHaveProperty("completenessNote");
    expect(object).toMatchObject({ numberOfObjects: 3, rightsStatement: CC0 });
  });

  test("a new Object's description fields are checked and stored the same way", async () => {
    const t = createConvexTest();
    const { organizationId, ana } = await createCataloguedObject(t);
    const create = (fields: {
      numberOfObjects?: number;
      subjects?: string[];
    }) =>
      ana.mutation(api.collections.create, {
        organizationId,
        accessionNumber: "2026.2",
        title: "Tea set",
        ...fields,
      });

    expect(
      await recordEditErrorOf(create({ numberOfObjects: 0 })),
    ).toMatchObject({ code: "OBJECT_COUNT_INVALID", field: "numberOfObjects" });
    expect(
      await recordEditErrorOf(create({ subjects: ["a".repeat(201)] })),
    ).toMatchObject({ code: "SUBJECTS_INVALID", field: "subjects" });
    const collectionId = await ana.mutation(api.collections.create, {
      organizationId,
      accessionNumber: "2026.2",
      title: "Tea set",
      numberOfObjects: 12,
      subjects: ["Willow pattern", " willow pattern "],
      completeness: "complete",
      dimensionMeasuredPart: "overall",
      measurementSets: [{ part: "base", diameter: 12, unit: "cm" }],
      rightsStatement: CC0,
    });
    expect(
      await ana.query(api.collections.get, { collectionId }),
    ).toMatchObject({
      numberOfObjects: 12,
      subjects: ["Willow pattern"],
      completeness: "complete",
      dimensionMeasuredPart: "overall",
      measurementSets: [{ part: "base", diameter: 12, unit: "cm" }],
      rightsStatement: CC0,
    });
  });

  test("an Object without the description fields keeps the edit version it had, and entering a subject outdates open forms", async () => {
    const t = createConvexTest();
    const { collectionId, ana, ben } = await createCataloguedObject(t);
    // Empty lists hash like absent fields.
    await t.run((ctx) =>
      ctx.db.patch(collectionId, { subjects: [], measurementSets: [] }),
    );
    const target = { type: "object" as const, id: collectionId };
    const anaOpened = await editVersionOf(ana, target);

    expect(anaOpened).toBe(
      await digestOf({
        title: "Harbour at dusk",
        description: "Oil on canvas.",
      }),
    );

    await ben.mutation(api.collections.update, {
      collectionId,
      subjects: ["Harbour"],
      expectedEditVersion: await editVersionOf(ben, target),
    });
    const conflict = await recordEditErrorOf(
      ana.mutation(api.collections.update, {
        collectionId,
        description: "Oil on canvas, relined 1972.",
        expectedEditVersion: anaOpened,
      }),
    );
    expect(conflict.code).toBe("EDIT_CONFLICT");
  });

  test("outsiders and signed-out callers read no edit state", async () => {
    const t = createConvexTest();
    const { collectionId } = await createCataloguedObject(t);
    const outsider = await createOrgUserWithPermissions(
      t,
      CATALOGUER_PERMISSIONS,
      { organizationName: "Other Museum" },
    );
    const target = { type: "object" as const, id: collectionId };

    expect(
      await authedForUser(t, outsider.userId).query(
        api.recordEdits.getEditState,
        { target },
      ),
    ).toBeNull();
    expect(await t.query(api.recordEdits.getEditState, { target })).toBeNull();
  });
});

const INTAKE_PERMISSIONS = [
  "collections.create",
  "collections.read",
  "collections.update",
  "media.upload",
  "media.read",
];

async function createIntakeDraft(t: ConvexTest) {
  const setup = await createOrgUserWithPermissions(t, INTAKE_PERMISSIONS, {
    roleName: "Intake officer",
    userName: "Ana Intake",
  });
  await t.run((ctx) =>
    ctx.db.patch(setup.organizationId, {
      settings: { accessionWorkflowEnabled: false },
    }),
  );
  const ana = authedForUser(t, setup.userId);
  const benUserId = await addMemberUser(
    t,
    setup.organizationId,
    INTAKE_PERMISSIONS,
    "Ben Registrar",
  );
  const ben = authedForUser(t, benUserId);
  const { accessionId, editVersion } = await ana.mutation(
    api.accessions.saveObjectDraft,
    {
      organizationId: setup.organizationId,
      saveMode: "draft",
      objectData: { accessionNumber: "2026.4.1", title: "Fishing net" },
    },
  );
  const target = { type: "objectDraft" as const, id: accessionId };
  return {
    ...setup,
    ana,
    ben,
    benUserId,
    accessionId,
    target,
    createdVersion: editVersion,
  };
}

async function draftTitleOf(client: Client, accessionId: Id<"accessions">) {
  const accession = await client.query(api.accessions.get, { accessionId });
  return accession?.draftObjectData?.title;
}

describe("intake object drafts", () => {
  test("a stale draft save is refused and keeps the colleague's draft", async () => {
    const t = createConvexTest();
    const { organizationId, ana, ben, accessionId, target, createdVersion } =
      await createIntakeDraft(t);
    expect(createdVersion).toBe(await editVersionOf(ana, target));

    const benSaved = await ben.mutation(api.accessions.saveObjectDraft, {
      organizationId,
      accessionId,
      saveMode: "draft",
      objectData: { accessionNumber: "2026.4.1", title: "Herring net" },
      expectedEditVersion: await editVersionOf(ben, target),
    });
    expect(benSaved.editVersion).toBe(await editVersionOf(ben, target));

    const conflict = await recordEditErrorOf(
      ana.mutation(api.accessions.saveObjectDraft, {
        organizationId,
        accessionId,
        saveMode: "draft",
        objectData: {
          accessionNumber: "2026.4.1",
          title: "Fishing net",
          materials: ["hemp"],
        },
        expectedEditVersion: createdVersion,
      }),
    );
    expect(conflict.code).toBe("EDIT_CONFLICT");
    expect(await draftTitleOf(ana, accessionId)).toBe("Herring net");

    await ana.mutation(api.accessions.saveObjectDraft, {
      organizationId,
      accessionId,
      saveMode: "draft",
      objectData: {
        accessionNumber: "2026.4.1",
        title: "Herring net",
        materials: ["hemp"],
      },
      expectedEditVersion: await editVersionOf(ana, target),
    });
    const accession = await ana.query(api.accessions.get, { accessionId });
    expect(accession?.draftObjectData).toMatchObject({
      title: "Herring net",
      materials: ["hemp"],
    });
  });

  test("photos a colleague attached outdate an open draft form", async () => {
    const t = createConvexTest();
    const { organizationId, benUserId, ana, ben, accessionId, target } =
      await createIntakeDraft(t);
    const anaOpened = await editVersionOf(ana, target);
    const storageId = await t.run(async (ctx) => {
      const id = await ctx.storage.store(
        new Blob([new Uint8Array([0xff, 0xd8])], { type: "image/jpeg" }),
      );
      await ctx.db.insert("storageOwnership", {
        storageId: id,
        uploadedBy: benUserId,
        organizationId,
        uploadedAt: Date.now(),
      });
      return id;
    });

    await ben.mutation(api.accessions.saveObjectDraft, {
      organizationId,
      accessionId,
      saveMode: "draft",
      objectData: { accessionNumber: "2026.4.1", title: "Fishing net" },
      draftMedia: [
        {
          storageId,
          fileName: "net.jpg",
          fileSize: 2,
          mimeType: "image/jpeg",
          mediaCategory: "image",
          isPrimary: true,
        },
      ],
      expectedEditVersion: anaOpened,
    });

    const conflict = await recordEditErrorOf(
      ana.mutation(api.accessions.saveObjectDraft, {
        organizationId,
        accessionId,
        saveMode: "draft",
        objectData: { accessionNumber: "2026.4.1", title: "Fishing net" },
        draftMedia: [],
        expectedEditVersion: anaOpened,
      }),
    );
    expect(conflict.code).toBe("EDIT_CONFLICT");
    const accession = await ana.query(api.accessions.get, { accessionId });
    expect(accession?.draftMedia?.map((item) => item.fileName)).toEqual([
      "net.jpg",
    ]);
  });

  test("a draft keeps its title and permanent identifier", async () => {
    const t = createConvexTest();
    const { organizationId, ana, accessionId } = await createIntakeDraft(t);

    expect(
      await recordEditErrorOf(
        ana.mutation(api.accessions.saveObjectDraft, {
          organizationId,
          accessionId,
          saveMode: "draft",
          objectData: { accessionNumber: "2026.4.1", title: " " },
        }),
      ),
    ).toMatchObject({ code: "FIELD_REQUIRED", field: "title" });
    expect(
      await recordEditErrorOf(
        ana.mutation(api.accessions.saveObjectDraft, {
          organizationId,
          accessionId,
          saveMode: "draft",
          objectData: { accessionNumber: "2026.4.9", title: "Fishing net" },
        }),
      ),
    ).toMatchObject({ code: "IDENTIFIER_PERMANENT", field: "accessionNumber" });
    expect(await draftTitleOf(ana, accessionId)).toBe("Fishing net");
  });

  test("a draft's structured date made is checked at save and copied, canonical, to the Object it becomes", async () => {
    const t = createConvexTest();
    const { organizationId, ana, accessionId } = await createIntakeDraft(t);

    expect(
      await recordEditErrorOf(
        ana.mutation(api.accessions.saveObjectDraft, {
          organizationId,
          accessionId,
          saveMode: "draft",
          objectData: {
            accessionNumber: "2026.4.1",
            title: "Fishing net",
            dateCreatedEdtf: "1850s",
          },
        }),
      ),
    ).toMatchObject({
      code: "PRODUCTION_DATE_INVALID",
      field: "dateCreatedEdtf",
    });

    await ana.mutation(api.accessions.saveObjectDraft, {
      organizationId,
      accessionId,
      saveMode: "submit",
      objectData: {
        accessionNumber: "2026.4.1",
        title: "Fishing net",
        dateCreated: "about 1850",
        dateCreatedEdtf: " 1848~/1852 ",
      },
    });
    const accession = await ana.query(api.accessions.get, { accessionId });
    expect(accession?.draftObjectData?.dateCreatedEdtf).toBe("1848~/1852");
    const objectId = accession?.collectionId;
    if (!objectId) throw new Error("Expected the accepted draft's Object");
    expect(
      await ana.query(api.collections.get, { collectionId: objectId }),
    ).toMatchObject({
      dateCreated: "about 1850",
      dateCreatedEdtf: "1848~/1852",
    });
  });

  test("an approval never fails over a structured date saved before it was checked", async () => {
    const t = createConvexTest();
    const { userId, accessionId } = await createIntakeDraft(t);
    await t.run(async (ctx) => {
      const accession = await ctx.db.get(accessionId);
      if (!accession?.draftObjectData) throw new Error("Expected a draft");
      await ctx.db.patch(accessionId, {
        status: "approved",
        approvedBy: userId,
        approvedAt: Date.now(),
        draftObjectData: {
          ...accession.draftObjectData,
          dateCreatedEdtf: "around 1850",
        },
      });
    });

    const objectId = await t.mutation(
      internal.accessions.createCollectionFromAccession,
      { accessionId },
    );
    const object = await t.run((ctx) => ctx.db.get(objectId));
    expect(object?.title).toBe("Fishing net");
    expect(object?.dateCreatedEdtf).toBeUndefined();
  });

  test("a draft's description fields are checked at save and copied to the Object it becomes", async () => {
    const t = createConvexTest();
    const { organizationId, ana, accessionId } = await createIntakeDraft(t);
    const save = (
      saveMode: "draft" | "submit",
      fields: {
        numberOfObjects?: number;
        subjects?: string[];
        measurementSets?: Array<{ part: "base"; width?: number }>;
      } = {},
    ) =>
      ana.mutation(api.accessions.saveObjectDraft, {
        organizationId,
        accessionId,
        saveMode,
        objectData: {
          accessionNumber: "2026.4.1",
          title: "Fishing net",
          ...fields,
        },
      });

    expect(
      await recordEditErrorOf(save("draft", { numberOfObjects: 0 })),
    ).toMatchObject({ code: "OBJECT_COUNT_INVALID", field: "numberOfObjects" });
    expect(
      await recordEditErrorOf(save("draft", { subjects: ["a".repeat(201)] })),
    ).toMatchObject({ code: "SUBJECTS_INVALID", field: "subjects" });
    expect(
      await recordEditErrorOf(
        save("draft", { measurementSets: [{ part: "base" }] }),
      ),
    ).toMatchObject({
      code: "MEASUREMENT_SETS_INVALID",
      field: "measurementSets",
    });

    await ana.mutation(api.accessions.saveObjectDraft, {
      organizationId,
      accessionId,
      saveMode: "submit",
      objectData: {
        accessionNumber: "2026.4.1",
        title: "Fishing net",
        numberOfObjects: 2,
        subjects: [" Fishing ", "fishing", "Coast"],
        completeness: "incomplete",
        completenessNote: " Floats missing ",
        dimensionMeasuredPart: "overall",
        measurementSets: [{ part: "other", partNote: "Float", diameter: 9 }],
        rightsStatement: CC0,
      },
    });
    const accession = await ana.query(api.accessions.get, { accessionId });
    expect(accession?.draftObjectData?.subjects).toEqual(["Fishing", "Coast"]);
    const objectId = accession?.collectionId;
    if (!objectId) throw new Error("Expected the accepted draft's Object");
    expect(
      await ana.query(api.collections.get, { collectionId: objectId }),
    ).toMatchObject({
      numberOfObjects: 2,
      subjects: ["Fishing", "Coast"],
      completeness: "incomplete",
      completenessNote: "Floats missing",
      dimensionMeasuredPart: "overall",
      measurementSets: [{ part: "other", partNote: "Float", diameter: 9 }],
      rightsStatement: CC0,
    });
  });

  test("an approval never fails over description values saved before they were checked", async () => {
    const t = createConvexTest();
    const { userId, accessionId } = await createIntakeDraft(t);
    await t.run(async (ctx) => {
      const accession = await ctx.db.get(accessionId);
      if (!accession?.draftObjectData) throw new Error("Expected a draft");
      await ctx.db.patch(accessionId, {
        status: "approved",
        approvedBy: userId,
        approvedAt: Date.now(),
        draftObjectData: {
          ...accession.draftObjectData,
          numberOfObjects: 0,
          subjects: ["a".repeat(201), "Coast"],
          completenessNote: "a".repeat(4001),
          measurementSets: [{ part: "base" }, { part: "base", width: 2 }],
        },
      });
    });

    const objectId = await t.mutation(
      internal.accessions.createCollectionFromAccession,
      { accessionId },
    );
    const object = await t.run((ctx) => ctx.db.get(objectId));
    expect(object).toMatchObject({
      title: "Fishing net",
      subjects: ["Coast"],
      measurementSets: [{ part: "base", width: 2 }],
    });
    expect(object?.numberOfObjects).toBeUndefined();
    expect(object?.completenessNote).toBeUndefined();
  });

  test("a draft that was accepted can no longer be saved as a draft", async () => {
    const t = createConvexTest();
    const { organizationId, ana, ben, accessionId, target } =
      await createIntakeDraft(t);
    const anaOpened = await editVersionOf(ana, target);

    await ben.mutation(api.accessions.saveObjectDraft, {
      organizationId,
      accessionId,
      saveMode: "submit",
      objectData: { accessionNumber: "2026.4.1", title: "Fishing net" },
    });

    const refusal = await recordEditErrorOf(
      ana.mutation(api.accessions.saveObjectDraft, {
        organizationId,
        accessionId,
        saveMode: "draft",
        objectData: { accessionNumber: "2026.4.1", title: "Fishing net" },
        expectedEditVersion: anaOpened,
      }),
    );
    expect(refusal.code).toBe("RECORD_NOT_EDITABLE");
  });

  test("submitting without the right to start review is refused as a permission, keeping the draft", async () => {
    const t = createConvexTest();
    const { organizationId, ana, accessionId } = await createIntakeDraft(t);
    await t.run(async (ctx) => {
      await ctx.db.patch(organizationId, {
        settings: { accessionWorkflowEnabled: true },
      });
      const committee = await ctx.db.insert("roles", {
        organizationId,
        name: "Committee",
        isSystemRole: false,
      });
      await ctx.db.insert("workflowConfigs", {
        organizationId,
        workflowType: "accession",
        steps: [{ stepNumber: 1, roleId: committee, name: "Committee" }],
        canInitiateRoles: [committee],
      });
    });

    const refusal = await capabilityFailureOf(
      ana.mutation(api.accessions.saveObjectDraft, {
        organizationId,
        accessionId,
        saveMode: "submit",
        objectData: {
          accessionNumber: "2026.4.1",
          title: "Fishing net, tarred",
        },
      }),
    );

    expect(refusal).toMatchObject({ reason: "permission_missing" });
    expect(await draftTitleOf(ana, accessionId)).toBe("Fishing net");
  });

  test("a member who may only read cannot save a colleague's draft", async () => {
    const t = createConvexTest();
    const { organizationId, accessionId, target } = await createIntakeDraft(t);
    const reader = await addMember(
      t,
      organizationId,
      ["collections.read"],
      "Rita Reader",
    );

    const refusal = await capabilityFailureOf(
      reader.mutation(api.accessions.saveObjectDraft, {
        organizationId,
        accessionId,
        saveMode: "draft",
        objectData: { accessionNumber: "2026.4.1", title: "Renamed" },
        expectedEditVersion: await editVersionOf(reader, target),
      }),
    );

    expect(refusal).toMatchObject({ reason: "permission_missing" });
    expect(await draftTitleOf(reader, accessionId)).toBe("Fishing net");
  });
});

const LOAN_PERMISSIONS = [
  "loans.create",
  "loans.read",
  "loans.update",
  "accounts.read",
  "accounts.write",
];

async function createPendingLoan(
  t: ConvexTest,
  { linkedParty }: { linkedParty: boolean },
) {
  const setup = await createOrgUserWithPermissions(t, LOAN_PERMISSIONS, {
    subscriptionTier: "pro",
    enabledModules: ["accounts"],
    roleName: "Registrar",
    userName: "Ana Registrar",
  });
  const ana = authedForUser(t, setup.userId);
  const ben = await addMember(
    t,
    setup.organizationId,
    LOAN_PERMISSIONS,
    "Ben Registrar",
  );
  const insertParty = (businessName: string, email: string) =>
    t.run((ctx) =>
      ctx.db.insert("accounts", {
        organizationId: setup.organizationId,
        accountNumber: `ACC-${businessName.length}`,
        accountType: "institution",
        businessName,
        email,
        createdBy: setup.userId,
        createdAt: Date.now(),
      }),
    );
  const partyId = linkedParty
    ? await insertParty("Bergen Maritime Museum", "loans@bergen.example")
    : undefined;
  const loanId = await ana.mutation(api.loans.create, {
    organizationId: setup.organizationId,
    type: "incoming",
    accountId: partyId,
    lenderBorrowerName: "Bergen Maritime Museum",
    startDate: Date.UTC(2026, 9, 1),
    endDate: Date.UTC(2027, 2, 1),
  });
  const target = { type: "loan" as const, id: loanId };
  return { ...setup, ana, ben, loanId, target, insertParty };
}

describe("loan edits", () => {
  test("a stale loan save is refused and keeps the colleague's dates", async () => {
    const t = createConvexTest();
    const { ana, ben, loanId, target } = await createPendingLoan(t, {
      linkedParty: false,
    });
    const anaOpened = await editVersionOf(ana, target);

    await ben.mutation(api.loans.update, {
      loanId,
      endDate: Date.UTC(2027, 5, 1),
      expectedEditVersion: await editVersionOf(ben, target),
    });

    const conflict = await recordEditErrorOf(
      ana.mutation(api.loans.update, {
        loanId,
        notes: "Courier required.",
        expectedEditVersion: anaOpened,
      }),
    );
    expect(conflict.code).toBe("EDIT_CONFLICT");
    const kept = await ana.query(api.loans.get, { loanId });
    expect(kept?.endDate).toBe(Date.UTC(2027, 5, 1));
    expect(kept?.notes).toBeUndefined();

    const saved = await ana.mutation(api.loans.update, {
      loanId,
      notes: "Courier required.",
      expectedEditVersion: await editVersionOf(ana, target),
    });
    expect(saved.editVersion).toBe(await editVersionOf(ana, target));
    expect(await ana.query(api.loans.get, { loanId })).toMatchObject({
      endDate: Date.UTC(2027, 5, 1),
      notes: "Courier required.",
    });
  });

  test("replacing the lender in the parties panel outdates an open loan form", async () => {
    const t = createConvexTest();
    const { ana, ben, loanId, target, insertParty } = await createPendingLoan(
      t,
      { linkedParty: true },
    );
    const anaOpened = await editVersionOf(ana, target);
    const otherLenderId = await insertParty(
      "Stavanger Museum",
      "registrar@stavanger.example",
    );

    await ben.mutation(api.partyLinks.link, {
      target: { type: "loan", id: loanId },
      accountId: otherLenderId,
      role: "lender",
      reason: "Agreement signed by Stavanger",
    });

    const conflict = await recordEditErrorOf(
      ana.mutation(api.loans.update, {
        loanId,
        terms: "Climate-controlled display only.",
        expectedEditVersion: anaOpened,
      }),
    );
    expect(conflict.code).toBe("EDIT_CONFLICT");
    expect(await ana.query(api.loans.get, { loanId })).toMatchObject({
      lenderBorrowerName: "Stavanger Museum",
      lenderBorrowerContact: "registrar@stavanger.example",
    });
  });

  test("a linked lender's name and contact are kept from the party", async () => {
    const t = createConvexTest();
    const { ana, loanId, target } = await createPendingLoan(t, {
      linkedParty: true,
    });

    expect(
      await recordEditErrorOf(
        ana.mutation(api.loans.update, {
          loanId,
          lenderBorrowerName: "Bergen Museum",
        }),
      ),
    ).toMatchObject({
      code: "PARTY_MANAGED_FIELD",
      field: "lenderBorrowerName",
    });
    expect(
      await recordEditErrorOf(
        ana.mutation(api.loans.update, {
          loanId,
          lenderBorrowerContact: "someone@else.example",
        }),
      ),
    ).toMatchObject({
      code: "PARTY_MANAGED_FIELD",
      field: "lenderBorrowerContact",
    });

    await ana.mutation(api.loans.update, {
      loanId,
      lenderBorrowerName: "Bergen Maritime Museum",
      terms: "Climate-controlled display only.",
      expectedEditVersion: await editVersionOf(ana, target),
    });
    expect(await ana.query(api.loans.get, { loanId })).toMatchObject({
      lenderBorrowerName: "Bergen Maritime Museum",
      terms: "Climate-controlled display only.",
    });
  });

  test("loan rules are reported at their fields", async () => {
    const t = createConvexTest();
    const { ana, loanId } = await createPendingLoan(t, {
      linkedParty: false,
    });

    expect(
      await recordEditErrorOf(
        ana.mutation(api.loans.update, { loanId, lenderBorrowerName: " " }),
      ),
    ).toMatchObject({ code: "FIELD_REQUIRED", field: "lenderBorrowerName" });
    expect(
      await recordEditErrorOf(
        ana.mutation(api.loans.update, {
          loanId,
          endDate: Date.UTC(2026, 8, 1),
        }),
      ),
    ).toMatchObject({ code: "DATE_ORDER_INVALID", field: "endDate" });
    expect(await ana.query(api.loans.get, { loanId })).toMatchObject({
      lenderBorrowerName: "Bergen Maritime Museum",
      endDate: Date.UTC(2027, 2, 1),
    });
  });

  test("cleared dates, values and texts are saved as cleared", async () => {
    const t = createConvexTest();
    const { ana, loanId } = await createPendingLoan(t, {
      linkedParty: false,
    });
    await ana.mutation(api.loans.update, {
      loanId,
      insuranceValue: 250000,
      terms: "Climate-controlled display only.",
      notes: "Courier required.",
    });

    await ana.mutation(api.loans.update, {
      loanId,
      endDate: null,
      insuranceValue: null,
      terms: "",
      notes: "",
    });

    const loan = await ana.query(api.loans.get, { loanId });
    expect(loan?.endDate).toBeUndefined();
    expect(loan?.insuranceValue).toBeUndefined();
    expect(loan?.terms ?? "").toBe("");
    expect(loan?.notes ?? "").toBe("");
  });

  test("a loan that left pending is no longer editable here", async () => {
    const t = createConvexTest();
    const { ana, loanId, target } = await createPendingLoan(t, {
      linkedParty: false,
    });
    const anaOpened = await editVersionOf(ana, target);
    await t.run((ctx) => ctx.db.patch(loanId, { status: "active" }));

    const refusal = await recordEditErrorOf(
      ana.mutation(api.loans.update, {
        loanId,
        notes: "Too late.",
        expectedEditVersion: anaOpened,
      }),
    );
    expect(refusal.code).toBe("RECORD_NOT_EDITABLE");
  });

  test("members who may only read loans, and outsiders, cannot edit", async () => {
    const t = createConvexTest();
    const { organizationId, loanId, target } = await createPendingLoan(t, {
      linkedParty: false,
    });
    const reader = await addMember(
      t,
      organizationId,
      ["loans.read"],
      "Rita Reader",
    );
    const outsider = await createOrgUserWithPermissions(t, LOAN_PERMISSIONS, {
      organizationName: "Other Museum",
      subscriptionTier: "pro",
    });

    expect(
      await capabilityFailureOf(
        reader.mutation(api.loans.update, {
          loanId,
          notes: "Reader note.",
          expectedEditVersion: await editVersionOf(reader, target),
        }),
      ),
    ).toMatchObject({ reason: "permission_missing" });
    expect(
      await authedForUser(t, outsider.userId).query(
        api.recordEdits.getEditState,
        { target },
      ),
    ).toBeNull();
    expect(
      (await reader.query(api.loans.get, { loanId }))?.notes,
    ).toBeUndefined();
  });
});
