"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

// Organization definitions (must be duplicated here for Node.js runtime)
const ORGANIZATIONS = [
  {
    name: "National Museum of Natural History",
    slug: "natural-history-museum",
    type: "museum" as const,
    subscriptionTier: "enterprise" as const,
    prefix: "NMNH",
  },
  {
    name: "Metropolitan Art Gallery",
    slug: "metropolitan-art-gallery",
    type: "gallery" as const,
    subscriptionTier: "pro" as const,
    prefix: "MAG",
  },
  {
    name: "Heritage Library & Archives",
    slug: "heritage-library",
    type: "library" as const,
    subscriptionTier: "pro" as const,
    prefix: "HLA",
  },
  {
    name: "Contemporary Design Museum",
    slug: "contemporary-design",
    type: "museum" as const,
    subscriptionTier: "enterprise" as const,
    prefix: "CDM",
  },
  {
    name: "Vanderbilt Private Collection",
    slug: "vanderbilt-collection",
    type: "collector" as const,
    subscriptionTier: "free" as const,
    prefix: "VPC",
  },
];

// Wikipedia/Wikimedia Commons search terms for each collection
const COLLECTION_QUERIES: Record<string, string[]> = {
  "natural-history-museum": [
    "Tyrannosaurus rex skull",
    "Morpho menelaus butterfly",
    "Sequoiadendron giganteum",
    "Amethyst geode",
    "Woolly mammoth tusk",
    "Carcharodon carcharias jaw",
    "Petrified wood Arizona",
    "Gibeon meteorite",
    "Coral reef ecosystem",
    "Baltic amber insect",
  ],
  "metropolitan-art-gallery": [
    "Harbor painting impressionism",
    "Mercury bronze sculpture",
    "Chinese jade carving",
    "Titian portrait woman",
    "Paul de Lamerie silver",
    "Abstract expressionism painting",
    "Japanese folding screen",
    "Faberge egg",
    "Terracotta Army warrior",
    "Claude Monet garden",
  ],
  "heritage-library": [
    "Shakespeare First Folio",
    "Gutenberg Bible page",
    "John James Audubon turkey",
    "Book of Hours illuminated",
    "Principia Mathematica Newton",
    "Declaration of Independence",
    "Origin of Species first edition",
    "Aztec codex",
    "De revolutionibus orbium coelestium",
    "Book of the Dead papyrus",
  ],
  "contemporary-design": [
    "Zaha Hadid furniture",
    "Neon art installation",
    "3D printed art",
    "Modern teapot design",
    "Olafur Eliasson light",
    "Iris van Herpen fashion",
    "Recycled plastic design",
    "Kinetic sculpture wind",
    "Typography design specimen",
    "Mirror sphere art",
  ],
  "vanderbilt-collection": [
    "Louis XV console table",
    "Chinese cloisonne vase",
    "Raphael drawing hands",
    "Diamond tiara royal",
    "Tiffany lamp wisteria",
    "Persian silk carpet",
    "Chinese export porcelain",
    "Sevres porcelain vase",
    "Flemish tapestry verdure",
    "Cartier mystery clock",
  ],
};

/**
 * Main seeding action that resets database and creates fresh data
 * Run with: npx convex run seedFreshAction:resetAndSeed
 */
export const resetAndSeed = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    console.log("Starting database reset and seed...");

    // Step 1: Clear all existing data
    console.log("Clearing existing data...");
    await ctx.runMutation(internal.seedFresh.clearAllData);

    // Step 2: Find or create user
    const existingUser = await ctx.runQuery(internal.seedFresh.findUserByEmail, {
      email: "mirzacmarius@gmail.com",
    });

    if (!existingUser) {
      console.log("User with email mirzacmarius@gmail.com not found. Please log in first.");
      return null;
    }

    console.log("Found existing user, proceeding with seeding...");

    // Step 3: Create organizations
    console.log("Creating organizations...");
    const orgIds: Record<string, Id<"organizations">> = {};
    
    for (const org of ORGANIZATIONS) {
      const orgId = await ctx.runMutation(internal.seedFresh.createOrganization, {
        name: org.name,
        slug: org.slug,
        type: org.type,
        subscriptionTier: org.subscriptionTier,
      });
      orgIds[org.slug] = orgId;
      
      // Assign user as admin
      await ctx.runMutation(internal.seedFresh.assignUserToOrg, {
        userId: existingUser,
        organizationId: orgId,
      });
      
      console.log(`Created organization: ${org.name}`);
    }

    // Step 4: Create collections with images
    console.log("Creating collection objects with images...");
    
    // Get the full collection data from the mutation
    for (const org of ORGANIZATIONS) {
      const orgId = orgIds[org.slug];
      if (!orgId) continue;

      const pexelsQueries = COLLECTION_QUERIES[org.slug];

      if (!pexelsQueries) continue;

      // Create all collections for this org
      const collectionIds = await ctx.runMutation(internal.seedFresh.createAllCollectionsForOrg, {
        organizationId: orgId,
        userId: existingUser,
        orgSlug: org.slug,
        prefix: org.prefix,
      });
      
      // Fetch and upload images from Lorem Picsum
      for (let i = 0; i < collectionIds.length; i++) {
        const collectionId = collectionIds[i];
        // Create unique seed based on org index and collection index
        const orgIndex = ORGANIZATIONS.findIndex(o => o.slug === org.slug);
        const imageSeed = (orgIndex * 100) + i + 1000; // Ensures unique seeds
        
        try {
          const imageData = await fetchPlaceholderImage(imageSeed);
          if (imageData) {
            const storageId = await ctx.storage.store(imageData.blob);
            
            await ctx.runMutation(internal.seedFresh.createMediaFile, {
              collectionId: collectionId!,
              organizationId: orgId,
              userId: existingUser,
              storageId,
              fileName: `${org.prefix}-2024-${String(i + 1).padStart(3, "0")}-primary.jpg`,
              fileSize: imageData.blob.size,
              photographer: imageData.photographer,
            });
            
            console.log(`Uploaded image for collection ${i + 1} in ${org.name}`);
          } else {
            console.log(`Could not get image for collection ${i + 1} in ${org.name}`);
          }
        } catch (error) {
          console.log(`Could not fetch image ${i + 1} for ${org.name}: ${error}`);
        }
      }
      
      console.log(`Created ${collectionIds.length} collections for ${org.name}`);
    }

    console.log("Database seeding completed successfully!");
    return null;
  },
});

/**
 * Fetch image from Lorem Picsum (free, no API key, no rate limits)
 * Uses seed-based URLs for consistent images per collection
 */
async function fetchPlaceholderImage(seed: number): Promise<{ blob: Blob; photographer: string } | null> {
  try {
    // Lorem Picsum provides beautiful random images
    // Using seed ensures same image for same seed value
    const imageUrl = `https://picsum.photos/seed/${seed}/800/600`;
    
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.status}`);
    }

    const blob = await imageResponse.blob();
    
    return {
      blob,
      photographer: "Lorem Picsum",
    };
  } catch (error) {
    console.error(`Error fetching placeholder image: ${error}`);
    return null;
  }
}
