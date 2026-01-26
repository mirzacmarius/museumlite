"use node";

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

export const test = action({
  args: {},
  returns: v.string(),
  handler: async () => {
    console.log("Test action running");
    return "success";
  },
});

export const testSeed = action({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    try {
      console.log("Starting testSeed...");
      await ctx.runAction(internal.seedMetAction.resetAndSeed, {});
      console.log("testSeed completed");
      return null;
    } catch (error) {
      console.error("testSeed error:", String(error));
      if (error instanceof Error) {
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
      }
      throw error;
    }
  },
});

/**
 * Seed only the missing entity types for existing organizations.
 */
export const seedMissingEntities = action({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    console.log("Starting seedMissingEntities...");
    
    // Get user
    const userId = await ctx.runQuery(internal.seedMet.findUserByEmail, {
      email: "mirzacmarius@gmail.com",
    });
    if (!userId) {
      console.error("User not found. Please log in first.");
      return null;
    }
    console.log("Found user");
    
    // Get all organizations
    const orgs = await ctx.runQuery(internal.testHelpers.getAllOrganizations, {});
    console.log(`Found ${orgs.length} organizations`);
    
    if (orgs.length === 0) {
      console.log("No organizations found. Run full seed first.");
      return null;
    }
    
    for (const org of orgs) {
      console.log(`\nProcessing ${org.name}...`);
      const orgType = org.type;
      
      console.log("  Seeding location assignments...");
      await ctx.runAction(internal.testAction.seedLocationAssignmentsForOrg, {
        orgId: org._id,
        userId,
      });
      
      console.log("  Seeding module details...");
      await ctx.runAction(internal.testAction.seedModuleDetailsForOrg, {
        orgId: org._id,
        userId,
        orgType,
      });
      
      console.log("  Seeding relationships and documents...");
      await ctx.runAction(internal.testAction.seedRelationshipsForOrg, {
        orgId: org._id,
        userId,
      });
      
      console.log("  Seeding admin data...");
      await ctx.runAction(internal.testAction.seedAdminDataForOrg, {
        orgId: org._id,
        userId,
      });
      
      if (orgType === "library") {
        console.log("  Seeding library extensions...");
        await ctx.runAction(internal.testAction.seedLibraryExtensionsForOrg, {
          orgId: org._id,
          userId,
        });
      }
      
      console.log(`  Done with ${org.name}`);
    }
    
    console.log("\nSeed missing entities completed!");
    return null;
  },
});

export const seedLocationAssignmentsForOrg = internalAction({
  args: {
    orgId: v.id("organizations"),
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, { orgId, userId }) => {
    const locations = await ctx.runQuery(internal.seedMet.getLocationsForOrg, {
      organizationId: orgId,
    });
    
    if (locations.length === 0) {
      console.log("    No locations found");
      return null;
    }
    
    const collections = await ctx.runQuery(internal.seedMet.getCollectionsWithoutLocation, {
      organizationId: orgId,
    });
    
    console.log(`    Found ${collections.length} collections without location`);
    
    for (const collection of collections) {
      const randomLocation = locations[Math.floor(Math.random() * locations.length)]!;
      await ctx.runMutation(internal.seedMet.updateCollectionLocation, {
        collectionId: collection._id,
        locationId: randomLocation._id,
      });
      
      await ctx.runMutation(internal.seedMet.createLocationHistory, {
        collectionId: collection._id,
        fromLocationId: undefined,
        toLocationId: randomLocation._id,
        movedBy: userId,
        movedAt: Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000),
        reason: "Initial cataloging",
      });
    }
    
    console.log(`    Assigned locations to ${collections.length} collections`);
    return null;
  },
});

