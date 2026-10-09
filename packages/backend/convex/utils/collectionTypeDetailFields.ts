import { type Infer, v } from "convex/values";

/**
 * Field contracts for the type-specific detail tables. The schema, each
 * module's `upsert`/`get`, and the accession draft all build from these maps,
 * so a value accepted at intake is exactly a value the detail table accepts.
 */

export const provenanceChainEntryValidator = v.object({
  eventType: v.union(
    v.literal("sale"),
    v.literal("auction"),
    v.literal("inheritance"),
    v.literal("gift"),
    v.literal("commission"),
    v.literal("acquisition"),
    v.literal("other"),
  ),
  owner: v.string(),
  startYear: v.optional(v.string()),
  endYear: v.optional(v.string()),
  location: v.optional(v.string()),
  salePrice: v.optional(v.number()),
  currency: v.optional(v.string()),
  auctionHouse: v.optional(v.string()),
  documentIds: v.optional(v.array(v.id("_storage"))),
  notes: v.optional(v.string()),
  verified: v.optional(v.boolean()),
});

export const shippingLogEntryValidator = v.object({
  fromLocation: v.string(),
  toLocation: v.string(),
  carrier: v.optional(v.string()),
  trackingNumber: v.optional(v.string()),
  departedAt: v.optional(v.number()),
  arrivedAt: v.optional(v.number()),
  conditionBefore: v.optional(v.string()),
  conditionAfter: v.optional(v.string()),
  notes: v.optional(v.string()),
});

export const fineArtDisplayStatusValidator = v.union(
  v.literal("on_display"),
  v.literal("in_storage"),
  v.literal("loaned_out"),
  v.literal("in_transit"),
  v.literal("conservation"),
);

export const fineArtIntakeDetailFields = {
  appraisedValue: v.optional(v.number()),
  replacementValue: v.optional(v.number()),
  insurancePolicyNumber: v.optional(v.string()),
  insuranceCarrier: v.optional(v.string()),
  insuranceExpiresAt: v.optional(v.number()),
  reappraisalDate: v.optional(v.number()),
  lastAppraisalDate: v.optional(v.number()),
  appraiser: v.optional(v.string()),
  displayStatus: v.optional(fineArtDisplayStatusValidator),
};

export const fineArtDetailFields = {
  ...fineArtIntakeDetailFields,
  provenanceChain: v.optional(v.array(provenanceChainEntryValidator)),
  shippingLogs: v.optional(v.array(shippingLogEntryValidator)),
};

export const wineFillLevelValidator = v.union(
  v.literal("into_neck"),
  v.literal("top_shoulder"),
  v.literal("high_shoulder"),
  v.literal("mid_shoulder"),
  v.literal("low_shoulder"),
  v.literal("below_shoulder"),
);

export const wineClosureTypeValidator = v.union(
  v.literal("cork"),
  v.literal("screwcap"),
  v.literal("synthetic"),
  v.literal("glass"),
  v.literal("crown"),
);

export const wineDetailFields = {
  vintage: v.optional(v.number()),
  peakWindowStart: v.optional(v.number()),
  peakWindowEnd: v.optional(v.number()),
  binNumber: v.optional(v.string()),
  rackNumber: v.optional(v.string()),
  rowNumber: v.optional(v.string()),
  bottleSize: v.optional(v.string()),
  quantity: v.optional(v.number()),
  fillLevel: v.optional(wineFillLevelValidator),
  closureType: v.optional(wineClosureTypeValidator),
  labelCondition: v.optional(v.string()),
  capsuleCondition: v.optional(v.string()),
  producer: v.optional(v.string()),
  region: v.optional(v.string()),
  appellation: v.optional(v.string()),
  varietal: v.optional(v.string()),
  alcoholContent: v.optional(v.number()),
  purchasePrice: v.optional(v.number()),
  currentValue: v.optional(v.number()),
  drinkingNotes: v.optional(v.string()),
};

export const wineIntakeDetailFields = wineDetailFields;

export const vehicleOdometerUnitValidator = v.union(
  v.literal("miles"),
  v.literal("km"),
);

export const vehicleServiceLogEntryValidator = v.object({
  serviceDate: v.number(),
  serviceType: v.string(),
  description: v.string(),
  mileage: v.optional(v.number()),
  provider: v.optional(v.string()),
  cost: v.optional(v.number()),
  documentIds: v.optional(v.array(v.id("_storage"))),
});

