import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

/**
 * Seed database with test data
 * Run this with: npx convex run seed:seedDatabase
 */
export const seedDatabase = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    console.log("🌱 Starting database seeding...");

    // Find existing user by email
    const existingUser = await ctx.runQuery(internal.seed.findUserByEmail, {
      email: "mirzacmarius@gmail.com",
    });

    if (!existingUser) {
      console.log(
        "⚠️  User with email mirzacmarius@gmail.com not found. Please log in first.",
      );
      return null;
    }

    console.log(`✅ Found existing user: mirzacmarius@gmail.com`);

    // Get existing organizations
    const existingOrgs = await ctx.runQuery(internal.seed.checkExistingData);
    const orgSlugToId: Record<string, Id<"organizations">> = {};

    // Create organizations if they don't exist
    const organizations = [
      {
        name: "Metropolitan Museum of Art",
        slug: "met-museum",
        type: "museum" as const,
        subscriptionTier: "pro" as const,
      },
      {
        name: "British Museum",
        slug: "british-museum",
        type: "museum" as const,
        subscriptionTier: "enterprise" as const,
      },
      {
        name: "Library of Congress",
        slug: "library-of-congress",
        type: "library" as const,
        subscriptionTier: "pro" as const,
      },
      {
        name: "The Getty Museum",
        slug: "getty-museum",
        type: "museum" as const,
        subscriptionTier: "enterprise" as const,
      },
      {
        name: "Private Collection - Smith Estate",
        slug: "smith-collection",
        type: "collector" as const,
        subscriptionTier: "free" as const,
      },
    ];

    // Check which organizations already exist
    const existingOrgSlugs = new Set<string>();
    for (const orgId of existingOrgs) {
      const org = await ctx.runQuery(internal.seed.getOrganizationById, {
        orgId,
      });
      if (org) {
        orgSlugToId[org.slug] = orgId;
        existingOrgSlugs.add(org.slug);
        console.log(`📋 Found existing organization: ${org.name}`);
      }
    }

    // Create missing organizations
    for (const orgData of organizations) {
      if (existingOrgSlugs.has(orgData.slug)) {
        continue;
      }

      const orgId = await ctx.runMutation(
        internal.seed.createOrganization,
        orgData,
      );
      orgSlugToId[orgData.slug] = orgId;
      console.log(`✅ Created organization: ${orgData.name}`);
    }

    // Assign user to all organizations as admin
    const userIds: Record<string, Id<"users">> = {};
    for (const orgData of organizations) {
      const orgId = orgSlugToId[orgData.slug];
      if (!orgId) continue;

      userIds[orgData.slug] = existingUser;

      // Assign user to organization with admin role
      await ctx.runMutation(internal.seed.assignUserToOrg, {
        userId: existingUser,
        organizationId: orgId,
        roleName: "admin",
      });

      console.log(`✅ Assigned user to ${orgData.name} as admin`);
    }

    // Create collection objects
    const collections = [
      // Metropolitan Museum of Art
      {
        orgSlug: "met-museum",
        accessionNumber: "MET-2024-001",
        title: "Van Gogh's Starry Night",
        objectType: "Painting",
        objectName: "The Starry Night",
        culture: "Dutch",
        period: "Post-Impressionist",
        dateCreated: "1889",
        materials: "Oil on canvas",
        dimensions: "73.7 cm × 92.1 cm",
        description:
          "One of the most recognized paintings in the world, depicting a swirling night sky over a village.",
        condition: "Excellent",
        provenance: "Acquired from private collection in 1941",
      },
      {
        orgSlug: "met-museum",
        accessionNumber: "MET-2024-002",
        title: "Ancient Egyptian Sarcophagus",
        objectType: "Funerary Object",
        objectName: "Sarcophagus of Tutankhamun",
        culture: "Ancient Egyptian",
        period: "New Kingdom",
        dateCreated: "c. 1323 BCE",
        materials: "Gilded wood, semiprecious stones",
        dimensions: "223.5 cm × 87.5 cm × 153.5 cm",
        description:
          "Elaborately decorated sarcophagus from the tomb of Tutankhamun.",
        condition: "Good, minor wear",
        provenance: "Excavated from Valley of the Kings, 1922",
      },
      {
        orgSlug: "met-museum",
        accessionNumber: "MET-2024-003",
        title: "Chinese Porcelain Vase",
        objectType: "Ceramic",
        objectName: "Ming Dynasty Blue and White Vase",
        culture: "Chinese",
        period: "Ming Dynasty",
        dateCreated: "c. 1420",
        materials: "Porcelain with cobalt blue underglaze",
        dimensions: "Height: 45.2 cm",
        description:
          "Exquisite blue and white porcelain vase from the Ming Dynasty.",
        condition: "Excellent",
        provenance: "Acquired from private collection",
      },
      {
        orgSlug: "met-museum",
        accessionNumber: "MET-2024-004",
        title: "Greek Marble Statue",
        objectType: "Sculpture",
        objectName: "Discus Thrower",
        culture: "Ancient Greek",
        period: "Classical Period",
        dateCreated: "c. 450 BCE",
        materials: "Marble",
        dimensions: "Height: 155 cm",
        description:
          "Classical Greek sculpture depicting an athlete preparing to throw a discus.",
        condition: "Good, restored",
        provenance: "Excavated from ancient site",
      },

      // British Museum
      {
        orgSlug: "british-museum",
        accessionNumber: "BM-2024-001",
        title: "Rosetta Stone",
        objectType: "Inscription",
        objectName: "Rosetta Stone",
        culture: "Ancient Egyptian",
        period: "Ptolemaic Period",
        dateCreated: "196 BCE",
        materials: "Granodiorite",
        dimensions: "112.3 cm × 75.7 cm × 28.4 cm",
        description:
          "Ancient Egyptian decree inscribed in three scripts: hieroglyphs, Demotic, and Ancient Greek.",
        condition: "Excellent",
        provenance: "Discovered in 1799 at Rosetta, Egypt",
      },
      {
        orgSlug: "british-museum",
        accessionNumber: "BM-2024-002",
        title: "Parthenon Marbles",
        objectType: "Architectural Sculpture",
        objectName: "Elgin Marbles",
        culture: "Ancient Greek",
        period: "Classical Period",
        dateCreated: "c. 447-432 BCE",
        materials: "Pentelic marble",
        dimensions: "Various",
        description:
          "Collection of Classical Greek marble sculptures from the Parthenon temple.",
        condition: "Good, weathered",
        provenance: "Originally from Parthenon, Athens",
      },
      {
        orgSlug: "british-museum",
        accessionNumber: "BM-2024-003",
        title: "Sutton Hoo Helmet",
        objectType: "Armor",
        objectName: "Anglo-Saxon Helmet",
        culture: "Anglo-Saxon",
        period: "Early Medieval",
        dateCreated: "c. 625 CE",
        materials: "Iron, bronze, silver",
        dimensions: "Height: 31.8 cm",
        description:
          "Decorated helmet from the Sutton Hoo ship burial, one of the most important archaeological finds in Britain.",
        condition: "Restored",
        provenance: "Excavated from Sutton Hoo, 1939",
      },
      {
        orgSlug: "british-museum",
        accessionNumber: "BM-2024-004",
        title: "Aztec Double-Headed Serpent",
        objectType: "Ritual Object",
        objectName: "Turquoise Mosaic Serpent",
        culture: "Aztec",
        period: "Post-Classic",
        dateCreated: "c. 1400-1521 CE",
        materials: "Cedar wood, turquoise mosaic, shell",
        dimensions: "Height: 20.5 cm",
        description:
          "Remarkable turquoise mosaic sculpture of a double-headed serpent.",
        condition: "Excellent",
        provenance: "Acquired from Mexico",
      },

      // Library of Congress
      {
        orgSlug: "library-of-congress",
        accessionNumber: "LOC-2024-001",
        title: "Gutenberg Bible",
        objectType: "Book",
        objectName: "42-Line Bible",
        culture: "European",
        period: "Renaissance",
        dateCreated: "c. 1455",
        materials: "Vellum, ink",
        dimensions: "42.5 cm × 30 cm",
        description:
          "One of the first major books printed using movable type, printed by Johannes Gutenberg.",
        condition: "Excellent",
        provenance: "Acquired 1930",
      },
      {
        orgSlug: "library-of-congress",
        accessionNumber: "LOC-2024-002",
        title: "Declaration of Independence",
        objectType: "Document",
        objectName: "Original Declaration",
        culture: "American",
        period: "Colonial Period",
        dateCreated: "1776",
        materials: "Parchment, ink",
        dimensions: "75.5 cm × 61.5 cm",
        description:
          "Original signed copy of the United States Declaration of Independence.",
        condition: "Good, fragile",
        provenance: "Transferred from State Department, 1921",
      },
      {
        orgSlug: "library-of-congress",
        accessionNumber: "LOC-2024-003",
        title: "Lincoln's Gettysburg Address",
        objectType: "Manuscript",
        objectName: "Gettysburg Address Draft",
        culture: "American",
        period: "Civil War Era",
        dateCreated: "1863",
        materials: "Paper, ink",
        dimensions: "27.9 cm × 21.6 cm",
        description:
          "One of five known manuscript copies of Abraham Lincoln's Gettysburg Address.",
        condition: "Good",
        provenance: "Donated by Lincoln family",
      },
      {
        orgSlug: "library-of-congress",
        accessionNumber: "LOC-2024-004",
        title: "Magna Carta",
        objectType: "Legal Document",
        objectName: "Magna Carta 1215",
        culture: "English",
        period: "Medieval",
        dateCreated: "1215",
        materials: "Vellum, ink",
        dimensions: "50 cm × 40 cm",
        description:
          "One of the original copies of the Magna Carta, a foundational document of English law.",
        condition: "Good, aged",
        provenance: "Acquired from private collection",
      },

      // The Getty Museum
      {
        orgSlug: "getty-museum",
        accessionNumber: "GETTY-2024-001",
        title: "Irises by Van Gogh",
        objectType: "Painting",
        objectName: "Irises",
        culture: "Dutch",
        period: "Post-Impressionist",
        dateCreated: "1889",
        materials: "Oil on canvas",
        dimensions: "71 cm × 93 cm",
        description:
          "Beautiful painting of irises, one of Van Gogh's most celebrated works.",
        condition: "Excellent",
        provenance: "Acquired 1990",
      },
      {
        orgSlug: "getty-museum",
        accessionNumber: "GETTY-2024-002",
        title: "Roman Mosaic Floor",
        objectType: "Mosaic",
        objectName: "Medusa Mosaic",
        culture: "Roman",
        period: "Imperial Period",
        dateCreated: "c. 200 CE",
        materials: "Marble and stone tesserae",
        dimensions: "285 cm × 285 cm",
        description:
          "Large floor mosaic depicting Medusa's head, typical of Roman villa decoration.",
        condition: "Excellent",
        provenance: "Excavated from Roman villa",
      },
      {
        orgSlug: "getty-museum",
        accessionNumber: "GETTY-2024-003",
        title: "Illuminated Manuscript",
        objectType: "Manuscript",
        objectName: "Book of Hours",
        culture: "Medieval European",
        period: "Gothic",
        dateCreated: "c. 1420",
        materials: "Vellum, gold leaf, pigments",
        dimensions: "15 cm × 11 cm",
        description:
          "Exquisitely illuminated prayer book with intricate miniatures and decorative borders.",
        condition: "Excellent",
        provenance: "Acquired from private collection",
      },
      {
        orgSlug: "getty-museum",
        accessionNumber: "GETTY-2024-004",
        title: "Renaissance Portrait",
        objectType: "Painting",
        objectName: "Portrait of a Young Woman",
        culture: "Italian",
        period: "Renaissance",
        dateCreated: "c. 1480",
        materials: "Tempera on wood panel",
        dimensions: "48 cm × 33 cm",
        description:
          "Delicate portrait attributed to the Italian Renaissance school.",
        condition: "Good, minor restoration",
        provenance: "Acquired from private collection",
      },

      // Private Collection - Smith Estate
      {
        orgSlug: "smith-collection",
        accessionNumber: "SMITH-2024-001",
        title: "Victorian Jewelry Box",
        objectType: "Decorative Art",
        objectName: "Mother-of-Pearl Inlaid Box",
        culture: "English",
        period: "Victorian",
        dateCreated: "c. 1870",
        materials: "Wood, mother-of-pearl, brass",
        dimensions: "25 cm × 18 cm × 12 cm",
        description:
          "Ornate Victorian jewelry box with intricate mother-of-pearl inlay.",
        condition: "Very good",
        provenance: "Family heirloom",
      },
      {
        orgSlug: "smith-collection",
        accessionNumber: "SMITH-2024-002",
        title: "Japanese Print",
        objectType: "Print",
        objectName: "Hokusai Wave",
        culture: "Japanese",
        period: "Edo Period",
        dateCreated: "c. 1830",
        materials: "Woodblock print on paper",
        dimensions: "25.7 cm × 37.9 cm",
        description:
          "Famous woodblock print from Hokusai's Thirty-Six Views of Mount Fuji series.",
        condition: "Good",
        provenance: "Acquired from dealer",
      },
      {
        orgSlug: "smith-collection",
        accessionNumber: "SMITH-2024-003",
        title: "Art Deco Vase",
        objectType: "Ceramic",
        objectName: "Lalique Style Vase",
        culture: "French",
        period: "Art Deco",
        dateCreated: "c. 1925",
        materials: "Glass",
        dimensions: "Height: 28 cm",
        description: "Elegant Art Deco glass vase with geometric decoration.",
        condition: "Excellent",
        provenance: "Acquired from auction",
      },
      {
        orgSlug: "smith-collection",
        accessionNumber: "SMITH-2024-004",
        title: "Antique Silver Tea Set",
        objectType: "Metalwork",
        objectName: "Georgian Silver Tea Service",
        culture: "English",
        period: "Georgian",
        dateCreated: "c. 1790",
        materials: "Sterling silver",
        dimensions: "Teapot: 25 cm height",
        description:
          "Complete Georgian silver tea service with matching pieces.",
        condition: "Excellent",
        provenance: "Family collection",
      },
      {
        orgSlug: "smith-collection",
        accessionNumber: "SMITH-2024-005",
        title: "Persian Carpet",
        objectType: "Textile",
        objectName: "Isfahan Carpet",
        culture: "Persian",
        period: "19th Century",
        dateCreated: "c. 1880",
        materials: "Wool, silk",
        dimensions: "305 cm × 213 cm",
        description: "Fine Persian carpet with traditional floral motifs.",
        condition: "Very good, minor wear",
        provenance: "Acquired from estate sale",
      },
    ];

    // Create collections for each organization
    for (const collectionData of collections) {
      const orgId = orgSlugToId[collectionData.orgSlug];
      const userId = userIds[collectionData.orgSlug];

      if (!orgId || !userId) {
        console.error(
          `Skipping collection ${collectionData.accessionNumber} - org or user not found`,
        );
        continue;
      }

      // Check if collection already exists
      const existing = await ctx.runQuery(internal.seed.checkCollectionExists, {
        organizationId: orgId,
        accessionNumber: collectionData.accessionNumber,
      });

      if (existing) {
        console.log(
          `⏭️  Skipping collection ${collectionData.accessionNumber} - already exists`,
        );
        continue;
      }

      // Extract orgSlug before passing to mutation
      const { orgSlug, ...collectionFields } = collectionData;

      await ctx.runMutation(internal.seed.createCollection, {
        organizationId: orgId,
        userId,
        ...collectionFields,
      });
    }

    console.log(`✅ Created ${collections.length} collection objects`);

    // Create locations for each organization
    const locationData = [
      {
        orgSlug: "met-museum",
        locations: [
          { name: "Main Building", type: "building", parent: null },
          {
            name: "European Paintings Wing",
            type: "floor",
            parent: "Main Building",
          },
          {
            name: "Gallery 815",
            type: "room",
            parent: "European Paintings Wing",
          },
          { name: "Storage Vault A", type: "storage", parent: "Main Building" },
        ],
      },
      {
        orgSlug: "british-museum",
        locations: [
          { name: "Great Court", type: "building", parent: null },
          { name: "Egyptian Gallery", type: "floor", parent: "Great Court" },
          { name: "Room 4", type: "room", parent: "Egyptian Gallery" },
          { name: "Conservation Lab", type: "room", parent: "Great Court" },
        ],
      },
      {
        orgSlug: "library-of-congress",
        locations: [
          { name: "Jefferson Building", type: "building", parent: null },
          {
            name: "Rare Book Room",
            type: "room",
            parent: "Jefferson Building",
          },
          { name: "Vault 1", type: "storage", parent: "Jefferson Building" },
          {
            name: "Exhibition Hall",
            type: "room",
            parent: "Jefferson Building",
          },
        ],
      },
      {
        orgSlug: "getty-museum",
        locations: [
          { name: "Getty Center", type: "building", parent: null },
          { name: "Paintings Gallery", type: "floor", parent: "Getty Center" },
          { name: "Gallery 204", type: "room", parent: "Paintings Gallery" },
          { name: "Storage Facility", type: "storage", parent: "Getty Center" },
        ],
      },
      {
        orgSlug: "smith-collection",
        locations: [
          { name: "Main Residence", type: "building", parent: null },
          { name: "Living Room", type: "room", parent: "Main Residence" },
          { name: "Study", type: "room", parent: "Main Residence" },
          {
            name: "Climate-Controlled Storage",
            type: "storage",
            parent: "Main Residence",
          },
        ],
      },
    ];

    const locationIds: Record<string, Record<string, Id<"locations">>> = {};

    for (const locGroup of locationData) {
      const orgId = orgSlugToId[locGroup.orgSlug];
      if (!orgId) {
        console.error(
          `Skipping locations for ${locGroup.orgSlug} - org not found`,
        );
        continue;
      }

      locationIds[locGroup.orgSlug] = {};

      for (const loc of locGroup.locations) {
        const orgLocationIds = locationIds[locGroup.orgSlug];
        const parentId =
          loc.parent && orgLocationIds ? orgLocationIds[loc.parent] : undefined;

        const locId = await ctx.runMutation(internal.seed.createLocation, {
          organizationId: orgId,
          name: loc.name,
          type: loc.type,
          parentLocationId: parentId,
        });

        if (orgLocationIds) {
          orgLocationIds[loc.name] = locId;
        }
      }
    }

    console.log("✅ Created locations for all organizations");

    // Assign collections to locations
    await ctx.runMutation(internal.seed.assignCollectionsToLocations, {
      collections: [
        // Metropolitan Museum of Art
        {
          orgSlug: "met-museum",
          accessionNumber: "MET-2024-001",
          locationName: "Gallery 815",
        },
        {
          orgSlug: "met-museum",
          accessionNumber: "MET-2024-002",
          locationName: "Storage Vault A",
        },
        {
          orgSlug: "met-museum",
          accessionNumber: "MET-2024-003",
          locationName: "Gallery 815",
        },
        {
          orgSlug: "met-museum",
          accessionNumber: "MET-2024-004",
          locationName: "European Paintings Wing",
        },

        // British Museum
        {
          orgSlug: "british-museum",
          accessionNumber: "BM-2024-001",
          locationName: "Room 4",
        },
        {
          orgSlug: "british-museum",
          accessionNumber: "BM-2024-002",
          locationName: "Great Court",
        },
        {
          orgSlug: "british-museum",
          accessionNumber: "BM-2024-003",
          locationName: "Conservation Lab",
        },
        {
          orgSlug: "british-museum",
          accessionNumber: "BM-2024-004",
          locationName: "Egyptian Gallery",
        },

        // Library of Congress
        {
          orgSlug: "library-of-congress",
          accessionNumber: "LOC-2024-001",
          locationName: "Rare Book Room",
        },
        {
          orgSlug: "library-of-congress",
          accessionNumber: "LOC-2024-002",
          locationName: "Vault 1",
        },
        {
          orgSlug: "library-of-congress",
          accessionNumber: "LOC-2024-003",
          locationName: "Rare Book Room",
        },
        {
          orgSlug: "library-of-congress",
          accessionNumber: "LOC-2024-004",
          locationName: "Exhibition Hall",
        },

        // The Getty Museum
        {
          orgSlug: "getty-museum",
          accessionNumber: "GETTY-2024-001",
          locationName: "Gallery 204",
        },
        {
          orgSlug: "getty-museum",
          accessionNumber: "GETTY-2024-002",
          locationName: "Storage Facility",
        },
        {
          orgSlug: "getty-museum",
          accessionNumber: "GETTY-2024-003",
          locationName: "Paintings Gallery",
        },
        {
          orgSlug: "getty-museum",
          accessionNumber: "GETTY-2024-004",
          locationName: "Gallery 204",
        },

        // Private Collection - Smith Estate
        {
          orgSlug: "smith-collection",
          accessionNumber: "SMITH-2024-001",
          locationName: "Living Room",
        },
        {
          orgSlug: "smith-collection",
          accessionNumber: "SMITH-2024-002",
          locationName: "Study",
        },
        {
          orgSlug: "smith-collection",
          accessionNumber: "SMITH-2024-003",
          locationName: "Living Room",
        },
        {
          orgSlug: "smith-collection",
          accessionNumber: "SMITH-2024-004",
          locationName: "Climate-Controlled Storage",
        },
        {
          orgSlug: "smith-collection",
          accessionNumber: "SMITH-2024-005",
          locationName: "Living Room",
        },
      ],
      locationIds,
    });

    console.log("✅ Assigned all collections to locations");

    // Create some accessions
    await ctx.runMutation(internal.seed.createAccessions, {
      accessions: [
        {
          orgSlug: "met-museum",
          collectionAccessionNumber: "MET-2024-001",
          dateReceived: Date.now() - 30 * 24 * 60 * 60 * 1000,
          source: "Acquired from private collector",
          method: "purchase" as const,
          cost: 5000000,
        },
        {
          orgSlug: "british-museum",
          collectionAccessionNumber: "BM-2024-002",
          dateReceived: Date.now() - 60 * 24 * 60 * 60 * 1000,
          source: "Gift from benefactor",
          method: "gift" as const,
        },
      ],
      userIds,
      orgSlugToId,
    });

    // Create some loans
    await ctx.runMutation(internal.seed.createLoans, {
      loans: [
        {
          orgSlug: "met-museum",
          type: "outgoing" as const,
          lenderBorrowerName: "Louvre Museum",
          startDate: Date.now() - 10 * 24 * 60 * 60 * 1000,
          endDate: Date.now() + 90 * 24 * 60 * 60 * 1000,
          status: "active" as const,
          collectionAccessionNumbers: ["MET-2024-001"],
        },
        {
          orgSlug: "getty-museum",
          type: "incoming" as const,
          lenderBorrowerName: "National Gallery, London",
          startDate: Date.now() - 5 * 24 * 60 * 60 * 1000,
          endDate: Date.now() + 180 * 24 * 60 * 60 * 1000,
          status: "active" as const,
          collectionAccessionNumbers: [],
        },
      ],
      userIds,
      orgSlugToId,
    });

    console.log("✅ Created accessions and loans");

    // Create some deaccessions
    await ctx.runMutation(internal.seed.createDeaccessions, {
      deaccessions: [
        {
          orgSlug: "met-museum",
          collectionAccessionNumber: "MET-2024-002",
          dateDeaccessioned: Date.now() - 90 * 24 * 60 * 60 * 1000,
          reason: "No longer fits collection mission",
          method: "sale" as const,
          disposition: "Sold to private collector",
          status: "approved" as const,
        },
        {
          orgSlug: "british-museum",
          collectionAccessionNumber: "BM-2024-003",
          dateDeaccessioned: Date.now() - 45 * 24 * 60 * 60 * 1000,
          reason: "Condition deteriorated beyond restoration",
          method: "destruction" as const,
          status: "pending" as const,
        },
        {
          orgSlug: "library-of-congress",
          collectionAccessionNumber: "LOC-2024-004",
          dateDeaccessioned: Date.now() - 120 * 24 * 60 * 60 * 1000,
          reason: "Duplicate copy",
          method: "transfer" as const,
          disposition: "Transferred to Smithsonian",
          status: "approved" as const,
        },
        {
          orgSlug: "smith-collection",
          collectionAccessionNumber: "SMITH-2024-003",
          dateDeaccessioned: Date.now() - 15 * 24 * 60 * 60 * 1000,
          reason: "Estate sale preparation",
          method: "sale" as const,
          status: "pending" as const,
        },
        {
          orgSlug: "getty-museum",
          collectionAccessionNumber: "GETTY-2024-004",
          dateDeaccessioned: Date.now() - 200 * 24 * 60 * 60 * 1000,
          reason: "Authentication concerns",
          method: "donation" as const,
          disposition: "Donated to regional museum",
          status: "rejected" as const,
        },
      ],
      userIds,
      orgSlugToId,
    });

    console.log("✅ Created deaccessions");

    // Create audit log entries for activity tracking
    await ctx.runMutation(internal.seed.createAuditLogs, {
      userIds,
      orgSlugToId,
    });

    console.log("✅ Created audit log entries");

    // Create notifications
    await ctx.runMutation(internal.seed.createNotifications, {
      userIds,
      orgSlugToId,
    });

    console.log("✅ Created notifications");

    // Create condition reports for loan items
    await ctx.runMutation(internal.seed.createConditionReports, {
      userIds,
      orgSlugToId,
    });

    console.log("✅ Created condition reports");

    console.log("🎉 Database seeding completed successfully!");
    return null;
  },
});