export const seedModuleDetailsForOrg = internalAction({
  args: {
    orgId: v.id("organizations"),
    userId: v.id("users"),
    orgType: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { orgId, userId, orgType }) => {
    const collections = await ctx.runQuery(internal.seedMet.getCollections, {
      organizationId: orgId,
    });
    
    let moduleType: "wine" | "vehicle" | "naturalHistory" | "archive";
    if (orgType === "museum") moduleType = "naturalHistory";
    else if (orgType === "library") moduleType = "archive";
    else if (orgType === "collector") moduleType = Math.random() > 0.5 ? "wine" : "vehicle";
    else moduleType = "naturalHistory";
    
    let created = 0;
    for (const collection of collections.slice(0, 20)) {
      if (moduleType === "wine") {
        await ctx.runMutation(internal.seedMet.createWineDetails, {
          collectionId: collection._id,
          organizationId: orgId,
          vintage: 2010 + Math.floor(Math.random() * 14),
          producer: ["Chateau Margaux", "Opus One", "Screaming Eagle", "Penfolds"][Math.floor(Math.random() * 4)]!,
          varietal: ["Cabernet Sauvignon", "Pinot Noir", "Chardonnay", "Merlot"][Math.floor(Math.random() * 4)]!,
          region: ["Bordeaux", "Napa Valley", "Burgundy", "Barossa Valley"][Math.floor(Math.random() * 4)]!,
          quantity: Math.floor(Math.random() * 12) + 1,
          bottleSize: "750ml",
        });
      } else if (moduleType === "vehicle") {
        await ctx.runMutation(internal.seedMet.createVehicleDetails, {
          collectionId: collection._id,
          organizationId: orgId,
          make: ["Ferrari", "Porsche", "Aston Martin", "Lamborghini"][Math.floor(Math.random() * 4)]!,
          model: ["458 Italia", "911 Turbo", "DB11", "Huracan"][Math.floor(Math.random() * 4)]!,
          year: 1960 + Math.floor(Math.random() * 64),
          vin: `VIN${Math.random().toString(36).substring(2, 15).toUpperCase()}`,
          odometer: Math.floor(Math.random() * 100000),
        });
      } else if (moduleType === "naturalHistory") {
        await ctx.runMutation(internal.seedMet.createNaturalHistoryDetails, {
          collectionId: collection._id,
          organizationId: orgId,
          scientificName: "Specimen " + Math.floor(Math.random() * 1000),
          commonName: ["Fossil", "Mineral", "Specimen", "Artifact"][Math.floor(Math.random() * 4)]!,
          geologicalPeriod: ["Jurassic", "Cretaceous", "Triassic", "Permian"][Math.floor(Math.random() * 4)],
          collectorName: ["Dr. Smith", "Prof. Johnson", "Dr. Williams"][Math.floor(Math.random() * 3)]!,
        });
      } else {
        await ctx.runMutation(internal.seedMet.createArchiveDetails, {
          collectionId: collection._id,
          organizationId: orgId,
          documentType: ["manuscript", "photograph", "correspondence", "official_document"][Math.floor(Math.random() * 4)]!,
        });
      }
      created++;
    }
    
    console.log(`    Created ${created} ${moduleType} details`);
    return null;
  },
});

export const seedRelationshipsForOrg = internalAction({
  args: {
    orgId: v.id("organizations"),
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, { orgId, userId }) => {
    const accounts = await ctx.runQuery(internal.seedMet.getAccounts, {
      organizationId: orgId,
      accountType: "lender",
    });
    
    const collections = await ctx.runQuery(internal.seedMet.getCollections, {
      organizationId: orgId,
    });
    
    // Create account relationships (linking accounts to collections)
    let relCount = 0;
    for (let i = 0; i < Math.min(accounts.length, 5); i++) {
      const account = accounts[i]!;
      const collection = collections[i];
      if (collection) {
        await ctx.runMutation(internal.seedMet.createAccountRelationship, {
          organizationId: orgId,
          accountId: account._id,
          relatedEntityType: "item",
          relatedEntityId: collection._id,
          relationshipType: "donor",
          startDate: Date.now() - Math.floor(Math.random() * 365 * 24 * 60 * 60 * 1000),
          notes: "Seed data relationship",
          createdAt: Date.now(),
        });
        relCount++;
      }
    }
    console.log(`    Created ${relCount} account relationships`);
    
    let commentCount = 0;
    for (const collection of collections.slice(0, 15)) {
      await ctx.runMutation(internal.seedMet.createObjectComment, {
        organizationId: orgId,
        collectionId: collection._id,
        userId,
        content: ["Great condition", "Needs cleaning", "Provenance verified", "High value piece"][Math.floor(Math.random() * 4)]!,
      });
      commentCount++;
    }
    console.log(`    Created ${commentCount} object comments`);
    
    for (let i = 0; i < 5; i++) {
      await ctx.runMutation(internal.seedMet.createConservationAlertRule, {
        organizationId: orgId,
        name: ["Humidity Alert", "Temperature Alert", "Light Exposure Alert", "Pest Detection", "Damage Alert"][i]!,
        conditionTrigger: ["poor", "fair", "critical"][Math.floor(Math.random() * 3)]!,
        alertPriority: ["low", "medium", "high", "urgent"][Math.floor(Math.random() * 4)]!,
        isActive: true,
        createdBy: userId,
      });
    }
    console.log("    Created 5 conservation alert rules");
    
    return null;
  },
});