export const vehiclePartsLifingEntryValidator = v.object({
  partName: v.string(),
  installDate: v.optional(v.number()),
  installMileage: v.optional(v.number()),
  expectedLifeMiles: v.optional(v.number()),
  notes: v.optional(v.string()),
});

export const vehicleEventHistoryEntryValidator = v.object({
  eventDate: v.number(),
  eventType: v.union(
    v.literal("concours"),
    v.literal("show"),
    v.literal("race"),
    v.literal("rally"),
    v.literal("auction"),
    v.literal("other"),
  ),
  eventName: v.string(),
  location: v.optional(v.string()),
  result: v.optional(v.string()),
  awards: v.optional(v.array(v.string())),
  notes: v.optional(v.string()),
});

export const vehicleIntakeDetailFields = {
  vin: v.optional(v.string()),
  make: v.optional(v.string()),
  model: v.optional(v.string()),
  year: v.optional(v.number()),
  bodyStyle: v.optional(v.string()),
  engineNumber: v.optional(v.string()),
  transmissionType: v.optional(v.string()),
  exteriorColor: v.optional(v.string()),
  interiorColor: v.optional(v.string()),
  odometer: v.optional(v.number()),
  odometerUnit: v.optional(vehicleOdometerUnitValidator),
  fuelType: v.optional(v.string()),
  registrationNumber: v.optional(v.string()),
  registrationState: v.optional(v.string()),
  titleNumber: v.optional(v.string()),
  insuranceValue: v.optional(v.number()),
};

export const vehicleDetailFields = {
  ...vehicleIntakeDetailFields,
  serviceLog: v.optional(v.array(vehicleServiceLogEntryValidator)),
  partsLifing: v.optional(v.array(vehiclePartsLifingEntryValidator)),
  eventHistory: v.optional(v.array(vehicleEventHistoryEntryValidator)),
};

export const naturalHistoryPreservationMethodValidator = v.union(
  v.literal("dry"),
  v.literal("wet"),
  v.literal("frozen"),
  v.literal("pinned"),
  v.literal("pressed"),
  v.literal("mounted"),
  v.literal("cast"),
  v.literal("fossil"),
  v.literal("other"),
);

export const naturalHistorySexValidator = v.union(
  v.literal("male"),
  v.literal("female"),
  v.literal("unknown"),
);

export const naturalHistoryDetailFields = {
  kingdom: v.optional(v.string()),
  phylum: v.optional(v.string()),
  taxonomyClass: v.optional(v.string()),
  order: v.optional(v.string()),
  family: v.optional(v.string()),
  genus: v.optional(v.string()),
  species: v.optional(v.string()),
  subspecies: v.optional(v.string()),
  commonName: v.optional(v.string()),
  scientificName: v.optional(v.string()),
  collectionDate: v.optional(v.number()),
  collectorName: v.optional(v.string()),
  collectionMethod: v.optional(v.string()),
  latitude: v.optional(v.number()),
  longitude: v.optional(v.number()),
  altitude: v.optional(v.number()),
  locality: v.optional(v.string()),
  habitat: v.optional(v.string()),
  geologicalPeriod: v.optional(v.string()),
  formation: v.optional(v.string()),
  preservationMethod: v.optional(naturalHistoryPreservationMethodValidator),
  storageMedium: v.optional(v.string()),
  containerType: v.optional(v.string()),
  sex: v.optional(naturalHistorySexValidator),
  lifeStage: v.optional(v.string()),
  specimenType: v.optional(v.string()),
  dnaAvailable: v.optional(v.boolean()),
  tissueAvailable: v.optional(v.boolean()),
};

export const naturalHistoryIntakeDetailFields = naturalHistoryDetailFields;

export const archiveConfidentialityLevelValidator = v.union(
  v.literal("public"),
  v.literal("internal"),
  v.literal("confidential"),
  v.literal("restricted"),
  v.literal("top_secret"),
);