/**
 * Check if data already exists
 */
export const checkExistingData = internalQuery({
  args: {},
  returns: v.array(v.id("organizations")),
  handler: async (ctx) => {
    const orgs = await ctx.db.query("organizations").collect();
    return orgs.map((o) => o._id);
  },
});

/**
 * Create organization with default roles
 */
export const createOrganization = internalMutation({
  args: {
    name: v.string(),
    slug: v.string(),
    type: v.union(
      v.literal("museum"),
      v.literal("gallery"),
      v.literal("library"),
      v.literal("collector"),
    ),
    subscriptionTier: v.optional(
      v.union(v.literal("free"), v.literal("pro"), v.literal("enterprise")),
    ),
  },
  returns: v.id("organizations"),
  handler: async (ctx, args) => {
    const orgId = await ctx.db.insert("organizations", {
      name: args.name,
      slug: args.slug,
      type: args.type,
      subscriptionTier: args.subscriptionTier ?? "free",
      settings: {
        autoGenerateAccessionNumbers: true,
        accessionNumberFormat: `${args.slug.toUpperCase().substring(0, 3)}-YYYY-###`,
      },
    });

    // Create default roles
    await ctx.runMutation(internal.organizations.createDefaultRoles, {
      organizationId: orgId,
    });

    return orgId;
  },
});