export const seedAdminDataForOrg = internalAction({
  args: {
    orgId: v.id("organizations"),
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, { orgId, userId }) => {
    for (let i = 0; i < 2; i++) {
      await ctx.runMutation(internal.seedMet.createApiKey, {
        organizationId: orgId,
        name: [`Production API Key ${i + 1}`, `Development API Key ${i + 1}`][i]!,
        createdBy: userId,
        permissions: ["read", "write"],
        expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
      });
    }
    console.log("    Created 2 API keys");
    
    const webhookEvents = ["collection.created", "loan.approved", "accession.completed"];
    for (let i = 0; i < 3; i++) {
      await ctx.runMutation(internal.seedMet.createWebhook, {
        organizationId: orgId,
        name: `Webhook ${i + 1}`,
        url: `https://example.com/webhook/${i + 1}`,
        events: [webhookEvents[i]!],
        isActive: true,
        createdBy: userId,
      });
    }
    console.log("    Created 3 webhooks");
    
    const reportTypes = ["collection_summary", "loan_status", "conservation_overview"];
    for (let i = 0; i < 3; i++) {
      await ctx.runMutation(internal.seedMet.createScheduledReport, {
        organizationId: orgId,
        name: `${reportTypes[i]!.replace(/_/g, " ")} Report`,
        reportType: reportTypes[i]!,
        schedule: "weekly",
        recipients: ["admin@example.com"],
        isActive: true,
        createdBy: userId,
      });
    }
    console.log("    Created 3 scheduled reports");
    
    await ctx.runMutation(internal.seedMet.createNotificationPreference, {
      userId,
      organizationId: orgId,
      emailNotifications: true,
      loanReminders: true,
      conservationAlerts: true,
      workflowUpdates: true,
    });
    console.log("    Created notification preferences");
    
    return null;
  },
});

export const seedLibraryExtensionsForOrg = internalAction({
  args: {
    orgId: v.id("organizations"),
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, { orgId, userId }) => {
    for (let i = 0; i < 3; i++) {
      await ctx.runMutation(internal.seedMet.createLibraryVendor, {
        organizationId: orgId,
        name: [`Baker & Taylor`, `Ingram`, `EBSCO`][i]!,
        contactName: [`John Smith`, `Jane Doe`, `Bob Wilson`][i]!,
        contactEmail: [`john@baker.com`, `jane@ingram.com`, `bob@ebsco.com`][i]!,
        accountNumber: `ACCT-${1000 + i}`,
        isActive: true,
        createdBy: userId,
      });
    }
    console.log("    Created 3 library vendors");
    
    const libraryItems = await ctx.runQuery(internal.seedMet.getLibraryItems, {
      organizationId: orgId,
    });
    
    for (let i = 0; i < Math.min(5, Math.max(1, libraryItems.length)); i++) {
      await ctx.runMutation(internal.seedMet.createLibraryAcquisitionRequest, {
        organizationId: orgId,
        title: `Acquisition Request ${i + 1}`,
        requestedBy: userId,
        status: ["pending", "approved", "ordered"][Math.floor(Math.random() * 3)]!,
        priority: ["low", "medium", "high"][Math.floor(Math.random() * 3)]!,
        estimatedCost: Math.floor(Math.random() * 500) + 50,
      });
    }
    console.log("    Created acquisition requests");
    
    for (let i = 0; i < 2; i++) {
      const subId = await ctx.runMutation(internal.seedMet.createSerialSubscription, {
        organizationId: orgId,
        title: [`Nature`, `Science`][i]!,
        issn: [`0028-0836`, `0036-8075`][i]!,
        publisher: [`Springer Nature`, `AAAS`][i]!,
        frequency: "weekly",
        isActive: true,
        startDate: Date.now() - 365 * 24 * 60 * 60 * 1000,
        createdBy: userId,
      });
      
      for (let j = 0; j < 3; j++) {
        await ctx.runMutation(internal.seedMet.createSerialIssue, {
          subscriptionId: subId,
          issueNumber: `Vol. ${i + 1}, Issue ${j + 1}`,
          publicationDate: Date.now() - (j * 7 * 24 * 60 * 60 * 1000),
          receivedDate: Date.now() - ((j * 7 - 2) * 24 * 60 * 60 * 1000),
          status: "received",
        });
      }
    }
    console.log("    Created 2 serial subscriptions with issues");
    
    return null;
  },
});

