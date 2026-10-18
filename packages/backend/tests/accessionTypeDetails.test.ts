import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import * as accessions from "../convex/accessions";
import * as collections from "../convex/collections";
import { expectMatchesReturns } from "./returnsValidation";
import {
  authedForUser,
  type ConvexTest,
  createConvexTest,
  createOrgUserWithPermissions,
} from "./testHarness";

const COLLECTION_MODULES = [
  "fine_art",
  "wine",
  "automotive",
  "natural_history",
  "archive",
  "coins_stamps",
] as const;

type Authed = ReturnType<typeof authedForUser>;

async function createIntakeRegistrar(
  t: ConvexTest,
  {
    enabledModules = [...COLLECTION_MODULES],
    permissions = [
      "collections.create",
      "collections.read",
      "collections.update",
      "collections.approve_accession",
    ],
  }: {
    enabledModules?: Array<(typeof COLLECTION_MODULES)[number]>;
    permissions?: string[];
  } = {},
) {
  const setup = await createOrgUserWithPermissions(t, permissions, {
    roleName: "Registrar",
    enabledModules,
  });
  await t.run((ctx) =>
    ctx.db.insert("workflowConfigs", {
      organizationId: setup.organizationId,
      workflowType: "accession",
      steps: [{ stepNumber: 1, roleId: setup.roleId, name: "Approve" }],
      canInitiateRoles: [setup.roleId],
    }),
  );
  return { ...setup, authed: authedForUser(t, setup.userId) };
}

async function publishedObjectId(
  authed: Authed,
  accessionId: Id<"accessions">,
) {
  const accession = await authed.query(api.accessions.get, { accessionId });
  if (!accession?.collectionId) throw new Error("Object was not published");
  return accession.collectionId;
}

const intakeCases = [
  {
    typeDetails: {
      collectionType: "fine_art" as const,
      fields: {
        appraisedValue: 125000,
        replacementValue: 150000,
        insurancePolicyNumber: "FA-2026-118",
        insuranceCarrier: "Nordic Fine Art Mutual",
        insuranceExpiresAt: Date.UTC(2027, 5, 30),
        reappraisalDate: Date.UTC(2028, 0, 15),
        lastAppraisalDate: Date.UTC(2026, 2, 1),
        appraiser: "Ingrid Solberg",
        displayStatus: "in_storage" as const,
      },
    },
  },
  {
    typeDetails: {
      collectionType: "wine" as const,
      fields: {
        vintage: 1996,
        peakWindowStart: 2020,
        peakWindowEnd: 2035,
        binNumber: "B-14",
        rackNumber: "R2",
        rowNumber: "4",
        bottleSize: "Magnum",
        quantity: 6,
        fillLevel: "top_shoulder" as const,
        closureType: "cork" as const,
        labelCondition: "Light bin soil",
        capsuleCondition: "Intact",
        producer: "Château Margaux",
        region: "Bordeaux",
        appellation: "Margaux",
        varietal: "Cabernet Sauvignon blend",
        alcoholContent: 12.5,
        purchasePrice: 4800,
        currentValue: 9200,
        drinkingNotes: "Cassis and cedar; long finish.",
      },
    },
  },
  {
    typeDetails: {
      collectionType: "automotive" as const,
      fields: {
        vin: "VF1AB000123456789",
        make: "Volvo",
        model: "P1800",
        year: 1963,
        bodyStyle: "Coupé",
        engineNumber: "B18-4471",
        transmissionType: "4-speed manual",
        exteriorColor: "Pearl white",
        interiorColor: "Red leather",
        odometer: 84211,
        odometerUnit: "km" as const,
        fuelType: "Petrol",
        registrationNumber: "AB 1963",
        registrationState: "Oslo",
        titleNumber: "NO-77812",
        insuranceValue: 65000,
      },
    },
  },
  {
    typeDetails: {
      collectionType: "natural_history" as const,
      fields: {
        kingdom: "Animalia",
        phylum: "Chordata",
        taxonomyClass: "Aves",
        order: "Strigiformes",
        family: "Strigidae",
        genus: "Bubo",
        species: "scandiacus",
        subspecies: "none recorded",
        commonName: "Snowy owl",
        scientificName: "Bubo scandiacus",
        collectionDate: Date.UTC(1931, 1, 12),
        collectorName: "H. Johansen",
        collectionMethod: "Found dead",
        latitude: 69.6492,
        longitude: 18.9553,
        altitude: 12,
        locality: "Tromsø",
        habitat: "Coastal tundra",
        geologicalPeriod: "Holocene",
        formation: "Not applicable",
        preservationMethod: "mounted" as const,
        storageMedium: "Dry case",
        containerType: "Glass dome",
        sex: "female" as const,
        lifeStage: "Adult",
        specimenType: "Skin mount",
        dnaAvailable: false,
        tissueAvailable: true,
      },
    },
  },
  {
    typeDetails: {
      collectionType: "archive" as const,
      fields: {
        documentType: "Board minutes",
        retentionCategory: "Permanent",
        retentionYears: 25,
        retentionStartDate: Date.UTC(1999, 0, 1),
        retentionExpiresAt: Date.UTC(2024, 0, 1),
        confidentialityLevel: "confidential" as const,
        accessRestrictions: ["Board members", "Legal"],
        originatingDepartment: "Company secretary",
        recordSeries: "BM-1999",
        boxNumber: "17",
        folderNumber: "3",
        digitalAssetUrl: "https://archive.example.org/bm-1999-03",
        fileFormat: "PDF/A",
        pageCount: 48,
        ocrProcessed: true,
        keywords: ["merger", "board"],
      },
    },
  },
  {
    typeDetails: {
      collectionType: "coins_stamps" as const,
      fields: {
        itemCategory: "coin" as const,
        issuingAuthority: "Kingdom of Norway",
        countryOrRegion: "Norway",
        denomination: "1 krone",
        currency: "NOK",
        issueYear: 1875,
        issuePeriod: "Oscar II",
        mintOrPrinter: "Kongsberg",
        series: "Scandinavian Monetary Union",
        catalogNumber: "KM 357",
        grade: "VF-30",
        certificationNumber: "NGC 4471-002",
        certifyingAuthority: "NGC",
        conditionNotes: "Light toning",
        composition: "Silver .800",
        diameterMm: 31,
        weightGrams: 7.5,
        perforation: "Not applicable",
        watermark: "Not applicable",
        color: "Silver",
        rarity: "scarce" as const,
        acquisitionPrice: 900,
        estimatedValue: 1400,
        storageLocation: "Coin cabinet 2, tray 5",
        notes: "From the Hansen bequest.",
      },
    },
  },
];