/**
 * Check if collection exists
 */
export const checkCollectionExists = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    accessionNumber: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const collection = await ctx.db
      .query("collections")
      .withIndex("by_organization_and_accessionNumber", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("accessionNumber", args.accessionNumber),
      )
      .first();
    return !!collection;
  },
});

/**
 * Create user
 */
export const createUser = internalMutation({
  args: {
    name: v.string(),
    email: v.string(),
    username: v.string(),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("users", {
      name: args.name,
      email: args.email,
      username: args.username,
    });
  },
});

/**
 * Find user by email
 */
export const findUserByEmail = internalQuery({
  args: {
    email: v.string(),
  },
  returns: v.union(v.id("users"), v.null()),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .first();
    return user?._id ?? null;
  },
});

/**
 * Get organization by ID
 */
export const getOrganizationById = internalQuery({
  args: {
    orgId: v.id("organizations"),
  },
  returns: v.union(
    v.object({
      _id: v.id("organizations"),
      name: v.string(),
      slug: v.string(),
      type: v.union(
        v.literal("museum"),
        v.literal("gallery"),
        v.literal("library"),
        v.literal("collector"),
      ),
      subscriptionTier: v.optional(
        v.union(v.literal("free"), v.literal("pro"), v.literal("enterprise")),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.orgId);
    if (!org) return null;
    return {
      _id: org._id,
      name: org.name,
      slug: org.slug,
      type: org.type,
      subscriptionTier: org.subscriptionTier,
    };
  },
});

/**
 * Assign user to organization with role
 */
export const assignUserToOrg = internalMutation({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    roleName: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Check if user is already assigned to this organization
    const existing = await ctx.db
      .query("userOrganizations")
      .withIndex("by_user_and_organization", (q) =>
        q.eq("userId", args.userId).eq("organizationId", args.organizationId),
      )
      .first();

    if (existing) {
      console.log(`User already assigned to organization, skipping...`);
      return null;
    }

    const role = await ctx.db
      .query("roles")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("name"), args.roleName),
          q.eq(q.field("isSystemRole"), true),
        ),
      )
      .first();

    if (!role) {
      throw new Error(`Role ${args.roleName} not found`);
    }

    await ctx.db.insert("userOrganizations", {
      userId: args.userId,
      organizationId: args.organizationId,
      roleId: role._id,
      joinedAt: Date.now(),
    });

    return null;
  },
});

