import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

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

function sleep(ms: number): Promise<void> {
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

    await Promise.all(
      Array.from(tablesToClear).map(async (tableName) => {
        let batchDeleted: number;
        do {
          batchDeleted = await ctx.runMutation(
            internal.seedMet.clearTableBatch,
            {
              tableName,
              batchSize: 500,
            },
          );
        } while (batchDeleted === 500);
      }),
    );

    // Clear storage
    let storageBatch: number;
    do {
      storageBatch = await ctx.runMutation(internal.seedMet.clearStorageBatch, {
        batchSize: 100,
      });
    } while (storageBatch === 100);

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

    // Create organization
    const orgId = await ctx.runMutation(internal.seedMet.createOrganization, {
      name: org.name,
      slug: org.slug,
      type: org.type,
      subscriptionTier: org.tier,
    });

    await ctx.runMutation(internal.seedMet.assignUserToOrg, {
      userId,
      organizationId: orgId,
    });

    // Create locations
    console.log("  Creating locations...");
    const buildings = ["Main Building", "West Wing", "East Annex"];
    const floors = ["Ground Floor", "First Floor", "Second Floor"];
    const rooms = ["Gallery A", "Gallery B", "Storage Room 1", "Archive Room"];
    const locationIds: Id<"locations">[] = [];

    await Promise.all(
      Array.from(buildings).map(async (building) => {
        const buildingId = await ctx.runMutation(
          internal.seedMet.createLocation,
          {
            organizationId: orgId,
            name: building,
            type: "building",
            sortOrder: 0,
          },
        );
        for (const floor of floors) {
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
          for (const room of rooms) {
            const roomId = await ctx.runMutation(
              internal.seedMet.createLocation,
              {
                organizationId: orgId,
                name: room,
                type: "room",
                parentLocationId: floorId,
                sortOrder: 0,
              },
            );
            locationIds.push(roomId);
          }
        }
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

    for (
      let attempt = 0;
      attempt < Math.min(objectIds.length, maxAttempts) &&
      successCount < targetCount;
      attempt++
    ) {
      const metId = objectIds[attempt]!;

      const obj = await fetchMetObject(metId);
      if (!obj?.primaryImageSmall) continue;

      const blob = await fetchImageBlob(obj.primaryImageSmall);
      if (!blob) continue;

      const storageId = await ctx.storage.store(blob);
      const randomLocation =
        locationIds[Math.floor(Math.random() * locationIds.length)]!;

      const collectionId = await ctx.runMutation(
        internal.seedMet.createCollection,
        {
          organizationId: orgId,
          userId,
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

      await ctx.runMutation(internal.seedMet.createMediaFile, {
        collectionId,
        organizationId: orgId,
        userId,
        storageId,
        fileName: `${org.prefix}-MET-${metId}.jpg`,
        fileSize: blob.size,
      });

      // Create location history
      await ctx.runMutation(internal.seedMet.createLocationHistory, {
        collectionId,
        toLocationId: randomLocation,
        movedBy: userId,
        movedAt:
          Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000),
        reason: "Initial cataloging",
      });

      successCount++;
      if (successCount % 10 === 0) {
        console.log(`  Progress: ${successCount}/${targetCount}`);
      }
    }

    console.log(`  Created ${successCount} real museum objects`);

    // Create accounts
    console.log("  Creating accounts...");
    const lenders = [
      { name: "Smithsonian Institution", city: "Washington DC" },
      { name: "British Museum", city: "London" },
      { name: "Louvre Museum", city: "Paris" },
    ];
    await Promise.all(
      Array.from({ length: lenders.length }, async (_, i) => {
        await ctx.runMutation(internal.seedMet.createAccount, {
          organizationId: orgId,
          userId,
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
    );

    // Create options
    await Promise.all(
      Array.from(["Excellent", "Good", "Fair", "Poor"]).map(async (c) => {
        await ctx.runMutation(internal.seedMet.createConditionOption, {
          organizationId: orgId,
          userId,
          name: c,
          description: `${c} condition`,
        });
      }),
    );
    await Promise.all(
      Array.from(["Oil", "Acrylic", "Watercolor", "Bronze", "Marble"]).map(
        async (m) => {
          await ctx.runMutation(internal.seedMet.createMaterialOption, {
            organizationId: orgId,
            userId,
            name: m,
          });
        },
      ),
    );
    await Promise.all(
      Array.from([
        "Painting",
        "Sculpture",
        "Drawing",
        "Print",
        "Photograph",
      ]).map(async (t) => {
        await ctx.runMutation(internal.seedMet.createTypeOption, {
          organizationId: orgId,
          userId,
          name: t,
        });
      }),
    );

    console.log(`  Done with ${org.name}!`);
    return null;
  },
});

// Run the full seed sequence
export const runFullSeed = action({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
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
