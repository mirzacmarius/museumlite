import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action } from "./_generated/server";

const SEED_USER_EMAIL = "mirzacmarius@gmail.com";

interface MetSearchResult {
  total: number;
  objectIDs?: number[];
}

interface MetObject {
  objectID: number;
  title: string;
  objectName?: string;
  culture?: string;
  period?: string;
  objectDate?: string;
  medium?: string;
  dimensions?: string;
  creditLine?: string;
  department?: string;
  primaryImage?: string;
  primaryImageSmall?: string;
  isPublicDomain: boolean;
}

async function fetchMetSearch(query: string): Promise<number[]> {
  const url = `https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&q=${encodeURIComponent(query)}`;
  const response = await fetch(url);
  if (!response.ok) return [];
  const data = (await response.json()) as MetSearchResult;
  return data.objectIDs ?? [];
}

async function fetchMetObject(id: number): Promise<MetObject | null> {
  const url = `https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`;
  const response = await fetch(url);
  if (!response.ok) return null;
  return (await response.json()) as MetObject;
}

async function fetchImageBlob(imageUrl: string): Promise<Blob | null> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return null;
    return await response.blob();
  } catch {
    return null;
  }
}

function _sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const ORGANIZATIONS = [
  {
    name: "National Museum of Natural History",
    slug: "natural-history-museum",
    type: "museum" as const,
    tier: "enterprise" as const,
    prefix: "NMNH",
    query: "ancient",
  },
  {
    name: "Metropolitan Art Gallery",
    slug: "metropolitan-art-gallery",
    type: "gallery" as const,
    tier: "pro" as const,
    prefix: "MAG",
    query: "portrait",
  },
  {
    name: "Heritage Library & Archives",
    slug: "heritage-library",
    type: "library" as const,
    tier: "pro" as const,
    prefix: "HLA",
    query: "medieval",
  },
  {
    name: "Contemporary Design Museum",
    slug: "contemporary-design",
    type: "museum" as const,
    tier: "enterprise" as const,
    prefix: "CDM",
    query: "modern",
  },
  {
    name: "Vanderbilt Private Collection",
    slug: "vanderbilt-collection",
    type: "collector" as const,
    tier: "free" as const,
    prefix: "VPC",
    query: "jewelry",
  },
];

// Step 1: Clear all data
export const clearAllData = action({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    console.log("Clearing all data...");
    const tablesToClear = [
      "auditLog",
      "notifications",
      "loanReminders",
      "loanExtensionRequests",
      "conditionReports",
      "loanItems",
      "loanDocuments",
      "loans",
      "deaccessions",
      "accessions",
      "mediaFiles",
      "locationHistory",
      "locationMoveRequests",
      "collectionGroupItems",
      "fineArtDetails",
      "wineDetails",
      "vehicleDetails",
      "naturalHistoryDetails",
      "archiveDetails",
      "collections",
      "collectionGroups",
      "locations",
      "conditionOptions",
      "materialOptions",
      "typeOptions",
      "donors",
      "userOrganizations",
      "rolePermissions",
      "roles",
      "organizations",
      "conservationTreatments",
      "conservationAlerts",
      "conservationAlertRules",
      "assessmentSchedules",
      "environmentalReadings",
      "conservationAttachments",
      "exhibitions",
      "exhibitionObjects",
      "exhibitionDocuments",
      "installationTasks",
      "installationTaskTemplates",
      "transitRecords",
      "transitItems",
      "transitStatusUpdates",
      "transitCounters",
      "librarySettings",
      "membershipTypes",
      "libraryItems",
      "itemCopies",
      "circulations",
      "libraryHolds",
      "libraryRecalls",
      "libraryFines",
      "libraryPayments",
      "accounts",
      "accountCounters",
      "contacts",
      "accountSegments",
      "workflowTemplates",
      "workflowConfigs",
      "workflowSlaConfigs",
      "workflowHistory",
      "appraisals",
      "insurancePolicies",
      "insuranceCoverages",
      "insuranceClaims",
      "claimCounters",
      "savedViews",
      "userPreferences",
      "accountRelationships",
      "accountDocuments",
      "objectComments",
      "apiKeys",
      "webhooks",
      "scheduledReports",
      "notificationPreferences",
      "libraryVendors",
      "libraryAcquisitionRequests",
      "serialSubscriptions",
      "serialIssues",
    ];

    async function clearTableUntilDone(tableName: string) {
      const batchDeleted = await ctx.runMutation(
        internal.seedMet.clearTableBatch,
        {
          tableName,
          batchSize: 500,
        },
      );
      if (batchDeleted === 500) {
        await clearTableUntilDone(tableName);
      }
    }

    await Promise.all(
      tablesToClear.map((tableName) => clearTableUntilDone(tableName)),
    );

    async function clearStorageUntilDone() {
      const storageBatch = await ctx.runMutation(
        internal.seedMet.clearStorageBatch,
        {
          batchSize: 100,
        },
      );
      if (storageBatch === 100) {
        await clearStorageUntilDone();
      }
    }

    await clearStorageUntilDone();

    console.log("All data cleared!");
    return null;
  },
});