/**
 * Create collection object
 */
export const createCollection = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    accessionNumber: v.string(),
    title: v.string(),
    objectType: v.optional(v.string()),
    objectName: v.optional(v.string()),
    culture: v.optional(v.string()),
    period: v.optional(v.string()),
    dateCreated: v.optional(v.string()),
    materials: v.optional(v.string()),
    dimensions: v.optional(v.string()),
    description: v.optional(v.string()),
    condition: v.optional(v.string()),
    provenance: v.optional(v.string()),
  },
  returns: v.id("collections"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("collections", {
      organizationId: args.organizationId,
      accessionNumber: args.accessionNumber,
      title: args.title,
      objectType: args.objectType,
      objectName: args.objectName,
      culture: args.culture,
      period: args.period,
      dateCreated: args.dateCreated,
      materials: args.materials,
      dimensions: args.dimensions,
      description: args.description,
      condition: args.condition,
      provenance: args.provenance,
      status: "active",
      catalogedBy: args.userId,
      catalogedAt: Date.now(),
    });
  },
});

/**
 * Create location
 */
export const createLocation = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    type: v.string(),
    parentLocationId: v.optional(v.id("locations")),
  },
  returns: v.id("locations"),
  handler: async (ctx, args) => {
    // Check if location already exists
    const existing = await ctx.db
      .query("locations")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => q.eq(q.field("name"), args.name))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("locations", {
      organizationId: args.organizationId,
      name: args.name,
      type: args.type,
      parentLocationId: args.parentLocationId,
      isActive: true,
    });
  },
});