export const archiveIntakeDetailFields = {
  documentType: v.optional(v.string()),
  retentionCategory: v.optional(v.string()),
  retentionYears: v.optional(v.number()),
  retentionStartDate: v.optional(v.number()),
  retentionExpiresAt: v.optional(v.number()),
  confidentialityLevel: v.optional(archiveConfidentialityLevelValidator),
  accessRestrictions: v.optional(v.array(v.string())),
  originatingDepartment: v.optional(v.string()),
  recordSeries: v.optional(v.string()),
  boxNumber: v.optional(v.string()),
  folderNumber: v.optional(v.string()),
  digitalAssetUrl: v.optional(v.string()),
  fileFormat: v.optional(v.string()),
  pageCount: v.optional(v.number()),
  ocrProcessed: v.optional(v.boolean()),
  keywords: v.optional(v.array(v.string())),
};

export const archiveDetailFields = {
  ...archiveIntakeDetailFields,
  fileSize: v.optional(v.number()),
  flaggedForDestruction: v.optional(v.boolean()),
  destructionDate: v.optional(v.number()),
  destructionMethod: v.optional(v.string()),
  destructionWitnessedBy: v.optional(v.string()),
  legalHold: v.optional(v.boolean()),
  legalHoldReason: v.optional(v.string()),
  digitalAssetStorageId: v.optional(v.id("_storage")),
};

export const coinsStampsItemCategoryValidator = v.union(
  v.literal("coin"),
  v.literal("stamp"),
);

export const coinsStampsRarityValidator = v.union(
  v.literal("common"),
  v.literal("scarce"),
  v.literal("rare"),
  v.literal("very_rare"),
  v.literal("unique"),
);

export const coinsStampsDetailFields = {
  itemCategory: v.optional(coinsStampsItemCategoryValidator),
  issuingAuthority: v.optional(v.string()),
  countryOrRegion: v.optional(v.string()),
  denomination: v.optional(v.string()),
  currency: v.optional(v.string()),
  issueYear: v.optional(v.number()),
  issuePeriod: v.optional(v.string()),
  mintOrPrinter: v.optional(v.string()),
  series: v.optional(v.string()),
  catalogNumber: v.optional(v.string()),
  grade: v.optional(v.string()),
  certificationNumber: v.optional(v.string()),
  certifyingAuthority: v.optional(v.string()),
  conditionNotes: v.optional(v.string()),
  composition: v.optional(v.string()),
  diameterMm: v.optional(v.number()),
  weightGrams: v.optional(v.number()),
  perforation: v.optional(v.string()),
  watermark: v.optional(v.string()),
  color: v.optional(v.string()),
  rarity: v.optional(coinsStampsRarityValidator),
  acquisitionPrice: v.optional(v.number()),
  estimatedValue: v.optional(v.number()),
  storageLocation: v.optional(v.string()),
  notes: v.optional(v.string()),
};

export const coinsStampsIntakeDetailFields = coinsStampsDetailFields;

/**
 * Details staff can capture on an accession draft, one collection type at a
 * time. Running logs (fine-art provenance chain and shipping, vehicle service,
 * parts and events), archive legal hold and destruction, and stored file
 * references and sizes are recorded on the published object through their own
 * mutations, so they are not part of intake.
 */
export const objectDraftTypeDetailsValidator = v.union(
  v.object({
    collectionType: v.literal("fine_art"),
    fields: v.object(fineArtIntakeDetailFields),
  }),
  v.object({
    collectionType: v.literal("wine"),
    fields: v.object(wineIntakeDetailFields),
  }),
  v.object({
    collectionType: v.literal("automotive"),
    fields: v.object(vehicleIntakeDetailFields),
  }),
  v.object({
    collectionType: v.literal("natural_history"),
    fields: v.object(naturalHistoryIntakeDetailFields),
  }),
  v.object({
    collectionType: v.literal("archive"),
    fields: v.object(archiveIntakeDetailFields),
  }),
  v.object({
    collectionType: v.literal("coins_stamps"),
    fields: v.object(coinsStampsIntakeDetailFields),
  }),
);

export type ObjectDraftTypeDetails = Infer<
  typeof objectDraftTypeDetailsValidator
>;

/** Fields every type-specific detail record carries besides its details. */
export const typeDetailRecordFields = {
  collectionId: v.id("collections"),
  organizationId: v.id("organizations"),
  createdAt: v.number(),
  lastModifiedAt: v.optional(v.number()),
};

export type ObjectDraftTypeDetailFields<
  T extends ObjectDraftTypeDetails["collectionType"],
> = Extract<ObjectDraftTypeDetails, { collectionType: T }>["fields"];
