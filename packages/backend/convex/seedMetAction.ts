"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

const ORGANIZATIONS = [
  {
    name: "National Museum of Natural History",
    slug: "natural-history-museum",
    type: "museum" as const,
    subscriptionTier: "enterprise" as const,
    prefix: "NMNH",
    metQuery: "ancient",
  },
  {
    name: "Metropolitan Art Gallery",
    slug: "metropolitan-art-gallery",
    type: "gallery" as const,
    subscriptionTier: "pro" as const,
    prefix: "MAG",
    metQuery: "portrait",
  },
  {
    name: "Heritage Library & Archives",
    slug: "heritage-library",
    type: "library" as const,
    subscriptionTier: "pro" as const,
    prefix: "HLA",
    metQuery: "medieval",
  },
  {
    name: "Contemporary Design Museum",
    slug: "contemporary-design",
    type: "museum" as const,
    subscriptionTier: "enterprise" as const,
    prefix: "CDM",
    metQuery: "modern",
  },
  {
    name: "Vanderbilt Private Collection",
    slug: "vanderbilt-collection",
    type: "collector" as const,
    subscriptionTier: "free" as const,
    prefix: "VPC",
    metQuery: "jewelry",
  },
];

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchMetSearch(keyword: string): Promise<number[]> {
  await sleep(100);
  const url = `https://collectionapi.metmuseum.org/public/collection/v1/search?q=${encodeURIComponent(keyword)}&hasImages=true&isPublicDomain=true`;
  const response = await fetch(url);
  if (!response.ok) {
    console.error(`Met search failed: ${response.status}`);
    return [];
  }
  const data: MetSearchResult = await response.json();
  return data.objectIDs ?? [];
}

async function fetchMetObject(id: number): Promise<MetObject | null> {
  await sleep(100);
  const url = `https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function fetchImageBlob(url: string): Promise<Blob | null> {
  await sleep(100);
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.blob();
  } catch {
    return null;
  }
}

export const resetAndSeed = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    console.log("Starting Met API seed...");

    const userId = await ctx.runQuery(internal.seedMet.findUserByEmail, {
      email: SEED_USER_EMAIL,
    });
    if (!userId) {
      console.error(
        `User ${SEED_USER_EMAIL} not found. Please log in first, then retry.`,
      );
      return null;
    }
    console.log("Found user, proceeding...");

    console.log("Clearing existing data...");
    await ctx.runMutation(internal.seedMet.clearAllData);

    let totalCollections = 0;

    for (const org of ORGANIZATIONS) {
      console.log(`\nSeeding ${org.name}...`);

      const orgId = await ctx.runMutation(internal.seedMet.createOrganization, {
        name: org.name,
        slug: org.slug,
        type: org.type,
        subscriptionTier: org.subscriptionTier,
      });

      await ctx.runMutation(internal.seedMet.assignUserToOrg, {
        userId,
        organizationId: orgId,
      });

      const objectIds = await fetchMetSearch(org.metQuery);
      console.log(
        `Found ${objectIds.length} Met objects for "${org.metQuery}"`,
      );

      for (let i = objectIds.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [objectIds[i], objectIds[j]] = [objectIds[j]!, objectIds[i]!];
      }

      let successCount = 0;
      let attemptCount = 0;
      const maxAttempts = 100;
      const targetCount = 50;

      for (const metId of objectIds) {
        if (successCount >= targetCount || attemptCount >= maxAttempts) break;
        attemptCount++;

        const obj = await fetchMetObject(metId);
        if (!obj || !obj.primaryImageSmall) continue;

        const blob = await fetchImageBlob(obj.primaryImageSmall);
        if (!blob) continue;

        const storageId = await ctx.storage.store(blob);

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

        successCount++;
        if (successCount % 10 === 0) {
          console.log(`  ${org.name}: ${successCount}/${targetCount}`);
        }
      }

      console.log(
        `Finished ${org.name}: ${successCount} objects (${attemptCount} attempts)`,
      );
      if (successCount < 10) {
        console.warn(`WARNING: ${org.name} has <10 objects`);
      }
      totalCollections += successCount;
    }

    console.log(`\nSeed completed! Total collections: ${totalCollections}`);
    return null;
  },
});