/**
 * Assign collections to locations
 */
export const assignCollectionsToLocations = internalMutation({
  args: {
    collections: v.array(
      v.object({
        orgSlug: v.string(),
        accessionNumber: v.string(),
        locationName: v.string(),
      }),
    ),
    locationIds: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    for (const item of args.collections) {
      const org = await ctx.db
        .query("organizations")
        .withIndex("by_slug", (q) => q.eq("slug", item.orgSlug))
        .first();

      if (!org) continue;

      const collection = await ctx.db
        .query("collections")
        .withIndex("by_organization_and_accessionNumber", (q) =>
          q
            .eq("organizationId", org._id)
            .eq("accessionNumber", item.accessionNumber),
        )
        .first();

      if (!collection) continue;

      const locationId = (args.locationIds as any)[item.orgSlug]?.[
        item.locationName
      ];
      if (!locationId) continue;

      await ctx.db.patch(collection._id, {
        currentLocationId: locationId as Id<"locations">,
      });

      // Create location history entry
      await ctx.db.insert("locationHistory", {
        collectionId: collection._id,
        toLocationId: locationId as Id<"locations">,
        movedBy: collection.catalogedBy,
        movedAt: Date.now(),
        reason: "Initial cataloging",
      });
    }

    return null;
  },
});