async function objectTypeDetails(
  authed: Authed,
  collectionId: Id<"collections">,
) {
  const objectDetail = await authed.query(api.collections.getObjectDetail, {
    collectionId,
  });
  expectMatchesReturns(collections.getObjectDetail, objectDetail);
  return objectDetail?.typeDetails;
}

describe.each(
  intakeCases,
)("$typeDetails.collectionType details entered at intake", ({
  typeDetails,
}) => {
  async function publishTypedObject(t: ConvexTest) {
    const registrar = await createIntakeRegistrar(t);
    const { organizationId, authed } = registrar;

    const accessionId = await authed.mutation(
      api.accessions.upsertObjectDraft,
      {
        organizationId,
        saveMode: "draft",
        objectData: {
          accessionNumber: "INT-001",
          title: "Typed intake object",
          collectionType: typeDetails.collectionType,
          typeDetails,
        },
      },
    );

    const recovered = await authed.query(api.accessions.get, { accessionId });
    expectMatchesReturns(accessions.get, recovered);
    expect(recovered?.draftObjectData?.typeDetails).toEqual(typeDetails);
    if (!recovered?.draftObjectData) throw new Error("Draft was not saved");

    await authed.mutation(api.accessions.upsertObjectDraft, {
      organizationId,
      accessionId,
      saveMode: "submit",
      objectData: recovered.draftObjectData,
    });
    await authed.mutation(api.accessions.approve, { accessionId });

    return {
      ...registrar,
      collectionId: await publishedObjectId(authed, accessionId),
    };
  }

  test("survive draft recovery and appear on the published object without re-entry", async () => {
    const t = createConvexTest();
    const { authed, collectionId } = await publishTypedObject(t);

    expect(await objectTypeDetails(authed, collectionId)).toMatchObject({
      collectionType: typeDetails.collectionType,
      details: { collectionId, ...typeDetails.fields },
    });

    const objectPage = await authed.query(
      api.collections.getWithModuleDetails,
      { collectionId },
    );
    expectMatchesReturns(collections.getWithModuleDetails, objectPage);
    expect(objectPage?.collection.collectionType).toBe(
      typeDetails.collectionType,
    );
    expect(objectPage?.moduleDetails?.type).toBe(typeDetails.collectionType);
  });

  test("are not shown on the object while the type's module is off", async () => {
    const t = createConvexTest();
    const { organizationId, authed, collectionId } =
      await publishTypedObject(t);
    await t.run((ctx) =>
      ctx.db.patch(organizationId, { settings: { enabledModules: [] } }),
    );

    expect(await objectTypeDetails(authed, collectionId)).toBeNull();
  });
});

/**
 * convex-test re-serializes ConvexError data thrown inside a nested
 * `ctx.runMutation`, so the payload may arrive JSON-encoded more than once.
 */
async function errorCodeOf(call: Promise<unknown>) {
  try {
    await call;
  } catch (error) {
    let data: unknown = error instanceof ConvexError ? error.data : undefined;
    while (typeof data === "string") data = JSON.parse(data);
    return typeof data === "object" &&
      data !== null &&
      "code" in data &&
      typeof data.code === "string"
      ? data.code
      : String(error);
  }
  throw new Error("Expected the call to be rejected");
}

test("details for a different collection type than the draft are refused", async () => {
  const t = createConvexTest();
  const { organizationId, authed } = await createIntakeRegistrar(t);

  expect(
    await errorCodeOf(
      authed.mutation(api.accessions.upsertObjectDraft, {
        organizationId,
        saveMode: "draft",
        objectData: {
          accessionNumber: "INT-002",
          title: "Mislabelled intake",
          collectionType: "wine",
          typeDetails: {
            collectionType: "fine_art",
            fields: { appraisedValue: 1000 },
          },
        },
      }),
    ),
  ).toBe("TYPE_DETAILS_MISMATCH");
});