// Step 2: Seed a single organization (call this 5 times, once per org)
export const seedOrganization = action({
  args: { orgIndex: v.number() },
  returns: v.null(),
  handler: async (ctx, { orgIndex }) => {
    if (orgIndex < 0 || orgIndex >= ORGANIZATIONS.length) {
      console.error("Invalid org index");
      return null;
    }

    const org = ORGANIZATIONS[orgIndex]!;
    console.log(
      `\n=== Seeding ${org.name} (${orgIndex + 1}/${ORGANIZATIONS.length}) ===`,
    );

    // Get user
    const userId = await ctx.runQuery(internal.seedMet.findUserByEmail, {
      email: SEED_USER_EMAIL,
    });
    if (!userId) {
      console.error("User not found. Please log in first.");
      return null;
    }
    const seedUserId = userId;

    // Create organization
    const orgId = await ctx.runMutation(internal.seedMet.createOrganization, {
      name: org.name,
      slug: org.slug,
      type: org.type,
      subscriptionTier: org.tier,
    });

    await ctx.runMutation(internal.seedMet.assignUserToOrg, {
      userId: seedUserId,
      organizationId: orgId,
    });

    // Create locations
    console.log("  Creating locations...");
    const buildings = ["Main Building", "West Wing", "East Annex"];
    const floors = ["Ground Floor", "First Floor", "Second Floor"];
    const rooms = ["Gallery A", "Gallery B", "Storage Room 1", "Archive Room"];
    const locationIds: Id<"locations">[] = [];

    await Promise.all(
      buildings.map(async (building) => {
        const buildingId = await ctx.runMutation(
          internal.seedMet.createLocation,
          {
            organizationId: orgId,
            name: building,
            type: "building",
            sortOrder: 0,
          },
        );

        await Promise.all(
          floors.map(async (floor) => {
            const floorId = await ctx.runMutation(
              internal.seedMet.createLocation,
              {
                organizationId: orgId,
                name: floor,
                type: "floor",
                parentLocationId: buildingId,
                sortOrder: 0,
              },
            );

            const roomIds = await Promise.all(
              rooms.map((room) =>
                ctx.runMutation(internal.seedMet.createLocation, {
                  organizationId: orgId,
                  name: room,
                  type: "room",
                  parentLocationId: floorId,
                  sortOrder: 0,
                }),
              ),
            );

            locationIds.push(...roomIds);
          }),
        );
      }),
    );

    // Fetch real Met Museum objects
    console.log(`  Fetching Met Museum objects for "${org.query}"...`);
    const objectIds = await fetchMetSearch(org.query);
    console.log(`  Found ${objectIds.length} objects`);

    // Shuffle
    for (let i = objectIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [objectIds[i], objectIds[j]] = [objectIds[j]!, objectIds[i]!];
    }

    let successCount = 0;
    const targetCount = 50;
    const maxAttempts = 150;
    const candidateIds = objectIds.slice(
      0,
      Math.min(objectIds.length, maxAttempts),
    );
    const seedChunkSize = 10;

    async function seedObjectChunk(startIndex: number) {
      if (startIndex >= candidateIds.length || successCount >= targetCount) {
        return;
      }

      const chunk = candidateIds.slice(startIndex, startIndex + seedChunkSize);
      const seededInChunk = await Promise.all(
        chunk.map(async (metId) => {
          const obj = await fetchMetObject(metId);
          if (!obj?.primaryImageSmall) {
            return 0;
          }

          const blob = await fetchImageBlob(obj.primaryImageSmall);
          if (!blob) {
            return 0;
          }

          const storageId = await ctx.storage.store(blob);
          const randomLocation =
            locationIds[Math.floor(Math.random() * locationIds.length)]!;

          const collectionId = await ctx.runMutation(
            internal.seedMet.createCollection,
            {
              organizationId: orgId,
              userId: seedUserId,
              accessionNumber: `${org.prefix}-MET-${metId}`,
              title: obj.title || "Untitled",
              objectType: obj.department || "Art",
              objectName: obj.objectName || obj.title || "Artwork",
              culture: obj.culture || "",
              period: obj.period || "",
              dateCreated: obj.objectDate || "",
              materials: obj.medium || "",
              dimensions: obj.dimensions || "",
              creditLine: obj.creditLine || "The Metropolitan Museum of Art",
              currentLocationId: randomLocation,
            },
          );

          await Promise.all([
            ctx.runMutation(internal.seedMet.createMediaFile, {
              collectionId,
              organizationId: orgId,
              userId: seedUserId,
              storageId,
              fileName: `${org.prefix}-MET-${metId}.jpg`,
              fileSize: blob.size,
            }),
            ctx.runMutation(internal.seedMet.createLocationHistory, {
              collectionId,
              toLocationId: randomLocation,
              movedBy: seedUserId,
              movedAt:
                Date.now() -
                Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000),
              reason: "Initial cataloging",
            }),
          ] as const);

          return 1;
        }),
      );

      successCount += seededInChunk.reduce<number>(
        (sum, value) => sum + value,
        0,
      );
      if (successCount > 0 && successCount % 10 === 0) {
        console.log(`  Progress: ${successCount}/${targetCount}`);
      }

      await seedObjectChunk(startIndex + seedChunkSize);
    }

    await seedObjectChunk(0);

    console.log(`  Created ${successCount} real museum objects`);

    // Create accounts
    console.log("  Creating accounts...");
    const lenders = [
      { name: "Smithsonian Institution", city: "Washington DC" },
      { name: "British Museum", city: "London" },
      { name: "Louvre Museum", city: "Paris" },
    ];
    await Promise.all([
      Promise.all(
        Array.from({ length: lenders.length }, async (_, i) => {
          await ctx.runMutation(internal.seedMet.createAccount, {
            organizationId: orgId,
            userId: seedUserId,
            accountNumber: `LEND-${String(i + 1).padStart(4, "0")}`,
            accountType: "lender",
            businessName: lenders[i]!.name,
            contactPerson: `Contact ${i + 1}`,
            contactEmail: `contact${i + 1}@museum.org`,
            contactPhone: "+1-555-0100",
            city: lenders[i]!.city,
            country: "USA",
            status: "active",
          });
        }),
      ),
      Promise.all(
        Array.from(["Excellent", "Good", "Fair", "Poor"]).map(async (c) => {
          await ctx.runMutation(internal.seedMet.createConditionOption, {
            organizationId: orgId,
            userId: seedUserId,
            name: c,
            description: `${c} condition`,
          });
        }),
      ),
      Promise.all(
        Array.from(["Oil", "Acrylic", "Watercolor", "Bronze", "Marble"]).map(
          async (m) => {
            await ctx.runMutation(internal.seedMet.createMaterialOption, {
              organizationId: orgId,
              userId: seedUserId,
              name: m,
            });
          },
        ),
      ),
      Promise.all(
        Array.from([
          "Painting",
          "Sculpture",
          "Drawing",
          "Print",
          "Photograph",
        ]).map(async (t) => {
          await ctx.runMutation(internal.seedMet.createTypeOption, {
            organizationId: orgId,
            userId: seedUserId,
            name: t,
          });
        }),
      ),
    ] as const);

    console.log(`  Done with ${org.name}!`);
    return null;
  },
});

// Run the full seed sequence
export const runFullSeed = action({
  args: {},
  returns: v.null(),
  handler: async (_ctx) => {
    console.log("Starting full seed with real Met Museum data...");
    console.log("This will run in 6 steps (clear + 5 orgs)");
    console.log("");
    console.log("Step 1: Run seedSingleOrg:clearAllData");
    console.log(
      "Step 2-6: Run seedSingleOrg:seedOrganization with orgIndex 0-4",
    );
    console.log("");
    console.log("Run these commands in sequence:");
    console.log("  bunx convex run seedSingleOrg:clearAllData");
    console.log(
      "  bunx convex run seedSingleOrg:seedOrganization '{\"orgIndex\": 0}'",
    );
    console.log(
      "  bunx convex run seedSingleOrg:seedOrganization '{\"orgIndex\": 1}'",
    );
    console.log(
      "  bunx convex run seedSingleOrg:seedOrganization '{\"orgIndex\": 2}'",
    );
    console.log(
      "  bunx convex run seedSingleOrg:seedOrganization '{\"orgIndex\": 3}'",
    );
    console.log(
      "  bunx convex run seedSingleOrg:seedOrganization '{\"orgIndex\": 4}'",
    );
    return null;
  },
});