/**
 * Create accessions
 */
export const createAccessions = internalMutation({
  args: {
    accessions: v.array(
      v.object({
        orgSlug: v.string(),
        collectionAccessionNumber: v.string(),
        dateReceived: v.number(),
        source: v.string(),
        method: v.union(
          v.literal("purchase"),
          v.literal("gift"),
          v.literal("loan"),
          v.literal("transfer"),
        ),
        cost: v.optional(v.number()),
      }),
    ),
    userIds: v.any(),
    orgSlugToId: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    for (const accData of args.accessions) {
      const orgId = (args.orgSlugToId as any)[accData.orgSlug] as
        | Id<"organizations">
        | undefined;
      if (!orgId) continue;

      const collection = await ctx.db
        .query("collections")
        .withIndex("by_organization_and_accessionNumber", (q) =>
          q
            .eq("organizationId", orgId)
            .eq("accessionNumber", accData.collectionAccessionNumber),
        )
        .first();

      if (!collection) continue;

      const userId = (args.userIds as any)[accData.orgSlug] as
        | Id<"users">
        | undefined;
      if (!userId) continue;

      const org = await ctx.db.get(orgId);
      if (!org) continue;

      const year = new Date(accData.dateReceived).getFullYear();
      const orgSlug = org.slug.toUpperCase().substring(0, 3);
      const accessionNumber = `ACC-${orgSlug}-${year}-001`;

      await ctx.db.insert("accessions", {
        organizationId: orgId,
        collectionId: collection._id,
        accessionNumber,
        dateReceived: accData.dateReceived,
        source: accData.source,
        method: accData.method,
        cost: accData.cost,
        status: "approved",
        approvedBy: userId,
        approvedAt: Date.now(),
      });
    }

    return null;
  },
});

/**
 * Create loans
 */
export const createLoans = internalMutation({
  args: {
    loans: v.array(
      v.object({
        orgSlug: v.string(),
        type: v.union(v.literal("incoming"), v.literal("outgoing")),
        lenderBorrowerName: v.string(),
        startDate: v.number(),
        endDate: v.number(),
        status: v.union(
          v.literal("pending"),
          v.literal("active"),
          v.literal("returned"),
          v.literal("cancelled"),
        ),
        collectionAccessionNumbers: v.array(v.string()),
      }),
    ),
    userIds: v.any(),
    orgSlugToId: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    for (const loanData of args.loans) {
      const orgId = (args.orgSlugToId as any)[loanData.orgSlug] as
        | Id<"organizations">
        | undefined;
      if (!orgId) continue;

      const org = await ctx.db.get(orgId);
      if (!org) continue;

      const userId = (args.userIds as any)[loanData.orgSlug] as
        | Id<"users">
        | undefined;
      if (!userId) continue;

      const year = new Date(loanData.startDate).getFullYear();
      const orgSlug = org.slug.toUpperCase().substring(0, 3);
      const prefix = loanData.type === "incoming" ? "IN" : "OUT";
      const loanNumber = `${prefix}-${orgSlug}-${year}-001`;

      const loanId = await ctx.db.insert("loans", {
        organizationId: orgId,
        loanNumber,
        type: loanData.type,
        lenderBorrowerName: loanData.lenderBorrowerName,
        startDate: loanData.startDate,
        endDate: loanData.endDate,
        status: loanData.status,
        approvedBy: loanData.status === "active" ? userId : undefined,
        approvedAt: loanData.status === "active" ? Date.now() : undefined,
      });

      // Add collection items to loan
      for (const accNumber of loanData.collectionAccessionNumbers) {
        const collection = await ctx.db
          .query("collections")
          .withIndex("by_organization_and_accessionNumber", (q) =>
            q.eq("organizationId", orgId).eq("accessionNumber", accNumber),
          )
          .first();

        if (collection) {
          await ctx.db.insert("loanItems", {
            loanId,
            collectionId: collection._id,
          });

          // Update collection status if loan is active
          if (loanData.status === "active") {
            await ctx.db.patch(collection._id, {
              status: "loaned",
            });
          }
        }
      }
    }

    return null;
  },
});