test("changing a draft's collection type publishes no details for the earlier type", async () => {
  const t = createConvexTest();
  const { organizationId, authed } = await createIntakeRegistrar(t);
  const accessionId = await authed.mutation(api.accessions.upsertObjectDraft, {
    organizationId,
    saveMode: "draft",
    objectData: {
      accessionNumber: "INT-005",
      title: "Retyped intake",
      collectionType: "fine_art",
      typeDetails: {
        collectionType: "fine_art",
        fields: { appraisedValue: 5000, appraiser: "Ingrid Solberg" },
      },
    },
  });

  await authed.mutation(api.accessions.upsertObjectDraft, {
    organizationId,
    accessionId,
    saveMode: "submit",
    objectData: {
      accessionNumber: "INT-005",
      title: "Retyped intake",
      collectionType: "coins_stamps",
    },
  });
  const submitted = await authed.query(api.accessions.get, { accessionId });
  expect(submitted?.draftObjectData?.typeDetails).toBeUndefined();
  await authed.mutation(api.accessions.approve, { accessionId });

  const collectionId = await publishedObjectId(authed, accessionId);
  expect(await objectTypeDetails(authed, collectionId)).toBeNull();
  expect(
    await t.run((ctx) =>
      ctx.db
        .query("fineArtDetails")
        .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
        .unique(),
    ),
  ).toBeNull();
});

test("starting a typed intake draft needs the object creation permission", async () => {
  const t = createConvexTest();
  const { organizationId, authed } = await createIntakeRegistrar(t, {
    permissions: ["collections.read", "collections.update"],
  });

  await expect(
    authed.mutation(api.accessions.upsertObjectDraft, {
      organizationId,
      saveMode: "draft",
      objectData: {
        accessionNumber: "INT-006",
        title: "Unauthorised intake",
        collectionType: "wine",
        typeDetails: { collectionType: "wine", fields: { vintage: 2001 } },
      },
    }),
  ).rejects.toThrow("Permission denied: collections.create");
});

test("a draft cannot use a collection type whose module is not enabled", async () => {
  const t = createConvexTest();
  const { organizationId, authed } = await createIntakeRegistrar(t, {
    enabledModules: ["fine_art"],
  });

  expect(
    await errorCodeOf(
      authed.mutation(api.accessions.upsertObjectDraft, {
        organizationId,
        saveMode: "draft",
        objectData: {
          accessionNumber: "INT-003",
          title: "Cellar intake",
          collectionType: "wine",
          typeDetails: { collectionType: "wine", fields: { vintage: 2001 } },
        },
      }),
    ),
  ).toBe("COLLECTION_TYPE_MODULE_DISABLED");
});

test("approval does not publish a typed object after its module is disabled", async () => {
  const t = createConvexTest();
  const { organizationId, authed } = await createIntakeRegistrar(t, {
    enabledModules: ["wine"],
  });
  const accessionId = await authed.mutation(api.accessions.upsertObjectDraft, {
    organizationId,
    saveMode: "submit",
    objectData: {
      accessionNumber: "INT-004",
      title: "Cellar intake",
      collectionType: "wine",
      typeDetails: { collectionType: "wine", fields: { vintage: 2001 } },
    },
  });
  await t.run((ctx) =>
    ctx.db.patch(organizationId, { settings: { enabledModules: [] } }),
  );

  expect(
    await errorCodeOf(authed.mutation(api.accessions.approve, { accessionId })),
  ).toBe("COLLECTION_TYPE_MODULE_DISABLED");
  const accession = await authed.query(api.accessions.get, { accessionId });
  expect(accession?.status).toBe("pending");
  expect(accession?.collectionId).toBeUndefined();
});

test("blank intake values are not published as details", async () => {
  const t = createConvexTest();
  const { organizationId, authed } = await createIntakeRegistrar(t);
  const publish = async (
    accessionNumber: string,
    typeDetails: {
      collectionType: "archive";
      fields: { documentType?: string; keywords?: string[] };
    },
  ) => {
    const accessionId = await authed.mutation(
      api.accessions.upsertObjectDraft,
      {
        organizationId,
        saveMode: "submit",
        objectData: {
          accessionNumber,
          title: "Archive intake",
          collectionType: "archive",
          typeDetails,
        },
      },
    );
    await authed.mutation(api.accessions.approve, { accessionId });
    const collectionId = await publishedObjectId(authed, accessionId);
    return (await objectTypeDetails(authed, collectionId))?.details ?? null;
  };

  expect(
    await publish("INT-007", {
      collectionType: "archive",
      fields: { documentType: "   ", keywords: [] },
    }),
  ).toBeNull();
  expect(
    await publish("INT-008", {
      collectionType: "archive",
      fields: { documentType: " Board minutes ", keywords: ["", " board "] },
    }),
  ).toMatchObject({ documentType: "Board minutes", keywords: ["board"] });
});