/**
 * Create minimal foundation data without Met API calls.
 * Creates orgs, locations, accounts, and placeholder collections.
 */
export const seedMinimalFoundation = action({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    console.log("Starting minimal foundation seed...");
    
    // Get user
    const userId = await ctx.runQuery(internal.seedMet.findUserByEmail, {
      email: "mirzacmarius@gmail.com",
    });
    if (!userId) {
      console.error("User not found. Please log in first.");
      return null;
    }
    console.log("Found user");
    
    // Clear existing data
    console.log("Clearing existing data...");
    const tablesToClear = [
      "auditLog", "notifications", "organizations", "userOrganizations",
      "roles", "rolePermissions", "locations", "collections", "accounts",
      "contacts", "accountSegments", "collectionGroups", "mediaFiles",
      "fineArtDetails", "wineDetails", "vehicleDetails", "naturalHistoryDetails",
      "archiveDetails", "locationHistory", "conditionOptions", "materialOptions",
      "typeOptions", "donors", "workflowTemplates", "workflowConfigs",
      "workflowSlaConfigs", "loans", "loanItems", "accessions", "deaccessions",
      "exhibitions", "conservationTreatments", "transitRecords", "libraryItems",
      "itemCopies", "circulations", "appraisals", "insurancePolicies",
    ];
    
    for (const tableName of tablesToClear) {
      let batchDeleted: number;
      do {
        batchDeleted = await ctx.runMutation(internal.seedMet.clearTableBatch, {
          tableName,
          batchSize: 500,
        });
      } while (batchDeleted === 500);
    }
    console.log("Cleared existing data");
    
    // Organizations data
    const ORGANIZATIONS = [
      { name: "National Museum of Natural History", slug: "natural-history-museum", type: "museum" as const, subscriptionTier: "enterprise" as const, prefix: "NMNH" },
      { name: "Metropolitan Art Gallery", slug: "metropolitan-art-gallery", type: "gallery" as const, subscriptionTier: "pro" as const, prefix: "MAG" },
      { name: "Heritage Library & Archives", slug: "heritage-library", type: "library" as const, subscriptionTier: "pro" as const, prefix: "HLA" },
      { name: "Contemporary Design Museum", slug: "contemporary-design", type: "museum" as const, subscriptionTier: "enterprise" as const, prefix: "CDM" },
      { name: "Vanderbilt Private Collection", slug: "vanderbilt-collection", type: "collector" as const, subscriptionTier: "free" as const, prefix: "VPC" },
    ];
    
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
      
      // Create locations
      console.log("  Creating locations...");
      const buildings = ["Main Building", "West Wing", "East Annex"];
      const floors = ["Ground Floor", "First Floor", "Second Floor"];
      const rooms = ["Gallery A", "Gallery B", "Storage Room 1", "Archive Room"];
      
      for (const building of buildings) {
        const buildingId = await ctx.runMutation(internal.seedMet.createLocation, {
          organizationId: orgId,
          name: building,
          type: "building",
          sortOrder: 0,
        });
        
        for (const floor of floors) {
          const floorId = await ctx.runMutation(internal.seedMet.createLocation, {
            organizationId: orgId,
            name: floor,
            type: "floor",
            parentLocationId: buildingId,
            sortOrder: 0,
          });
          
          for (const room of rooms) {
            await ctx.runMutation(internal.seedMet.createLocation, {
              organizationId: orgId,
              name: room,
              type: "room",
              parentLocationId: floorId,
              sortOrder: 0,
            });
          }
        }
      }
      
      // Create placeholder collections (no images)
      console.log("  Creating collections...");
      for (let i = 0; i < 50; i++) {
        await ctx.runMutation(internal.seedMet.createCollection, {
          organizationId: orgId,
          userId,
          accessionNumber: `${org.prefix}-${String(i + 1).padStart(4, "0")}`,
          title: `Sample Object ${i + 1}`,
          objectType: ["Painting", "Sculpture", "Artifact", "Document", "Photograph"][i % 5]!,
          objectName: `Object ${i + 1}`,
          culture: ["American", "European", "Asian", "African", "Oceanic"][i % 5],
          period: ["Modern", "Contemporary", "Classical", "Medieval", "Ancient"][i % 5],
          dateCreated: `${1800 + (i * 4)}`,
          materials: ["Oil on canvas", "Bronze", "Wood", "Paper", "Stone"][i % 5],
          dimensions: `${20 + i}cm x ${30 + i}cm`,
          creditLine: "Gift of Anonymous Donor",
        });
      }
      
      // Create accounts (lenders and borrowers)
      console.log("  Creating accounts...");
      const lenders = [
        { businessName: "Smithsonian Institution", city: "Washington DC" },
        { businessName: "British Museum", city: "London" },
        { businessName: "Louvre Museum", city: "Paris" },
      ];
      
      for (let i = 0; i < lenders.length; i++) {
        const accountId = await ctx.runMutation(internal.seedMet.createAccount, {
          organizationId: orgId,
          userId,
          accountNumber: `LEND-${String(i + 1).padStart(4, "0")}`,
          accountType: "lender",
          businessName: lenders[i]!.businessName,
          contactPerson: `Contact Person ${i + 1}`,
          contactEmail: `contact${i + 1}@example.com`,
          contactPhone: "+1-555-0100",
          city: lenders[i]!.city,
          country: "USA",
          status: "active",
        });
        
        await ctx.runMutation(internal.seedMet.createContact, {
          organizationId: orgId,
          accountId,
          firstName: "John",
          lastName: `Doe${i + 1}`,
          title: "Director",
          role: "primary",
          email: `john.doe${i + 1}@example.com`,
          isPrimary: true,
        });
      }
      
      const borrowers = [
        { businessName: "MoMA", city: "New York" },
        { businessName: "Getty Museum", city: "Los Angeles" },
      ];
      
      for (let i = 0; i < borrowers.length; i++) {
        await ctx.runMutation(internal.seedMet.createAccount, {
          organizationId: orgId,
          userId,
          accountNumber: `BORR-${String(i + 1).padStart(4, "0")}`,
          accountType: "borrower",
          businessName: borrowers[i]!.businessName,
          contactPerson: `Borrower Contact ${i + 1}`,
          contactEmail: `borrower${i + 1}@example.com`,
          contactPhone: "+1-555-0200",
          city: borrowers[i]!.city,
          country: "USA",
          status: "active",
        });
      }
      
      // Create condition/material/type options
      console.log("  Creating options...");
      for (const cond of ["Excellent", "Good", "Fair", "Poor"]) {
        await ctx.runMutation(internal.seedMet.createConditionOption, {
          organizationId: orgId,
          userId,
          name: cond,
          description: `${cond} condition`,
        });
      }
      
      for (const mat of ["Oil", "Acrylic", "Watercolor", "Bronze", "Marble"]) {
        await ctx.runMutation(internal.seedMet.createMaterialOption, {
          organizationId: orgId,
          userId,
          name: mat,
        });
      }
      
      for (const typ of ["Painting", "Sculpture", "Drawing", "Print", "Photograph"]) {
        await ctx.runMutation(internal.seedMet.createTypeOption, {
          organizationId: orgId,
          userId,
          name: typ,
        });
      }
      
      console.log(`  Done with ${org.name}`);
    }
    
    console.log("\nMinimal foundation seed completed!");
    return null;
  },
});