/**
 * Create deaccessions
 */
export const createDeaccessions = internalMutation({
  args: {
    deaccessions: v.array(
      v.object({
        orgSlug: v.string(),
        collectionAccessionNumber: v.string(),
        dateDeaccessioned: v.number(),
        reason: v.string(),
        method: v.union(
          v.literal("sale"),
          v.literal("donation"),
          v.literal("destruction"),
          v.literal("transfer"),
        ),
        disposition: v.optional(v.string()),
        status: v.union(
          v.literal("pending"),
          v.literal("approved"),
          v.literal("rejected"),
        ),
      }),
    ),
    userIds: v.any(),
    orgSlugToId: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    for (const deaccData of args.deaccessions) {
      const orgId = (args.orgSlugToId as any)[deaccData.orgSlug] as
        | Id<"organizations">
        | undefined;
      if (!orgId) continue;

      const collection = await ctx.db
        .query("collections")
        .withIndex("by_organization_and_accessionNumber", (q) =>
          q
            .eq("organizationId", orgId)
            .eq("accessionNumber", deaccData.collectionAccessionNumber),
        )
        .first();

      if (!collection) continue;

      const userId = (args.userIds as any)[deaccData.orgSlug] as
        | Id<"users">
        | undefined;
      if (!userId) continue;

      const org = await ctx.db.get(orgId);
      if (!org) continue;

      const year = new Date(deaccData.dateDeaccessioned).getFullYear();
      const orgSlug = org.slug.toUpperCase().substring(0, 3);

      // Count existing deaccessions for this org to generate unique number
      const existing = await ctx.db
        .query("deaccessions")
        .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
        .collect();

      const sequence = String(existing.length + 1).padStart(3, "0");
      const deaccessionNumber = `DA-${orgSlug}-${year}-${sequence}`;

      await ctx.db.insert("deaccessions", {
        organizationId: orgId,
        collectionId: collection._id,
        deaccessionNumber,
        dateDeaccessioned: deaccData.dateDeaccessioned,
        reason: deaccData.reason,
        method: deaccData.method,
        disposition: deaccData.disposition,
        status: deaccData.status,
        approvedBy: deaccData.status === "approved" ? userId : undefined,
        approvedAt: deaccData.status === "approved" ? Date.now() : undefined,
        workflowHistory:
          deaccData.status === "approved"
            ? [
                {
                  step: 1,
                  approvedBy: userId,
                  approvedAt: Date.now(),
                  comment: "Auto-approved in seed data",
                },
              ]
            : [],
      });

      // If approved, mark collection as deaccessioned
      if (deaccData.status === "approved") {
        await ctx.db.patch(collection._id, {
          status: "deaccessioned",
          lastModifiedBy: userId,
          lastModifiedAt: Date.now(),
        });
      }
    }

    return null;
  },
});

/**
 * Create audit log entries for activity tracking
 */
export const createAuditLogs = internalMutation({
  args: {
    userIds: v.any(),
    orgSlugToId: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userIdsMap = args.userIds as Record<string, Id<"users">>;
    const orgSlugToIdMap = args.orgSlugToId as Record<
      string,
      Id<"organizations">
    >;

    // Get some collections and loans to create audit entries for
    const organizations = await ctx.db.query("organizations").collect();

    for (const org of organizations) {
      const userId = userIdsMap[org.slug];
      if (!userId) continue;

      // Get collections for this org
      const collections = await ctx.db
        .query("collections")
        .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
        .take(5);

      // Get loans for this org
      const loans = await ctx.db
        .query("loans")
        .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
        .take(3);

      // Get accessions for this org
      const accessions = await ctx.db
        .query("accessions")
        .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
        .take(2);

      // Get deaccessions for this org
      const deaccessions = await ctx.db
        .query("deaccessions")
        .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
        .take(2);

      // Create audit entries for collections
      for (const collection of collections) {
        const timestamps = [
          Date.now() - 7 * 24 * 60 * 60 * 1000, // 7 days ago
          Date.now() - 3 * 24 * 60 * 60 * 1000, // 3 days ago
          Date.now() - 1 * 24 * 60 * 60 * 1000, // 1 day ago
        ];

        for (const timestamp of timestamps) {
          await ctx.db.insert("auditLog", {
            organizationId: org._id,
            userId,
            action: "updated",
            entityType: "collection",
            entityId: collection._id,
            changes: {
              field: Math.random() > 0.5 ? "description" : "condition",
              oldValue: "Previous value",
              newValue: "Updated value",
            },
            timestamp,
          });
        }

        // Create entry for creation
        await ctx.db.insert("auditLog", {
          organizationId: org._id,
          userId,
          action: "created",
          entityType: "collection",
          entityId: collection._id,
          timestamp: collection.catalogedAt,
        });
      }

      // Create audit entries for loans
      for (const loan of loans) {
        await ctx.db.insert("auditLog", {
          organizationId: org._id,
          userId,
          action: loan.status === "active" ? "approved" : "created",
          entityType: "loan",
          entityId: loan._id,
          changes: {
            status: loan.status,
          },
          timestamp: loan.startDate,
        });
      }

      // Create audit entries for accessions
      for (const accession of accessions) {
        await ctx.db.insert("auditLog", {
          organizationId: org._id,
          userId,
          action: accession.status === "approved" ? "approved" : "created",
          entityType: "accession",
          entityId: accession._id,
          changes: {
            status: accession.status,
            method: accession.method,
          },
          timestamp: accession.dateReceived,
        });
      }

      // Create audit entries for deaccessions
      for (const deaccession of deaccessions) {
        await ctx.db.insert("auditLog", {
          organizationId: org._id,
          userId,
          action: deaccession.status === "approved" ? "approved" : "created",
          entityType: "deaccession",
          entityId: deaccession._id,
          changes: {
            status: deaccession.status,
            method: deaccession.method,
          },
          timestamp: deaccession.dateDeaccessioned,
        });
      }
    }

    return null;
  },
});

/**
 * Create notifications for users
 */
export const createNotifications = internalMutation({
  args: {
    userIds: v.any(),
    orgSlugToId: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userIdsMap = args.userIds as Record<string, Id<"users">>;
    const orgSlugToIdMap = args.orgSlugToId as Record<
      string,
      Id<"organizations">
    >;

    // Get some loans, accessions, and deaccessions to create notifications for
    const organizations = await ctx.db.query("organizations").collect();

    for (const org of organizations) {
      const userId = userIdsMap[org.slug];
      if (!userId) continue;

      // Get pending loans
      const pendingLoans = await ctx.db
        .query("loans")
        .withIndex("by_organization_and_status", (q) =>
          q.eq("organizationId", org._id).eq("status", "pending"),
        )
        .take(2);

      // Get pending accessions
      const pendingAccessions = await ctx.db
        .query("accessions")
        .withIndex("by_organization_and_status", (q) =>
          q.eq("organizationId", org._id).eq("status", "pending"),
        )
        .take(2);

      // Get pending deaccessions
      const pendingDeaccessions = await ctx.db
        .query("deaccessions")
        .withIndex("by_organization_and_status", (q) =>
          q.eq("organizationId", org._id).eq("status", "pending"),
        )
        .take(2);

      // Create notifications for pending loans
      for (const loan of pendingLoans) {
        await ctx.db.insert("notifications", {
          organizationId: org._id,
          userId,
          type: "loan_pending_approval",
          title: "Loan Pending Approval",
          message: `Loan ${loan.loanNumber} is pending your approval`,
          read: false,
          relatedEntityType: "loan",
          relatedEntityId: loan._id,
          createdAt: loan.startDate,
        });
      }

      // Create notifications for pending accessions
      for (const accession of pendingAccessions) {
        await ctx.db.insert("notifications", {
          organizationId: org._id,
          userId,
          type: "accession_pending_approval",
          title: "Accession Pending Approval",
          message: `Accession ${accession.accessionNumber} requires your review`,
          read: false,
          relatedEntityType: "accession",
          relatedEntityId: accession._id,
          createdAt: accession.dateReceived,
        });
      }

      // Create notifications for pending deaccessions
      for (const deaccession of pendingDeaccessions) {
        await ctx.db.insert("notifications", {
          organizationId: org._id,
          userId,
          type: "deaccession_pending_approval",
          title: "Deaccession Pending Approval",
          message: `Deaccession ${deaccession.deaccessionNumber} requires your review`,
          read: false,
          relatedEntityType: "deaccession",
          relatedEntityId: deaccession._id,
          createdAt: deaccession.dateDeaccessioned,
        });
      }

      // Create some read notifications (older)
      const activeLoans = await ctx.db
        .query("loans")
        .withIndex("by_organization_and_status", (q) =>
          q.eq("organizationId", org._id).eq("status", "active"),
        )
        .take(1);

      for (const loan of activeLoans) {
        await ctx.db.insert("notifications", {
          organizationId: org._id,
          userId,
          type: "loan_approved",
          title: "Loan Approved",
          message: `Loan ${loan.loanNumber} has been approved and is now active`,
          read: true,
          relatedEntityType: "loan",
          relatedEntityId: loan._id,
          createdAt: loan.startDate - 2 * 24 * 60 * 60 * 1000, // 2 days before start
        });
      }
    }

    return null;
  },
});

/**
 * Create condition reports for loan items
 */
export const createConditionReports = internalMutation({
  args: {
    userIds: v.any(),
    orgSlugToId: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userIdsMap = args.userIds as Record<string, Id<"users">>;
    const orgSlugToIdMap = args.orgSlugToId as Record<
      string,
      Id<"organizations">
    >;

    // Get active loans with items - need to query by organization first
    const organizations = await ctx.db.query("organizations").collect();

    const loans: Array<{
      _id: Id<"loans">;
      organizationId: Id<"organizations">;
      startDate: number;
    }> = [];

    for (const org of organizations) {
      const orgLoans = await ctx.db
        .query("loans")
        .withIndex("by_organization_and_status", (q) =>
          q.eq("organizationId", org._id).eq("status", "active"),
        )
        .collect();
      loans.push(...orgLoans);
    }

    for (const loan of loans) {
      const org = await ctx.db.get(loan.organizationId);
      if (!org) continue;

      const userId = userIdsMap[org.slug];
      if (!userId) continue;

      // Get loan items
      const loanItems = await ctx.db
        .query("loanItems")
        .withIndex("by_loan", (q) => q.eq("loanId", loan._id))
        .take(2); // Create reports for first 2 items

      for (const loanItem of loanItems) {
        // Check if report already exists
        const existing = await ctx.db
          .query("conditionReports")
          .withIndex("by_loanItem", (q) => q.eq("loanItemId", loanItem._id))
          .first();

        if (existing) continue;

        // Create condition out report
        await ctx.db.insert("conditionReports", {
          loanItemId: loanItem._id,
          reportType: "out",
          conditionDescription:
            "Object in excellent condition. No visible damage or wear. All components intact.",
          damages: [
            {
              type: "None",
              location: "N/A",
              severity: "None",
              notes: "No damages observed",
            },
          ],
          assessedBy: userId,
          assessedAt: loan.startDate,
        });

        // Create condition in report (if loan is older)
        if (Date.now() - loan.startDate > 30 * 24 * 60 * 60 * 1000) {
          await ctx.db.insert("conditionReports", {
            loanItemId: loanItem._id,
            reportType: "in",
            conditionDescription:
              "Object returned in same condition as when loaned. No changes observed.",
            assessedBy: userId,
            assessedAt: loan.startDate + 20 * 24 * 60 * 60 * 1000, // 20 days after start
          });
        }
      }
    }

    return null;
  },
});
