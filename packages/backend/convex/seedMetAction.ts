import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";
import { internalAction } from "./_generated/server";

/**
 * Internal action wrapper to run the seed from CLI.
 * Usage: bunx convex run seedMetAction:runSeed
 */
export const runSeed = internalAction({
  args: {},
  returns: v.union(v.null(), v.string()),
  handler: async (ctx) => {
    console.log("[runSeed] Starting seed...");
    try {
      console.log("[runSeed] Calling resetAndSeed...");
      await ctx.runAction(internal.seedMetAction.resetAndSeed, {});
      console.log("[runSeed] resetAndSeed completed successfully");
      return null;
    } catch (error) {
      console.log("[runSeed] Caught error, processing...");
      const errorMessage =
        error instanceof Error
          ? `${error.name}: ${error.message}`
          : String(error);
      console.error("[runSeed] Seed failed:", errorMessage);
      console.log("[runSeed] Returning error message");
      return errorMessage;
    }
  },
});

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

const deepLocationOrganizationSummaryValidator = v.object({
  organizationId: v.id("organizations"),
  organizationName: v.string(),
  targetLocationCount: v.number(),
  objectCount: v.number(),
  reassigned: v.number(),
  unchanged: v.number(),
  skippedNoCapacity: v.number(),
  skippedNoEligibleLocation: v.number(),
});

const deepLocationReassignmentSummaryValidator = v.object({
  userId: v.id("users"),
  organizationCount: v.number(),
  organizationsProcessed: v.number(),
  objectsConsidered: v.number(),
  objectsReassigned: v.number(),
  objectsUnchanged: v.number(),
  objectsSkippedNoEligibleLocation: v.number(),
  objectsSkippedNoCapacity: v.number(),
  organizationsSkippedNoLocations: v.number(),
  organizations: v.array(deepLocationOrganizationSummaryValidator),
});

type UserOrganizationContext = {
  userId: Id<"users">;
  organizationIds: Array<Id<"organizations">>;
};

type DeepLocationOrganizationSummary = {
  organizationId: Id<"organizations">;
  organizationName: string;
  targetLocationCount: number;
  objectCount: number;
  reassigned: number;
  unchanged: number;
  skippedNoCapacity: number;
  skippedNoEligibleLocation: number;
};

type DeepLocationReassignmentSummary = {
  userId: Id<"users">;
  organizationCount: number;
  organizationsProcessed: number;
  objectsConsidered: number;
  objectsReassigned: number;
  objectsUnchanged: number;
  objectsSkippedNoEligibleLocation: number;
  objectsSkippedNoCapacity: number;
  organizationsSkippedNoLocations: number;
  organizations: DeepLocationOrganizationSummary[];
};

export const runDeepLocationReassignmentForMirza = internalAction({
  args: {},
  returns: deepLocationReassignmentSummaryValidator,
  handler: async (ctx): Promise<DeepLocationReassignmentSummary> => {
    const userContext: UserOrganizationContext | null = await ctx.runQuery(
      internal.seedMet.getUserOrganizationsByEmail,
      {
        email: SEED_USER_EMAIL,
      },
    );

    if (!userContext) {
      throw new Error("Seed user not found. Please log in first.");
    }

    const result: DeepLocationReassignmentSummary = await ctx.runMutation(
      internal.seedMet.reassignObjectsToDeepLocationsForUser,
      userContext,
    );

    console.log(
      `Deep location reassignment complete: ${result.objectsReassigned} reassigned, ${result.objectsUnchanged} unchanged, ${result.objectsSkippedNoCapacity} skipped for capacity, ${result.objectsSkippedNoEligibleLocation} skipped for missing deep locations`,
    );

    return result;
  },
});

const BUILDINGS = [
  "Main Building",
  "East Wing",
  "West Wing",
  "Storage Facility",
  "Conservation Center",
];

const FLOORS = [
  "Ground Floor",
  "First Floor",
  "Second Floor",
  "Third Floor",
  "Basement",
];

const ROOMS = [
  "Gallery A",
  "Gallery B",
  "Gallery C",
  "Study Room",
  "Reading Room",
  "Storage Room A-1",
  "Storage Room A-2",
  "Conservation Lab",
  "Egyptian Gallery",
  "Greek Gallery",
  "Roman Gallery",
  "Medieval Hall",
];

const CABINETS = [
  "Cabinet A-1",
  "Cabinet A-2",
  "Cabinet B-1",
  "Cabinet B-2",
  "Shelf Unit 1",
  "Shelf Unit 2",
  "Shelf Unit 3",
  "Display Case 1",
  "Display Case 2",
  "Archive Box 1",
];

const CONDITION_OPTIONS = [
  {
    name: "Excellent",
    description:
      "Object is in perfect condition with no visible damage or deterioration",
  },
  {
    name: "Very Good",
    description: "Minor wear consistent with age, no significant damage",
  },
  {
    name: "Good",
    description: "Some visible wear or minor damage, stable condition",
  },
  {
    name: "Fair",
    description: "Moderate wear or damage present, may need conservation",
  },
  {
    name: "Poor",
    description:
      "Significant damage or deterioration, requires conservation attention",
  },
  {
    name: "Critical",
    description: "Severe damage requiring immediate conservation intervention",
  },
];

const MATERIAL_OPTIONS = [
  "Oil on canvas",
  "Bronze",
  "Marble",
  "Wood",
  "Paper",
  "Watercolor on paper",
  "Terracotta",
  "Ivory",
  "Gold",
  "Silver",
  "Ceramic",
  "Glass",
  "Textile",
  "Photograph",
  "Limestone",
  "Granite",
  "Iron",
  "Steel",
  "Aluminum",
  "Plaster",
  "Clay",
  "Bone",
  "Leather",
  "Silk",
  "Cotton",
  "Wool",
  "Porcelain",
  "Enamel",
  "Lacquer",
  "Jade",
];

const TYPE_OPTIONS = [
  "Painting",
  "Sculpture",
  "Drawing",
  "Photograph",
  "Print",
  "Textile",
  "Ceramic",
  "Furniture",
  "Jewelry",
  "Manuscript",
  "Book",
  "Coin",
  "Medal",
  "Armor",
  "Weapon",
  "Musical Instrument",
  "Scientific Instrument",
  "Decorative Art",
  "Vessel",
  "Mask",
  "Figurine",
  "Relief",
  "Mosaic",
  "Fresco",
  "Icon",
];

const DONOR_DATA = [
  { name: "The Morgan Foundation", email: "donations@morganfoundation.org" },
  { name: "Elizabeth Worthington", email: "e.worthington@gmail.com" },
  { name: "The Vanderbilt Trust", email: "trust@vanderbilt.org" },
  { name: "Robert J. Smithson III", email: "rjsmithson@smithsonholdings.com" },
  { name: "The Carnegie Endowment", email: "gifts@carnegieendowment.org" },
  { name: "Margaret Chen", email: "m.chen@chenenterprises.com" },
  { name: "The Rockefeller Foundation", email: "donations@rockefellerfdn.org" },
  { name: "William H. Taft Memorial Fund", email: "taftfund@memorial.org" },
  { name: "Sarah Blackwell Estate", email: "estate@blackwellfamily.org" },
  { name: "The Getty Trust", email: "acquisitions@getty.edu" },
  { name: "James Morrison", email: "jmorrison@morrisonart.com" },
  { name: "The Mellon Foundation", email: "grants@mellon.org" },
  { name: "Catherine DuPont", email: "c.dupont@dupontfamily.com" },
  { name: "The Ford Foundation", email: "culture@fordfoundation.org" },
  { name: "Alexander Hamilton Society", email: "donations@hamiltonarts.org" },
  { name: "Patricia Hearst Collection", email: "collection@hearstfamily.org" },
  { name: "The Astor Foundation", email: "gifts@astorfoundation.org" },
  { name: "Michael Bloomberg Arts Fund", email: "artsfund@bloomberg.org" },
  { name: "The Whitney Family Trust", email: "trust@whitneyfamily.org" },
  { name: "Anonymous Benefactor", email: "anonymous@privatefoundation.org" },
];

const LENDER_ACCOUNTS = [
  {
    businessName: "Smithsonian Institution",
    contactPerson: "Dr. Sarah Mitchell",
    contactEmail: "s.mitchell@si.edu",
    contactPhone: "+1-202-633-1000",
    address: "1000 Jefferson Drive SW",
    city: "Washington DC",
    country: "USA",
  },
  {
    businessName: "British Museum",
    contactPerson: "James Harrison",
    contactEmail: "j.harrison@britishmuseum.org",
    contactPhone: "+44-20-7323-8000",
    address: "Great Russell Street",
    city: "London",
    country: "UK",
  },
  {
    businessName: "Louvre Museum",
    contactPerson: "Marie Dubois",
    contactEmail: "m.dubois@louvre.fr",
    contactPhone: "+33-1-40-20-50-50",
    address: "Rue de Rivoli",
    city: "Paris",
    country: "France",
  },
  {
    businessName: "Rijksmuseum",
    contactPerson: "Hans van der Berg",
    contactEmail: "h.vanderberg@rijksmuseum.nl",
    contactPhone: "+31-20-674-7000",
    address: "Museumstraat 1",
    city: "Amsterdam",
    country: "Netherlands",
  },
  {
    businessName: "Prado Museum",
    contactPerson: "Carlos Rodriguez",
    contactEmail: "c.rodriguez@museodelprado.es",
    contactPhone: "+34-91-330-2800",
    address: "Calle Ruiz de Alarcón 23",
    city: "Madrid",
    country: "Spain",
  },
  {
    businessName: "Getty Museum",
    contactPerson: "Michael Thompson",
    contactEmail: "m.thompson@getty.edu",
    contactPhone: "+1-310-440-7300",
    address: "1200 Getty Center Drive",
    city: "Los Angeles",
    country: "USA",
  },
  {
    businessName: "Victoria and Albert Museum",
    contactPerson: "Elizabeth Clarke",
    contactEmail: "e.clarke@vam.ac.uk",
    contactPhone: "+44-20-7942-2000",
    address: "Cromwell Road",
    city: "London",
    country: "UK",
  },
  {
    businessName: "National Gallery of Art",
    contactPerson: "Robert Wilson",
    contactEmail: "r.wilson@nga.gov",
    contactPhone: "+1-202-737-4215",
    address: "Constitution Ave NW",
    city: "Washington DC",
    country: "USA",
  },
  {
    businessName: "Art Institute of Chicago",
    contactPerson: "Jennifer Adams",
    contactEmail: "j.adams@artic.edu",
    contactPhone: "+1-312-443-3600",
    address: "111 S Michigan Ave",
    city: "Chicago",
    country: "USA",
  },
  {
    businessName: "Museum of Fine Arts Boston",
    contactPerson: "David Chen",
    contactEmail: "d.chen@mfa.org",
    contactPhone: "+1-617-267-9300",
    address: "465 Huntington Ave",
    city: "Boston",
    country: "USA",
  },
  {
    businessName: "Tate Modern",
    contactPerson: "Sophie Williams",
    contactEmail: "s.williams@tate.org.uk",
    contactPhone: "+44-20-7887-8888",
    address: "Bankside",
    city: "London",
    country: "UK",
  },
  {
    businessName: "Uffizi Gallery",
    contactPerson: "Marco Rossi",
    contactEmail: "m.rossi@uffizi.it",
    contactPhone: "+39-055-238-8651",
    address: "Piazzale degli Uffizi 6",
    city: "Florence",
    country: "Italy",
  },
  {
    businessName: "Hermitage Museum",
    contactPerson: "Natasha Petrova",
    contactEmail: "n.petrova@hermitage.ru",
    contactPhone: "+7-812-710-9079",
    address: "Palace Square 2",
    city: "St. Petersburg",
    country: "Russia",
  },
  {
    businessName: "National Museum of Korea",
    contactPerson: "Kim Ji-yeon",
    contactEmail: "k.jiyeon@museum.go.kr",
    contactPhone: "+82-2-2077-9000",
    address: "137 Seobinggo-ro",
    city: "Seoul",
    country: "South Korea",
  },
  {
    businessName: "Tokyo National Museum",
    contactPerson: "Takeshi Yamamoto",
    contactEmail: "t.yamamoto@tnm.jp",
    contactPhone: "+81-3-3822-1111",
    address: "13-9 Ueno Park",
    city: "Tokyo",
    country: "Japan",
  },
];

const BORROWER_ACCOUNTS = [
  {
    businessName: "Yale University Art Gallery",
    contactPerson: "Prof. Amanda Foster",
    contactEmail: "a.foster@yale.edu",
    contactPhone: "+1-203-432-0600",
    address: "1111 Chapel Street",
    city: "New Haven",
    country: "USA",
  },
  {
    businessName: "Stanford University Museum",
    contactPerson: "Dr. Kevin Park",
    contactEmail: "k.park@stanford.edu",
    contactPhone: "+1-650-723-4177",
    address: "328 Lomita Drive",
    city: "Stanford",
    country: "USA",
  },
  {
    businessName: "Harvard Art Museums",
    contactPerson: "Dr. Linda Chang",
    contactEmail: "l.chang@harvard.edu",
    contactPhone: "+1-617-495-9400",
    address: "32 Quincy Street",
    city: "Cambridge",
    country: "USA",
  },
  {
    businessName: "Princeton University Art Museum",
    contactPerson: "Dr. Richard Moore",
    contactEmail: "r.moore@princeton.edu",
    contactPhone: "+1-609-258-3788",
    address: "Elm Drive",
    city: "Princeton",
    country: "USA",
  },
  {
    businessName: "Philadelphia Museum of Art",
    contactPerson: "Catherine Blake",
    contactEmail: "c.blake@philamuseum.org",
    contactPhone: "+1-215-763-8100",
    address: "2600 Benjamin Franklin Pkwy",
    city: "Philadelphia",
    country: "USA",
  },
  {
    businessName: "Cleveland Museum of Art",
    contactPerson: "Thomas Greene",
    contactEmail: "t.greene@clevelandart.org",
    contactPhone: "+1-216-421-7350",
    address: "11150 East Blvd",
    city: "Cleveland",
    country: "USA",
  },
  {
    businessName: "Detroit Institute of Arts",
    contactPerson: "Margaret White",
    contactEmail: "m.white@dia.org",
    contactPhone: "+1-313-833-7900",
    address: "5200 Woodward Ave",
    city: "Detroit",
    country: "USA",
  },
  {
    businessName: "Minneapolis Institute of Art",
    contactPerson: "Peter Anderson",
    contactEmail: "p.anderson@artsmia.org",
    contactPhone: "+1-612-870-3000",
    address: "2400 Third Ave S",
    city: "Minneapolis",
    country: "USA",
  },
  {
    businessName: "Denver Art Museum",
    contactPerson: "Rachel Martinez",
    contactEmail: "r.martinez@denverartmuseum.org",
    contactPhone: "+1-720-865-5000",
    address: "100 W 14th Ave Pkwy",
    city: "Denver",
    country: "USA",
  },
  {
    businessName: "Seattle Art Museum",
    contactPerson: "Daniel Kim",
    contactEmail: "d.kim@seattleartmuseum.org",
    contactPhone: "+1-206-654-3100",
    address: "1300 1st Ave",
    city: "Seattle",
    country: "USA",
  },
  {
    businessName: "Dallas Museum of Art",
    contactPerson: "Laura Johnson",
    contactEmail: "l.johnson@dma.org",
    contactPhone: "+1-214-922-1200",
    address: "1717 N Harwood",
    city: "Dallas",
    country: "USA",
  },
  {
    businessName: "San Francisco Museum of Modern Art",
    contactPerson: "Steven Lee",
    contactEmail: "s.lee@sfmoma.org",
    contactPhone: "+1-415-357-4000",
    address: "151 3rd St",
    city: "San Francisco",
    country: "USA",
  },
  {
    businessName: "Museum of Contemporary Art Chicago",
    contactPerson: "Nicole Brown",
    contactEmail: "n.brown@mcachicago.org",
    contactPhone: "+1-312-280-2660",
    address: "220 E Chicago Ave",
    city: "Chicago",
    country: "USA",
  },
  {
    businessName: "Walker Art Center",
    contactPerson: "Andrew Davis",
    contactEmail: "a.davis@walkerart.org",
    contactPhone: "+1-612-375-7600",
    address: "725 Vineland Place",
    city: "Minneapolis",
    country: "USA",
  },
  {
    businessName: "Portland Art Museum",
    contactPerson: "Emily Taylor",
    contactEmail: "e.taylor@pam.org",
    contactPhone: "+1-503-226-2811",
    address: "1219 SW Park Ave",
    city: "Portland",
    country: "USA",
  },
];

const PATRON_ACCOUNTS = [
  {
    firstName: "Emma",
    lastName: "Thompson",
    email: "emma.thompson@email.com",
    membershipType: "Premium",
    status: "active" as const,
    borrowingLimit: 20,
    holdLimit: 10,
    fineBalance: 0,
    totalCheckouts: 156,
  },
  {
    firstName: "James",
    lastName: "Wilson",
    email: "james.wilson@email.com",
    membershipType: "Faculty",
    status: "active" as const,
    borrowingLimit: 15,
    holdLimit: 8,
    fineBalance: 0,
    totalCheckouts: 89,
  },
  {
    firstName: "Sophia",
    lastName: "Garcia",
    email: "sophia.garcia@email.com",
    membershipType: "Student",
    status: "active" as const,
    borrowingLimit: 10,
    holdLimit: 5,
    fineBalance: 2.5,
    totalCheckouts: 45,
  },
  {
    firstName: "William",
    lastName: "Brown",
    email: "william.brown@email.com",
    membershipType: "Community",
    status: "active" as const,
    borrowingLimit: 8,
    holdLimit: 4,
    fineBalance: 0,
    totalCheckouts: 23,
  },
  {
    firstName: "Olivia",
    lastName: "Martinez",
    email: "olivia.martinez@email.com",
    membershipType: "Senior",
    status: "active" as const,
    borrowingLimit: 12,
    holdLimit: 6,
    fineBalance: 0,
    totalCheckouts: 178,
  },
  {
    firstName: "Benjamin",
    lastName: "Anderson",
    email: "benjamin.anderson@email.com",
    membershipType: "Premium",
    status: "active" as const,
    borrowingLimit: 20,
    holdLimit: 10,
    fineBalance: 0,
    totalCheckouts: 112,
  },
  {
    firstName: "Isabella",
    lastName: "Taylor",
    email: "isabella.taylor@email.com",
    membershipType: "Student",
    status: "active" as const,
    borrowingLimit: 10,
    holdLimit: 5,
    fineBalance: 5.0,
    totalCheckouts: 67,
  },
  {
    firstName: "Lucas",
    lastName: "Thomas",
    email: "lucas.thomas@email.com",
    membershipType: "Faculty",
    status: "active" as const,
    borrowingLimit: 15,
    holdLimit: 8,
    fineBalance: 0,
    totalCheckouts: 134,
  },
  {
    firstName: "Mia",
    lastName: "Jackson",
    email: "mia.jackson@email.com",
    membershipType: "Community",
    status: "expired" as const,
    borrowingLimit: 8,
    holdLimit: 4,
    fineBalance: 12.75,
    totalCheckouts: 34,
  },
  {
    firstName: "Henry",
    lastName: "White",
    email: "henry.white@email.com",
    membershipType: "Senior",
    status: "active" as const,
    borrowingLimit: 12,
    holdLimit: 6,
    fineBalance: 0,
    totalCheckouts: 201,
  },
  {
    firstName: "Charlotte",
    lastName: "Harris",
    email: "charlotte.harris@email.com",
    membershipType: "Premium",
    status: "active" as const,
    borrowingLimit: 20,
    holdLimit: 10,
    fineBalance: 0,
    totalCheckouts: 98,
  },
  {
    firstName: "Alexander",
    lastName: "Clark",
    email: "alexander.clark@email.com",
    membershipType: "Student",
    status: "suspended" as const,
    borrowingLimit: 10,
    holdLimit: 5,
    fineBalance: 15.0,
    totalCheckouts: 28,
  },
  {
    firstName: "Amelia",
    lastName: "Lewis",
    email: "amelia.lewis@email.com",
    membershipType: "Faculty",
    status: "active" as const,
    borrowingLimit: 15,
    holdLimit: 8,
    fineBalance: 0,
    totalCheckouts: 76,
  },
  {
    firstName: "Daniel",
    lastName: "Robinson",
    email: "daniel.robinson@email.com",
    membershipType: "Community",
    status: "active" as const,
    borrowingLimit: 8,
    holdLimit: 4,
    fineBalance: 1.25,
    totalCheckouts: 19,
  },
  {
    firstName: "Harper",
    lastName: "Walker",
    email: "harper.walker@email.com",
    membershipType: "Senior",
    status: "active" as const,
    borrowingLimit: 12,
    holdLimit: 6,
    fineBalance: 0,
    totalCheckouts: 145,
  },
  {
    firstName: "Sebastian",
    lastName: "Hall",
    email: "sebastian.hall@email.com",
    membershipType: "Premium",
    status: "active" as const,
    borrowingLimit: 20,
    holdLimit: 10,
    fineBalance: 0,
    totalCheckouts: 167,
  },
  {
    firstName: "Evelyn",
    lastName: "Allen",
    email: "evelyn.allen@email.com",
    membershipType: "Student",
    status: "active" as const,
    borrowingLimit: 10,
    holdLimit: 5,
    fineBalance: 0,
    totalCheckouts: 52,
  },
  {
    firstName: "Jack",
    lastName: "Young",
    email: "jack.young@email.com",
    membershipType: "Faculty",
    status: "active" as const,
    borrowingLimit: 15,
    holdLimit: 8,
    fineBalance: 0,
    totalCheckouts: 91,
  },
  {
    firstName: "Abigail",
    lastName: "King",
    email: "abigail.king@email.com",
    membershipType: "Community",
    status: "active" as const,
    borrowingLimit: 8,
    holdLimit: 4,
    fineBalance: 3.5,
    totalCheckouts: 41,
  },
  {
    firstName: "Owen",
    lastName: "Wright",
    email: "owen.wright@email.com",
    membershipType: "Senior",
    status: "expired" as const,
    borrowingLimit: 12,
    holdLimit: 6,
    fineBalance: 0,
    totalCheckouts: 88,
  },
  {
    firstName: "Emily",
    lastName: "Scott",
    email: "emily.scott@email.com",
    membershipType: "Premium",
    status: "active" as const,
    borrowingLimit: 20,
    holdLimit: 10,
    fineBalance: 0,
    totalCheckouts: 124,
  },
  {
    firstName: "Liam",
    lastName: "Green",
    email: "liam.green@email.com",
    membershipType: "Student",
    status: "active" as const,
    borrowingLimit: 10,
    holdLimit: 5,
    fineBalance: 0,
    totalCheckouts: 38,
  },
  {
    firstName: "Ella",
    lastName: "Baker",
    email: "ella.baker@email.com",
    membershipType: "Faculty",
    status: "active" as const,
    borrowingLimit: 15,
    holdLimit: 8,
    fineBalance: 0,
    totalCheckouts: 103,
  },
  {
    firstName: "Noah",
    lastName: "Adams",
    email: "noah.adams@email.com",
    membershipType: "Community",
    status: "active" as const,
    borrowingLimit: 8,
    holdLimit: 4,
    fineBalance: 0,
    totalCheckouts: 15,
  },
  {
    firstName: "Grace",
    lastName: "Nelson",
    email: "grace.nelson@email.com",
    membershipType: "Senior",
    status: "active" as const,
    borrowingLimit: 12,
    holdLimit: 6,
    fineBalance: 0,
    totalCheckouts: 167,
  },
  {
    firstName: "Ethan",
    lastName: "Carter",
    email: "ethan.carter@email.com",
    membershipType: "Premium",
    status: "active" as const,
    borrowingLimit: 20,
    holdLimit: 10,
    fineBalance: 0,
    totalCheckouts: 78,
  },
  {
    firstName: "Chloe",
    lastName: "Mitchell",
    email: "chloe.mitchell@email.com",
    membershipType: "Student",
    status: "active" as const,
    borrowingLimit: 10,
    holdLimit: 5,
    fineBalance: 4.25,
    totalCheckouts: 61,
  },
  {
    firstName: "Mason",
    lastName: "Perez",
    email: "mason.perez@email.com",
    membershipType: "Faculty",
    status: "active" as const,
    borrowingLimit: 15,
    holdLimit: 8,
    fineBalance: 0,
    totalCheckouts: 85,
  },
  {
    firstName: "Lily",
    lastName: "Roberts",
    email: "lily.roberts@email.com",
    membershipType: "Community",
    status: "active" as const,
    borrowingLimit: 8,
    holdLimit: 4,
    fineBalance: 0,
    totalCheckouts: 29,
  },
  {
    firstName: "Aiden",
    lastName: "Turner",
    email: "aiden.turner@email.com",
    membershipType: "Senior",
    status: "active" as const,
    borrowingLimit: 12,
    holdLimit: 6,
    fineBalance: 0,
    totalCheckouts: 132,
  },
];

const CONTACT_TEMPLATES = [
  { role: "primary" as const, title: "Director of Collections" },
  { role: "billing" as const, title: "Finance Manager" },
  { role: "shipping" as const, title: "Registrar" },
];

const ACCOUNT_SEGMENTS = [
  {
    name: "VIP Lenders",
    description: "Premium institutional lenders with priority service",
    filters: [
      { field: "accountType", operator: "eq" as const, value: "lender" },
    ],
  },
  {
    name: "Active Borrowers",
    description: "Institutions with active loans",
    filters: [
      { field: "accountType", operator: "eq" as const, value: "borrower" },
      { field: "status", operator: "eq" as const, value: "active" },
    ],
  },
  {
    name: "Overdue Patrons",
    description: "Patrons with outstanding fines",
    filters: [
      { field: "accountType", operator: "eq" as const, value: "patron" },
      { field: "fineBalance", operator: "gt" as const, value: 0 },
    ],
  },
  {
    name: "Premium Members",
    description: "Premium membership tier patrons",
    filters: [
      { field: "membershipType", operator: "eq" as const, value: "Premium" },
    ],
  },
  {
    name: "High Volume Users",
    description: "Patrons with 100+ total checkouts",
    filters: [
      { field: "totalCheckouts", operator: "gte" as const, value: 100 },
    ],
  },
];

const COLLECTION_GROUPS = [
  {
    name: "Impressionist Masters",
    description:
      "Works from the Impressionist movement including Monet, Renoir, and Degas",
  },
  {
    name: "Ancient Egyptian Artifacts",
    description: "Objects from ancient Egypt spanning 3000 years of history",
  },
  {
    name: "Medieval Manuscripts",
    description:
      "Illuminated manuscripts and documents from the medieval period",
  },
  {
    name: "Contemporary Sculpture",
    description: "Modern and contemporary three-dimensional works",
  },
  {
    name: "Asian Art Collection",
    description:
      "Art and artifacts from China, Japan, Korea, and Southeast Asia",
  },
  {
    name: "American Portraits",
    description: "Portraits depicting notable figures in American history",
  },
  {
    name: "Renaissance Paintings",
    description: "Works from the Italian and Northern Renaissance",
  },
  {
    name: "Greek and Roman Antiquities",
    description: "Classical artifacts from ancient Greece and Rome",
  },
  {
    name: "Photography Archive",
    description: "Historical and contemporary photographs",
  },
  {
    name: "Decorative Arts",
    description: "Furniture, ceramics, glass, and metalwork",
  },
];

const PROVENANCE_ENTRIES = [
  {
    eventType: "commission" as const,
    owner: "Cardinal Francesco Barberini",
    startYear: "1630",
    endYear: "1679",
    location: "Rome, Italy",
    verified: true,
  },
  {
    eventType: "inheritance" as const,
    owner: "Barberini Family Collection",
    startYear: "1679",
    endYear: "1812",
    location: "Rome, Italy",
    verified: true,
  },
  {
    eventType: "sale" as const,
    owner: "Private Collector",
    startYear: "1812",
    endYear: "1890",
    salePrice: 5000,
    currency: "GBP",
    location: "London, UK",
    verified: false,
  },
  {
    eventType: "auction" as const,
    owner: "Anonymous Buyer",
    startYear: "1890",
    endYear: "1920",
    auctionHouse: "Christie's",
    salePrice: 25000,
    currency: "GBP",
    location: "London, UK",
    verified: true,
  },
  {
    eventType: "gift" as const,
    owner: "The Morgan Foundation",
    startYear: "1920",
    location: "New York, USA",
    verified: true,
  },
  {
    eventType: "acquisition" as const,
    owner: "Duke of Wellington",
    startYear: "1815",
    endYear: "1852",
    location: "London, UK",
    verified: true,
  },
  {
    eventType: "sale" as const,
    owner: "Rothschild Collection",
    startYear: "1852",
    endYear: "1905",
    salePrice: 15000,
    currency: "GBP",
    location: "Paris, France",
    verified: true,
  },
  {
    eventType: "auction" as const,
    owner: "American Industrialist",
    startYear: "1905",
    endYear: "1945",
    auctionHouse: "Sotheby's",
    salePrice: 75000,
    currency: "USD",
    location: "New York, USA",
    verified: true,
  },
  {
    eventType: "inheritance" as const,
    owner: "Medici Family",
    startYear: "1500",
    endYear: "1737",
    location: "Florence, Italy",
    verified: true,
  },
  {
    eventType: "other" as const,
    owner: "Habsburg Imperial Collection",
    startYear: "1737",
    endYear: "1918",
    location: "Vienna, Austria",
    notes: "Transferred during dissolution of empire",
    verified: true,
  },
];

const INSURANCE_CARRIERS = [
  "Lloyd's of London",
  "AXA Art",
  "Chubb",
  "Hiscox",
  "Berkshire Hathaway",
];

const APPRAISERS = [
  "Christie's Appraisal Services",
  "Sotheby's Valuation",
  "Bonhams Fine Art",
  "Heritage Auctions",
  "Phillips",
];

const DISPLAY_STATUSES = [
  "on_display",
  "in_storage",
  "loaned_out",
  "conservation",
] as const;

const APPRAISAL_TYPES = [
  "insurance",
  "market",
  "fair_market",
  "replacement",
  "liquidation",
] as const;

const POLICY_TYPES = [
  "blanket",
  "scheduled",
  "exhibition",
  "transit",
  "loan",
] as const;

const INCIDENT_TYPES = [
  "damage",
  "theft",
  "loss",
  "fire",
  "water",
  "vandalism",
  "natural_disaster",
  "transit",
  "other",
] as const;

const CLAIM_STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "approved",
  "denied",
  "settled",
  "closed",
  "appealed",
] as const;

const APPRAISER_COMPANIES = [
  { name: "Christie's Appraisal Services", credentials: "AAA Certified" },
  { name: "Sotheby's Valuation", credentials: "ISA Member" },
  { name: "Bonhams Fine Art", credentials: "ASA Accredited" },
  { name: "Heritage Auctions", credentials: "AAA Certified" },
  { name: "Phillips", credentials: "ISA Member" },
  { name: "Skinner Auctioneers", credentials: "ASA Accredited" },
  { name: "Doyle New York", credentials: "AAA Certified" },
  { name: "Freeman's", credentials: "ISA Member" },
];

const INSURANCE_CARRIER_DATA = [
  {
    carrier: "Lloyd's of London",
    contact: "James Whitmore",
    phone: "+44-20-7327-1000",
    email: "fine.art@lloyds.com",
  },
  {
    carrier: "AXA Art Insurance",
    contact: "Marie Laurent",
    phone: "+1-212-415-8400",
    email: "claims@axa-art.com",
  },
  {
    carrier: "Chubb Fine Art",
    contact: "Robert Chen",
    phone: "+1-908-903-2000",
    email: "fineart@chubb.com",
  },
  {
    carrier: "Hiscox Art Insurance",
    contact: "Sarah Mitchell",
    phone: "+1-646-452-2353",
    email: "art@hiscox.com",
  },
  {
    carrier: "Berkshire Hathaway Specialty",
    contact: "Michael Torres",
    phone: "+1-617-936-1000",
    email: "specialty@bhspecialty.com",
  },
];

const INCIDENT_DESCRIPTIONS = [
  "Minor surface scratch discovered during routine inspection",
  "Water damage from HVAC leak in storage area",
  "Frame damage during installation for exhibition",
  "Theft reported during overnight hours",
  "Fire damage from electrical fault in adjacent gallery",
  "Vandalism incident during public hours",
  "Transit damage during loan shipment",
  "Accidental damage by visitor contact",
  "Humidity damage due to climate control failure",
  "Structural damage from building maintenance work",
];

const ADJUSTER_NAMES = [
  "William Patterson",
  "Elizabeth Chen",
  "David Morrison",
  "Jennifer Walsh",
  "Thomas Anderson",
];

const EXHIBITION_TITLES = [
  "Masterpieces of the Renaissance",
  "Ancient Civilizations: A Journey Through Time",
  "Modern Art Movements",
  "The Art of War: Weapons and Armor",
  "Sacred Spaces: Religious Art Through the Ages",
  "Portraits of Power",
  "Nature in Art",
  "The Golden Age of Dutch Painting",
  "Asian Art Traditions",
  "Photography: Capturing Moments",
  "Textile Arts of the World",
  "Jewelry and Adornment",
  "Scientific Instruments Through History",
  "The Art of Glass",
  "Ceramics: From Ancient to Modern",
];

const EXHIBITION_VENUES = [
  "Main Gallery",
  "East Wing Gallery",
  "West Wing Gallery",
  "Special Exhibitions Hall",
  "Sculpture Garden",
  "Photography Gallery",
  "Prints and Drawings Room",
  "Medieval Hall",
  "Asian Art Gallery",
  "Contemporary Wing",
];

const _INSTALLATION_TASK_TYPES = [
  "lighting",
  "signage",
  "mounts",
  "conservation",
  "labeling",
  "security",
  "av",
  "other",
] as const;

const INSTALLATION_TASKS = [
  { title: "Install track lighting", type: "lighting" as const, hours: 4 },
  { title: "Set up accent lights", type: "lighting" as const, hours: 2 },
  { title: "Create exhibition signage", type: "signage" as const, hours: 6 },
  { title: "Install wayfinding signs", type: "signage" as const, hours: 3 },
  { title: "Build custom display mounts", type: "mounts" as const, hours: 8 },
  { title: "Install wall brackets", type: "mounts" as const, hours: 4 },
  {
    title: "Condition check - pre-installation",
    type: "conservation" as const,
    hours: 2,
  },
  { title: "Climate stabilization", type: "conservation" as const, hours: 4 },
  { title: "Print and install labels", type: "labeling" as const, hours: 4 },
  { title: "Install vitrine labels", type: "labeling" as const, hours: 2 },
  { title: "Configure security sensors", type: "security" as const, hours: 3 },
  { title: "Test alarm systems", type: "security" as const, hours: 2 },
  { title: "Set up audio guide stations", type: "av" as const, hours: 4 },
  { title: "Install video displays", type: "av" as const, hours: 6 },
  { title: "Final walkthrough", type: "other" as const, hours: 2 },
];

const _TREATMENT_TYPES = [
  "routine",
  "stabilization",
  "restoration",
  "cleaning",
  "repair",
  "assessment",
] as const;

const CONSERVATION_TREATMENTS = [
  { title: "Surface cleaning", type: "cleaning" as const, hours: 2, cost: 150 },
  {
    title: "Dust removal and inspection",
    type: "routine" as const,
    hours: 1,
    cost: 75,
  },
  {
    title: "Frame stabilization",
    type: "stabilization" as const,
    hours: 4,
    cost: 500,
  },
  { title: "Canvas repair", type: "repair" as const, hours: 8, cost: 1200 },
  {
    title: "Varnish removal and replacement",
    type: "restoration" as const,
    hours: 12,
    cost: 2500,
  },
  {
    title: "Paint layer consolidation",
    type: "stabilization" as const,
    hours: 6,
    cost: 800,
  },
  {
    title: "Condition assessment",
    type: "assessment" as const,
    hours: 2,
    cost: 200,
  },
  {
    title: "UV light examination",
    type: "assessment" as const,
    hours: 1,
    cost: 150,
  },
  {
    title: "Inpainting touch-ups",
    type: "restoration" as const,
    hours: 4,
    cost: 600,
  },
  {
    title: "Humidity damage treatment",
    type: "repair" as const,
    hours: 10,
    cost: 1500,
  },
  { title: "Pest treatment", type: "routine" as const, hours: 3, cost: 250 },
  {
    title: "Metal corrosion stabilization",
    type: "stabilization" as const,
    hours: 5,
    cost: 700,
  },
];

const ALERT_TYPES = [
  "condition_degraded",
  "treatment_overdue",
  "assessment_due",
  "urgent_treatment",
  "environmental_alert",
] as const;

const ALERT_TITLES = [
  "Condition degradation detected",
  "Scheduled treatment overdue",
  "Annual assessment due",
  "Urgent conservation needed",
  "Environmental conditions out of range",
  "Humidity spike detected",
  "Temperature fluctuation alert",
  "Light level exceeded threshold",
  "Pest activity detected",
  "Structural concern identified",
];

const ASSESSMENT_SCHEDULES = [
  { name: "Annual Condition Survey", intervalDays: 365, type: "full" as const },
  {
    name: "Quarterly Spot Checks",
    intervalDays: 90,
    type: "spot_check" as const,
  },
  {
    name: "Monthly Environmental Review",
    intervalDays: 30,
    type: "environmental" as const,
  },
  {
    name: "Semi-Annual Condition Assessment",
    intervalDays: 182,
    type: "condition" as const,
  },
  {
    name: "Weekly Gallery Inspection",
    intervalDays: 7,
    type: "spot_check" as const,
  },
];

const TRANSIT_CARRIERS = [
  {
    name: "Cadogan Tate",
    type: "art_handler" as const,
    contact: "James Wilson",
  },
  {
    name: "Masterpiece International",
    type: "art_handler" as const,
    contact: "Sarah Chen",
  },
  {
    name: "Crozier Fine Arts",
    type: "art_handler" as const,
    contact: "Michael Brown",
  },
  { name: "Atelier 4", type: "art_handler" as const, contact: "Elena Rossi" },
  {
    name: "Dietl International",
    type: "art_handler" as const,
    contact: "Hans Mueller",
  },
  {
    name: "FedEx Custom Critical",
    type: "freight" as const,
    contact: "Customer Service",
  },
  { name: "Museum Courier", type: "courier" as const, contact: "David Park" },
  {
    name: "Internal Transport",
    type: "internal" as const,
    contact: "Facilities",
  },
];

const TRANSIT_LOCATIONS = [
  { name: "Main Museum", address: "123 Museum Way, New York, NY 10001" },
  {
    name: "Storage Facility A",
    address: "456 Warehouse Blvd, Newark, NJ 07102",
  },
  {
    name: "Conservation Center",
    address: "789 Restoration Ave, New York, NY 10012",
  },
  {
    name: "Metropolitan Art Gallery",
    address: "321 Gallery Street, Boston, MA 02108",
  },
  {
    name: "National Museum",
    address: "555 Constitution Ave, Washington, DC 20001",
  },
  {
    name: "Private Collection",
    address: "111 Park Avenue, New York, NY 10028",
  },
];

const SPECIAL_HANDLING = [
  "Climate controlled",
  "Fragile - handle with care",
  "This side up",
  "Do not stack",
  "Vibration sensitive",
  "Light sensitive",
  "Humidity controlled",
  "Security escort required",
];

const TRANSIT_STATUSES = [
  "draft",
  "scheduled",
  "in_transit",
  "out_for_delivery",
  "delivered",
] as const;

const LOAN_TERMS = [
  "Standard loan terms apply. Object must be kept in climate-controlled environment.",
  "Exhibition use only. No photography permitted without prior written consent.",
  "Object must be displayed in secure case. 24-hour security required.",
  "Borrower responsible for round-trip shipping via art handler.",
  "Conservation inspection required before and after loan period.",
  "Object must be insured for full replacement value during loan period.",
  "No restoration or conservation work without prior written approval.",
  "Object must be returned in same condition as received.",
  "Lender reserves right to recall object with 30 days notice.",
  "All exhibition materials must be approved by lender before publication.",
];

const CONDITION_DESCRIPTIONS = [
  "Object in excellent condition. No visible damage or deterioration.",
  "Minor surface dust. Overall stable condition.",
  "Small scratch on lower right corner, pre-existing.",
  "Some age-related yellowing, stable.",
  "Frame shows minor wear, painting in good condition.",
  "Slight fading in exposed areas, consistent with age.",
  "Minor craquelure present, stable and not progressing.",
  "Small chip on base, documented in previous reports.",
  "Surface patina consistent with age and material.",
  "Minimal handling wear, overall very good condition.",
];

const EXTENSION_REASONS = [
  "Exhibition extended due to popular demand.",
  "Conservation work on permanent gallery not yet complete.",
  "Shipping delays due to weather conditions.",
  "Additional scholarly research in progress.",
  "Complementary exhibition being organized.",
  "Insurance renewal pending.",
  "Facility renovation timeline extended.",
  "Catalog publication delayed.",
];

const WORKFLOW_TEMPLATES = [
  {
    name: "Standard Accession",
    workflowType: "accession" as const,
    isSystem: true,
    steps: [
      {
        stepNumber: 0,
        name: "Initial Review",
        roleName: "curator",
        approvalMode: "single" as const,
      },
      {
        stepNumber: 1,
        name: "Documentation Check",
        roleName: "admin",
        requiredDocuments: ["deed_of_gift", "provenance_documentation"],
        approvalMode: "single" as const,
      },
      {
        stepNumber: 2,
        name: "Final Approval",
        roleName: "admin",
        approvalMode: "single" as const,
      },
    ],
    requiredDocuments: [
      { documentType: "deed_of_gift", description: "Legal transfer document" },
      {
        documentType: "provenance_documentation",
        description: "Ownership history records",
      },
      {
        documentType: "condition_report",
        description: "Initial condition assessment",
      },
    ],
  },
  {
    name: "Standard Deaccession",
    workflowType: "deaccession" as const,
    isSystem: true,
    steps: [
      {
        stepNumber: 0,
        name: "Curator Review",
        roleName: "curator",
        approvalMode: "single" as const,
      },
      {
        stepNumber: 1,
        name: "Board Review",
        roleName: "admin",
        approvalMode: "multi" as const,
        requiredApprovals: 2,
      },
      {
        stepNumber: 2,
        name: "Director Approval",
        roleName: "admin",
        approvalMode: "single" as const,
      },
    ],
    requiredDocuments: [
      {
        documentType: "deaccession_justification",
        description: "Reason for removal from collection",
      },
      {
        documentType: "appraisal_report",
        description: "Current market valuation",
      },
    ],
  },
  {
    name: "Standard Loan",
    workflowType: "loan" as const,
    isSystem: true,
    steps: [
      {
        stepNumber: 0,
        name: "Registrar Review",
        roleName: "admin",
        approvalMode: "single" as const,
      },
      {
        stepNumber: 1,
        name: "Conservation Check",
        roleName: "admin",
        approvalMode: "single" as const,
        canSkip: true,
      },
      {
        stepNumber: 2,
        name: "Director Approval",
        roleName: "admin",
        approvalMode: "single" as const,
      },
    ],
    requiredDocuments: [
      { documentType: "loan_agreement", description: "Legal loan contract" },
      {
        documentType: "insurance_certificate",
        description: "Insurance coverage documentation",
      },
      {
        documentType: "condition_report",
        description: "Pre-loan condition assessment",
      },
    ],
  },
  {
    name: "Standard Acquisition",
    workflowType: "acquisition" as const,
    isSystem: true,
    steps: [
      {
        stepNumber: 0,
        name: "Curator Recommendation",
        roleName: "curator",
        approvalMode: "single" as const,
      },
      {
        stepNumber: 1,
        name: "Budget Review",
        roleName: "admin",
        approvalMode: "single" as const,
      },
      {
        stepNumber: 2,
        name: "Final Approval",
        roleName: "admin",
        approvalMode: "single" as const,
      },
    ],
    requiredDocuments: [
      {
        documentType: "acquisition_proposal",
        description: "Justification for purchase",
      },
      {
        documentType: "appraisal_report",
        description: "Independent valuation",
      },
    ],
  },
  {
    name: "Standard Exhibition",
    workflowType: "exhibition" as const,
    isSystem: true,
    steps: [
      {
        stepNumber: 0,
        name: "Proposal Review",
        roleName: "curator",
        approvalMode: "single" as const,
      },
      {
        stepNumber: 1,
        name: "Space & Budget Approval",
        roleName: "admin",
        approvalMode: "single" as const,
      },
      {
        stepNumber: 2,
        name: "Final Sign-off",
        roleName: "admin",
        approvalMode: "single" as const,
      },
    ],
    requiredDocuments: [
      {
        documentType: "exhibition_proposal",
        description: "Exhibition plan and rationale",
      },
      { documentType: "floor_plan", description: "Gallery layout design" },
    ],
  },
  {
    name: "Standard Conservation",
    workflowType: "conservation" as const,
    isSystem: true,
    steps: [
      {
        stepNumber: 0,
        name: "Conservator Assessment",
        roleName: "admin",
        approvalMode: "single" as const,
      },
      {
        stepNumber: 1,
        name: "Treatment Approval",
        roleName: "curator",
        approvalMode: "single" as const,
      },
      {
        stepNumber: 2,
        name: "Completion Review",
        roleName: "admin",
        approvalMode: "single" as const,
      },
    ],
    requiredDocuments: [
      {
        documentType: "condition_report",
        description: "Pre-treatment condition",
      },
      {
        documentType: "treatment_proposal",
        description: "Proposed conservation work",
      },
    ],
  },
];

const SLA_CONFIGS = [
  { workflowType: "accession" as const, slaDays: 14, warningDays: 3 },
  { workflowType: "deaccession" as const, slaDays: 30, warningDays: 7 },
  { workflowType: "loan" as const, slaDays: 7, warningDays: 2 },
  { workflowType: "acquisition" as const, slaDays: 21, warningDays: 5 },
  { workflowType: "exhibition" as const, slaDays: 30, warningDays: 7 },
  { workflowType: "conservation" as const, slaDays: 14, warningDays: 3 },
];

const ACCESSION_METHODS = [
  "purchase",
  "gift",
  "loan",
  "transfer",
  "donation",
  "bequest",
] as const;

const ACCESSION_SOURCES = [
  "The Morgan Foundation",
  "Elizabeth Worthington Estate",
  "The Vanderbilt Trust",
  "Robert J. Smithson III",
  "The Carnegie Endowment",
  "Margaret Chen Collection",
  "The Rockefeller Foundation",
  "William H. Taft Memorial Fund",
  "Sarah Blackwell Estate",
  "The Getty Trust",
  "James Morrison Gallery",
  "The Mellon Foundation",
  "Catherine DuPont Collection",
  "The Ford Foundation",
  "Alexander Hamilton Society",
  "Patricia Hearst Collection",
  "The Astor Foundation",
  "Michael Bloomberg Arts Fund",
  "The Whitney Family Trust",
  "Anonymous Benefactor",
  "Dr. Helena Strauss",
  "The Frick Collection",
  "National Endowment for the Arts",
  "The Kress Foundation",
  "Private European Collector",
];

const DEACCESSION_REASONS = [
  "Duplicate in collection - identical or near-identical work already held",
  "Outside collection scope - does not align with current collecting mission",
  "Poor condition - deterioration beyond conservation feasibility",
  "Repatriation request - returning to country/community of origin",
  "Deaccessioned for sale - proceeds to benefit acquisitions fund",
  "Transferred to partner institution - better suited to their collection",
  "Authenticity concerns - attribution no longer supportable",
  "Storage constraints - insufficient space for proper care",
  "Ethical concerns - provenance issues or contested ownership",
  "Collection refinement - upgrading to superior example",
];

const DEACCESSION_METHODS = [
  "sale",
  "donation",
  "destruction",
  "transfer",
] as const;

const DEACCESSION_DISPOSITIONS = [
  "Sold at Christie's auction",
  "Sold at Sotheby's auction",
  "Donated to local university museum",
  "Transferred to sister institution",
  "Returned to donor family",
  "Sold through private dealer",
  "Donated to community arts center",
  "Transferred to national museum",
  "Destroyed per conservation recommendation",
  "Repatriated to country of origin",
];

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

async function seedFoundationData(
  ctx: ActionCtx,
  orgId: Id<"organizations">,
  userId: Id<"users">,
): Promise<void> {
  const locationIds: Map<string, Id<"locations">> = new Map();

  let sortOrder = 0;
  await Promise.all([
    Promise.all(
      Array.from(BUILDINGS).map(async (building) => {
        const buildingId = await ctx.runMutation(
          internal.seedMet.createLocation,
          {
            organizationId: orgId,
            name: building,
            type: "building",
            sortOrder: sortOrder++,
            address:
              building === "Main Building"
                ? "123 Museum Way, New York, NY 10001"
                : undefined,
          },
        );
        locationIds.set(`building:${building}`, buildingId);
        await Promise.all(
          Array.from(FLOORS.slice(0, 3)).map(async (floor) => {
            const floorId = await ctx.runMutation(
              internal.seedMet.createLocation,
              {
                organizationId: orgId,
                name: floor,
                type: "floor",
                parentLocationId: buildingId,
                sortOrder: sortOrder++,
              },
            );
            locationIds.set(`floor:${building}:${floor}`, floorId);
            const roomsForFloor = ROOMS.slice(0, 4);
            await Promise.all(
              roomsForFloor.map(async (room) => {
                const roomId = await ctx.runMutation(
                  internal.seedMet.createLocation,
                  {
                    organizationId: orgId,
                    name: room,
                    type: "room",
                    parentLocationId: floorId,
                    sortOrder: sortOrder++,
                  },
                );
                locationIds.set(`room:${building}:${floor}:${room}`, roomId);
                if (room.includes("Storage") || room.includes("Gallery")) {
                  const cabinetsForRoom = CABINETS.slice(0, 2);
                  await Promise.all(
                    cabinetsForRoom.map((cabinet) =>
                      ctx.runMutation(internal.seedMet.createLocation, {
                        organizationId: orgId,
                        name: cabinet,
                        type: "cabinet",
                        parentLocationId: roomId,
                        sortOrder: sortOrder++,
                      }),
                    ),
                  );
                }
              }),
            );
          }),
        );
      }),
    ),
    Promise.all(
      Array.from(CONDITION_OPTIONS).map(async (condition) => {
        await ctx.runMutation(internal.seedMet.createConditionOption, {
          organizationId: orgId,
          userId,
          name: condition.name,
          description: condition.description,
        });
      }),
    ),
    Promise.all(
      Array.from(MATERIAL_OPTIONS).map(async (material) => {
        await ctx.runMutation(internal.seedMet.createMaterialOption, {
          organizationId: orgId,
          userId,
          name: material,
        });
      }),
    ),
    Promise.all(
      Array.from(TYPE_OPTIONS).map(async (type) => {
        await ctx.runMutation(internal.seedMet.createTypeOption, {
          organizationId: orgId,
          userId,
          name: type,
        });
      }),
    ),
    Promise.all(
      Array.from(DONOR_DATA).map(async (donor) => {
        await ctx.runMutation(internal.seedMet.createDonor, {
          organizationId: orgId,
          userId,
          name: donor.name,
          email: donor.email,
        });
      }),
    ),
  ] as const);

  console.log("  Created foundation data for organization");
}

function generateAccountNumber(index: number): string {
  return `ACC-${String(index).padStart(5, "0")}`;
}

function generateCardNumber(index: number): string {
  return `CARD-${String(100000 + index).padStart(6, "0")}`;
}

async function seedAccountsData(
  ctx: ActionCtx,
  orgId: Id<"organizations">,
  userId: Id<"users">,
): Promise<void> {
  let accountIndex = 1;

  await Promise.all(
    Array.from(LENDER_ACCOUNTS).map(async (lender) => {
      const accountId = await ctx.runMutation(internal.seedMet.createAccount, {
        organizationId: orgId,
        userId,
        accountNumber: generateAccountNumber(accountIndex++),
        accountType: "lender",
        businessName: lender.businessName,
        contactPerson: lender.contactPerson,
        contactEmail: lender.contactEmail,
        contactPhone: lender.contactPhone,
        address: lender.address,
        city: lender.city,
        country: lender.country,
        status: "active",
      });

      await Promise.all(
        Array.from({ length: CONTACT_TEMPLATES.length }, async (_, i) => {
          const template = CONTACT_TEMPLATES[i]!;
          const nameParts = lender.contactPerson.split(" ");
          const firstName = i === 0 ? nameParts[0]! : `Contact${i + 1}`;
          const lastName =
            i === 0
              ? nameParts.slice(1).join(" ")
              : lender.businessName.split(" ")[0]!;

          await ctx.runMutation(internal.seedMet.createContact, {
            organizationId: orgId,
            accountId,
            firstName,
            lastName,
            title: template.title,
            role: template.role,
            email:
              i === 0
                ? lender.contactEmail
                : `${template.role}@${lender.contactEmail.split("@")[1]}`,
            phone: lender.contactPhone,
            isPrimary: i === 0,
          });
        }),
      );
    }),
  );

  await Promise.all(
    Array.from(BORROWER_ACCOUNTS).map(async (borrower) => {
      const accountId = await ctx.runMutation(internal.seedMet.createAccount, {
        organizationId: orgId,
        userId,
        accountNumber: generateAccountNumber(accountIndex++),
        accountType: "borrower",
        businessName: borrower.businessName,
        contactPerson: borrower.contactPerson,
        contactEmail: borrower.contactEmail,
        contactPhone: borrower.contactPhone,
        address: borrower.address,
        city: borrower.city,
        country: borrower.country,
        status: "active",
      });

      await Promise.all(
        Array.from({ length: CONTACT_TEMPLATES.length }, async (_, i) => {
          const template = CONTACT_TEMPLATES[i]!;
          const nameParts = borrower.contactPerson.split(" ");
          const firstName = i === 0 ? nameParts[0]! : `Contact${i + 1}`;
          const lastName =
            i === 0
              ? nameParts.slice(1).join(" ")
              : borrower.businessName.split(" ")[0]!;

          await ctx.runMutation(internal.seedMet.createContact, {
            organizationId: orgId,
            accountId,
            firstName,
            lastName,
            title: template.title,
            role: template.role,
            email:
              i === 0
                ? borrower.contactEmail
                : `${template.role}@${borrower.contactEmail.split("@")[1]}`,
            phone: borrower.contactPhone,
            isPrimary: i === 0,
          });
        }),
      );
    }),
  );

  let patronIndex = 1;
  await Promise.all(
    Array.from(PATRON_ACCOUNTS).map(async (patron) => {
      await ctx.runMutation(internal.seedMet.createAccount, {
        organizationId: orgId,
        userId,
        accountNumber: generateAccountNumber(accountIndex++),
        accountType: "patron",
        firstName: patron.firstName,
        lastName: patron.lastName,
        email: patron.email,
        cardNumber: generateCardNumber(patronIndex++),
        membershipType: patron.membershipType,
        status: patron.status,
        borrowingLimit: patron.borrowingLimit,
        holdLimit: patron.holdLimit,
        fineBalance: patron.fineBalance,
        totalCheckouts: patron.totalCheckouts,
      });
    }),
  );

  await Promise.all(
    Array.from(ACCOUNT_SEGMENTS).map(async (segment) => {
      await ctx.runMutation(internal.seedMet.createAccountSegment, {
        organizationId: orgId,
        userId,
        name: segment.name,
        description: segment.description,
        filters: segment.filters,
      });
    }),
  );

  console.log(
    `  Created accounts data: ${LENDER_ACCOUNTS.length} lenders, ${BORROWER_ACCOUNTS.length} borrowers, ${PATRON_ACCOUNTS.length} patrons, ${ACCOUNT_SEGMENTS.length} segments`,
  );
}

function generateRandomValuation(): number {
  const min = 10000;
  const max = 5000000;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generatePolicyNumber(): string {
  const prefix = ["ART", "INS", "POL", "CVR"][Math.floor(Math.random() * 4)];
  const number = Math.floor(Math.random() * 900000000) + 100000000;
  return `${prefix}-${number}`;
}

function generateProvenanceChain(): typeof PROVENANCE_ENTRIES {
  const numEntries = Math.floor(Math.random() * 4) + 2;
  const shuffled = PROVENANCE_ENTRIES.toSorted(() => Math.random() - 0.5);
  return shuffled.slice(0, numEntries);
}

async function seedCollectionDetailsData(
  ctx: ActionCtx,
  orgId: Id<"organizations">,
  userId: Id<"users">,
): Promise<void> {
  const collections = await ctx.runQuery(internal.seedMet.getCollections, {
    organizationId: orgId,
  });

  if (collections.length === 0) {
    console.log("  No collections found, skipping details seeding");
    return;
  }

  const groupIds: Id<"collectionGroups">[] = [];
  await Promise.all(
    Array.from(COLLECTION_GROUPS).map(async (group) => {
      const groupValuation = generateRandomValuation() * 10;
      const groupId = await ctx.runMutation(
        internal.seedMet.createCollectionGroup,
        {
          organizationId: orgId,
          userId,
          name: group.name,
          description: group.description,
          valuation: groupValuation,
        },
      );
      groupIds.push(groupId);
    }),
  );
  console.log(`  Created ${groupIds.length} collection groups`);

  let groupAssignments = 0;
  await Promise.all(
    Array.from(collections).map(async (collection) => {
      const numGroups = Math.floor(Math.random() * 2) + 1;
      const shuffledGroups = groupIds.toSorted(() => Math.random() - 0.5);
      const selectedGroups = shuffledGroups.slice(0, numGroups);

      await Promise.all(
        Array.from(selectedGroups).map(async (groupId) => {
          await ctx.runMutation(internal.seedMet.createCollectionGroupItem, {
            collectionGroupId: groupId,
            collectionId: collection._id,
            userId,
          });
          groupAssignments++;
        }),
      );
    }),
  );
  console.log(`  Created ${groupAssignments} collection group assignments`);

  let fineArtCount = 0;
  const now = Date.now();
  const oneYear = 365 * 24 * 60 * 60 * 1000;

  await Promise.all(
    Array.from(collections).map(async (collection) => {
      const appraisedValue = generateRandomValuation();
      const replacementValue = Math.floor(appraisedValue * 1.2);
      const carrier =
        INSURANCE_CARRIERS[
          Math.floor(Math.random() * INSURANCE_CARRIERS.length)
        ];
      const appraiser =
        APPRAISERS[Math.floor(Math.random() * APPRAISERS.length)];
      const displayStatus =
        DISPLAY_STATUSES[Math.floor(Math.random() * DISPLAY_STATUSES.length)];
      const provenanceChain = generateProvenanceChain();

      const lastAppraisalDate = now - Math.floor(Math.random() * oneYear);
      const reappraisalDate = lastAppraisalDate + oneYear;
      const insuranceExpiresAt = now + Math.floor(Math.random() * oneYear);

      await ctx.runMutation(internal.seedMet.createFineArtDetails, {
        collectionId: collection._id,
        organizationId: orgId,
        appraisedValue,
        replacementValue,
        insurancePolicyNumber: generatePolicyNumber(),
        insuranceCarrier: carrier,
        insuranceExpiresAt,
        reappraisalDate,
        lastAppraisalDate,
        appraiser,
        displayStatus,
        provenanceChain,
      });
      fineArtCount++;
    }),
  );
  console.log(`  Created ${fineArtCount} fine art details records`);
}

async function seedWorkflowData(
  ctx: ActionCtx,
  orgId: Id<"organizations">,
  userId: Id<"users">,
): Promise<void> {
  const templateIds: Map<string, Id<"workflowTemplates">> = new Map();
  await Promise.all(
    Array.from(WORKFLOW_TEMPLATES).map(async (template) => {
      const templateId = await ctx.runMutation(
        internal.seedMet.createWorkflowTemplate,
        {
          name: template.name,
          workflowType: template.workflowType,
          isSystem: template.isSystem,
          steps: template.steps,
          requiredDocuments: template.requiredDocuments,
          userId,
        },
      );
      templateIds.set(template.workflowType, templateId);
    }),
  );

  const [adminRoleId, curatorRoleId] = await Promise.all([
    ctx.runQuery(internal.seedMet.getRoleByName, {
      organizationId: orgId,
      name: "admin",
    }),
    ctx.runQuery(internal.seedMet.getRoleByName, {
      organizationId: orgId,
      name: "curator",
    }),
  ] as const);
  if (!adminRoleId) {
    console.log("  Warning: Admin role not found, skipping workflow configs");
    return;
  }

  await Promise.all(
    Array.from(WORKFLOW_TEMPLATES).map(async (template) => {
      const steps = template.steps.map((step) => ({
        stepNumber: step.stepNumber,
        name: step.name,
        roleId:
          step.roleName === "curator" && curatorRoleId
            ? curatorRoleId
            : adminRoleId,
        requiredDocuments:
          "requiredDocuments" in step ? step.requiredDocuments : undefined,
        approvalMode: step.approvalMode,
        requiredApprovals:
          "requiredApprovals" in step ? step.requiredApprovals : undefined,
        canSkip: "canSkip" in step ? step.canSkip : undefined,
      }));

      await ctx.runMutation(internal.seedMet.createWorkflowConfig, {
        organizationId: orgId,
        workflowType: template.workflowType,
        steps,
        canInitiateRoles: [
          adminRoleId,
          ...(curatorRoleId ? [curatorRoleId] : []),
        ],
        requiredDocuments: template.requiredDocuments,
        requireSourceVerification: template.workflowType === "accession",
        templateId: templateIds.get(template.workflowType),
      });
    }),
  );

  await Promise.all(
    Array.from(SLA_CONFIGS).map(async (sla) => {
      await ctx.runMutation(internal.seedMet.createWorkflowSlaConfig, {
        organizationId: orgId,
        workflowType: sla.workflowType,
        slaDays: sla.slaDays,
        warningDays: sla.warningDays,
        escalateToRoleId: adminRoleId,
        isActive: true,
        userId,
      });
    }),
  );

  console.log(
    `  Created ${WORKFLOW_TEMPLATES.length} workflow templates and configs, ${SLA_CONFIGS.length} SLA configs`,
  );
}

function generateLoanNumber(
  year: number,
  month: number,
  index: number,
): string {
  const monthStr = String(month).padStart(2, "0");
  const indexStr = String(index).padStart(4, "0");
  return `L${year}.${monthStr}.${indexStr}`;
}

function randomElement<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

type LoanStatus = "pending" | "active" | "dispatched" | "returned";

function getRandomStatus(): LoanStatus {
  const rand = Math.random();
  if (rand < 0.1) return "pending";
  if (rand < 0.5) return "active";
  if (rand < 0.8) return "returned";
  return "dispatched";
}

async function seedLoansData(
  ctx: ActionCtx,
  orgId: Id<"organizations">,
  userId: Id<"users">,
): Promise<void> {
  const collections = await ctx.runQuery(internal.seedMet.getCollections, {
    organizationId: orgId,
  });

  if (collections.length === 0) {
    console.log("  No collections found, skipping loans seeding");
    return;
  }

  const [lenderAccounts, borrowerAccounts] = await Promise.all([
    ctx.runQuery(internal.seedMet.getAccounts, {
      organizationId: orgId,
      accountType: "lender",
    }),
    ctx.runQuery(internal.seedMet.getAccounts, {
      organizationId: orgId,
      accountType: "borrower",
    }),
  ] as const);
  if (lenderAccounts.length === 0 || borrowerAccounts.length === 0) {
    console.log("  No accounts found, skipping loans seeding");
    return;
  }

  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const oneMonth = 30 * oneDay;
  const oneYear = 365 * oneDay;

  let loanIndex = 1;
  let totalLoans = 0;
  let totalLoanItems = 0;
  let totalConditionReports = 0;
  let totalExtensionRequests = 0;
  let totalReminders = 0;

  const usedCollectionIds = new Set<string>();

  await Promise.all(
    Array.from({ length: 25 }, async (_, i) => {
      const account = lenderAccounts[i % lenderAccounts.length]!;
      const status = getRandomStatus();

      const startOffset = randomInt(-oneYear, oneMonth * 3);
      const startDate = now + startOffset;
      const loanDuration = randomInt(oneMonth * 3, oneYear);
      const endDate = startDate + loanDuration;

      const loanNumber = generateLoanNumber(
        new Date(startDate).getFullYear(),
        new Date(startDate).getMonth() + 1,
        loanIndex++,
      );

      const approvedAt =
        status !== "pending" ? startDate - oneDay * 7 : undefined;

      const loanId = await ctx.runMutation(internal.seedMet.createLoan, {
        organizationId: orgId,
        loanNumber,
        type: "incoming",
        accountId: account._id,
        lenderBorrowerName:
          account.businessName ?? `${account.firstName} ${account.lastName}`,
        lenderBorrowerContact: account.contactPerson,
        startDate,
        endDate,
        status,
        terms: randomElement(LOAN_TERMS),
        insuranceValue: randomInt(50000, 5000000),
        approvedBy: status !== "pending" ? userId : undefined,
        approvedAt,
        notes: status === "pending" ? "Awaiting approval" : undefined,
        workflowStep: status === "pending" ? 0 : 2,
        assignedTo: userId,
        useDetailedConditionReports: Math.random() > 0.5,
      });

      totalLoans++;

      const numItems = randomInt(2, 5);
      const availableCollections = collections.filter(
        (c) => !usedCollectionIds.has(c._id),
      );
      const itemCollections = availableCollections.slice(0, numItems);

      await Promise.all(
        Array.from(itemCollections).map(async (collection) => {
          usedCollectionIds.add(collection._id);

          const conditionOut = randomElement(CONDITION_DESCRIPTIONS);
          const conditionIn =
            status === "returned"
              ? randomElement(CONDITION_DESCRIPTIONS)
              : undefined;

          const loanItemId = await ctx.runMutation(
            internal.seedMet.createLoanItem,
            {
              loanId,
              collectionId: collection._id,
              conditionOut,
              conditionIn,
              notes: Math.random() > 0.7 ? "Handle with care" : undefined,
            },
          );

          totalLoanItems++;

          const conditionReportId = await ctx.runMutation(
            internal.seedMet.createConditionReport,
            {
              loanItemId,
              reportType: "out",
              conditionDescription: conditionOut,
              damages:
                Math.random() > 0.8
                  ? [
                      {
                        type: "scratch",
                        location: "lower right corner",
                        severity: "minor",
                        notes: "Pre-existing, documented",
                      },
                    ]
                  : undefined,
              assessedBy: userId,
              assessedAt: startDate - oneDay,
            },
          );

          totalConditionReports++;

          if (status === "returned") {
            await ctx.runMutation(internal.seedMet.createConditionReport, {
              loanItemId,
              reportType: "in",
              conditionDescription: conditionIn!,
              assessedBy: userId,
              assessedAt: endDate,
            });
            totalConditionReports++;
          }

          await ctx.runMutation(internal.seedMet.createLoanItem, {
            loanId,
            collectionId: collection._id,
            conditionOut,
            conditionIn,
            notes: Math.random() > 0.7 ? "Handle with care" : undefined,
            conditionReportId,
          });
        }),
      );

      if (status === "active" && Math.random() < 0.1) {
        const extensionDays = randomInt(30, 180);
        await ctx.runMutation(internal.seedMet.createLoanExtensionRequest, {
          loanId,
          organizationId: orgId,
          requestedBy: userId,
          requestedAt: now - oneDay * randomInt(1, 30),
          originalEndDate: endDate,
          newRequestedEndDate: endDate + extensionDays * oneDay,
          reason: randomElement(EXTENSION_REASONS),
          status: "pending",
        });
        totalExtensionRequests++;
      }

      const daysUntilDue = (endDate - now) / oneDay;
      if (status === "active" && daysUntilDue > 0 && daysUntilDue <= 30) {
        let reminderType:
          | "due_soon_30"
          | "due_soon_14"
          | "due_soon_7"
          | "due_soon_1";
        if (daysUntilDue <= 1) reminderType = "due_soon_1";
        else if (daysUntilDue <= 7) reminderType = "due_soon_7";
        else if (daysUntilDue <= 14) reminderType = "due_soon_14";
        else reminderType = "due_soon_30";

        await ctx.runMutation(internal.seedMet.createLoanReminder, {
          loanId,
          organizationId: orgId,
          reminderType,
          sentAt: now - oneDay,
          dueDate: endDate,
        });
        totalReminders++;
      }

      if (status === "active" && endDate < now) {
        await ctx.runMutation(internal.seedMet.createLoanReminder, {
          loanId,
          organizationId: orgId,
          reminderType: "overdue",
          sentAt: endDate + oneDay,
          dueDate: endDate,
        });
        totalReminders++;
      }
    }),
  );

  await Promise.all(
    Array.from({ length: 25 }, async (_, i) => {
      const account = borrowerAccounts[i % borrowerAccounts.length]!;
      const status = getRandomStatus();

      const startOffset = randomInt(-oneYear, oneMonth * 3);
      const startDate = now + startOffset;
      const loanDuration = randomInt(oneMonth * 3, oneYear);
      const endDate = startDate + loanDuration;

      const loanNumber = generateLoanNumber(
        new Date(startDate).getFullYear(),
        new Date(startDate).getMonth() + 1,
        loanIndex++,
      );

      const approvedAt =
        status !== "pending" ? startDate - oneDay * 7 : undefined;

      const loanId = await ctx.runMutation(internal.seedMet.createLoan, {
        organizationId: orgId,
        loanNumber,
        type: "outgoing",
        accountId: account._id,
        lenderBorrowerName:
          account.businessName ?? `${account.firstName} ${account.lastName}`,
        lenderBorrowerContact: account.contactPerson,
        startDate,
        endDate,
        status,
        terms: randomElement(LOAN_TERMS),
        insuranceValue: randomInt(50000, 5000000),
        approvedBy: status !== "pending" ? userId : undefined,
        approvedAt,
        notes: status === "pending" ? "Awaiting approval" : undefined,
        workflowStep: status === "pending" ? 0 : 2,
        assignedTo: userId,
        useDetailedConditionReports: Math.random() > 0.5,
      });

      totalLoans++;

      const numItems = randomInt(2, 5);
      const availableCollections = collections.filter(
        (c) => !usedCollectionIds.has(c._id),
      );
      const itemCollections = availableCollections.slice(0, numItems);

      await Promise.all(
        Array.from(itemCollections).map(async (collection) => {
          usedCollectionIds.add(collection._id);

          const conditionOut = randomElement(CONDITION_DESCRIPTIONS);
          const conditionIn =
            status === "returned"
              ? randomElement(CONDITION_DESCRIPTIONS)
              : undefined;

          const loanItemId = await ctx.runMutation(
            internal.seedMet.createLoanItem,
            {
              loanId,
              collectionId: collection._id,
              conditionOut,
              conditionIn,
              notes:
                Math.random() > 0.7
                  ? "Fragile - special handling required"
                  : undefined,
            },
          );

          totalLoanItems++;

          const conditionReportId = await ctx.runMutation(
            internal.seedMet.createConditionReport,
            {
              loanItemId,
              reportType: "out",
              conditionDescription: conditionOut,
              damages:
                Math.random() > 0.8
                  ? [
                      {
                        type: "wear",
                        location: "edges",
                        severity: "minor",
                        notes: "Age-related wear",
                      },
                    ]
                  : undefined,
              assessedBy: userId,
              assessedAt: startDate - oneDay,
            },
          );

          totalConditionReports++;

          if (status === "returned") {
            await ctx.runMutation(internal.seedMet.createConditionReport, {
              loanItemId,
              reportType: "in",
              conditionDescription: conditionIn!,
              assessedBy: userId,
              assessedAt: endDate,
            });
            totalConditionReports++;
          }

          await ctx.runMutation(internal.seedMet.createLoanItem, {
            loanId,
            collectionId: collection._id,
            conditionOut,
            conditionIn,
            notes:
              Math.random() > 0.7
                ? "Fragile - special handling required"
                : undefined,
            conditionReportId,
          });
        }),
      );

      if (status === "active" && Math.random() < 0.1) {
        const extensionDays = randomInt(30, 180);
        await ctx.runMutation(internal.seedMet.createLoanExtensionRequest, {
          loanId,
          organizationId: orgId,
          requestedBy: userId,
          requestedAt: now - oneDay * randomInt(1, 30),
          originalEndDate: endDate,
          newRequestedEndDate: endDate + extensionDays * oneDay,
          reason: randomElement(EXTENSION_REASONS),
          status: "pending",
        });
        totalExtensionRequests++;
      }

      const daysUntilDue = (endDate - now) / oneDay;
      if (status === "active" && daysUntilDue > 0 && daysUntilDue <= 30) {
        let reminderType:
          | "due_soon_30"
          | "due_soon_14"
          | "due_soon_7"
          | "due_soon_1";
        if (daysUntilDue <= 1) reminderType = "due_soon_1";
        else if (daysUntilDue <= 7) reminderType = "due_soon_7";
        else if (daysUntilDue <= 14) reminderType = "due_soon_14";
        else reminderType = "due_soon_30";

        await ctx.runMutation(internal.seedMet.createLoanReminder, {
          loanId,
          organizationId: orgId,
          reminderType,
          sentAt: now - oneDay,
          dueDate: endDate,
        });
        totalReminders++;
      }

      if (status === "active" && endDate < now) {
        await ctx.runMutation(internal.seedMet.createLoanReminder, {
          loanId,
          organizationId: orgId,
          reminderType: "overdue",
          sentAt: endDate + oneDay,
          dueDate: endDate,
        });
        totalReminders++;
      }
    }),
  );

  console.log(
    `  Created loans data: ${totalLoans} loans, ${totalLoanItems} loan items, ${totalConditionReports} condition reports, ${totalExtensionRequests} extension requests, ${totalReminders} reminders`,
  );
}

function generateAccessionNumber(year: number, index: number): string {
  return `ACC-${year}-${String(index).padStart(4, "0")}`;
}

function generateDeaccessionNumber(year: number, index: number): string {
  return `DEA-${year}-${String(index).padStart(4, "0")}`;
}

type AccessionStatus = "pending" | "approved" | "rejected";

function getAccessionStatus(): AccessionStatus {
  const rand = Math.random();
  if (rand < 0.6) return "approved";
  if (rand < 0.9) return "pending";
  return "rejected";
}

type DeaccessionStatus = "pending" | "approved" | "rejected";

function getDeaccessionStatus(): DeaccessionStatus {
  const rand = Math.random();
  if (rand < 0.5) return "approved";
  if (rand < 0.8) return "pending";
  return "rejected";
}

async function seedAccessionsData(
  ctx: ActionCtx,
  orgId: Id<"organizations">,
  userId: Id<"users">,
): Promise<void> {
  const [collections, accounts] = await Promise.all([
    ctx.runQuery(internal.seedMet.getCollections, {
      organizationId: orgId,
    }),
    ctx.runQuery(internal.seedMet.getAccounts, {
      organizationId: orgId,
    }),
  ] as const);
  const donorAccounts = accounts.filter(
    (a) =>
      a.accountType === "lender" ||
      a.accountType === "institution" ||
      a.accountType === "both",
  );

  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const oneYear = 365 * oneDay;

  let accessionIndex = 1;
  let totalAccessions = 0;
  let totalDeaccessions = 0;

  const _currentYear = new Date().getFullYear();

  await Promise.all(
    Array.from({ length: 50 }, async (_, i) => {
      const status = getAccessionStatus();
      const dateOffset = randomInt(-oneYear, oneDay * 30);
      const dateReceived = now + dateOffset;
      const year = new Date(dateReceived).getFullYear();

      const accessionNumber = generateAccessionNumber(year, accessionIndex++);
      const method = randomElement(ACCESSION_METHODS);
      const source = randomElement(ACCESSION_SOURCES);

      const hasDonorAccount =
        (method === "gift" || method === "donation" || method === "bequest") &&
        donorAccounts.length > 0 &&
        Math.random() > 0.3;
      const donorAccountId = hasDonorAccount
        ? randomElement(donorAccounts)._id
        : undefined;

      const linkToCollection =
        status === "approved" && collections.length > 0 && Math.random() > 0.4;
      const collectionId = linkToCollection
        ? collections[i % collections.length]?._id
        : undefined;

      const cost = method === "purchase" ? randomInt(5000, 500000) : undefined;

      const approvedAt =
        status !== "pending"
          ? dateReceived + oneDay * randomInt(1, 14)
          : undefined;

      let workflowHistory:
        | Array<{
            step: number;
            approvedBy: Id<"users">;
            approvedAt: number;
            comment?: string;
          }>
        | undefined;

      if (status === "approved") {
        workflowHistory = [
          {
            step: 0,
            approvedBy: userId,
            approvedAt: dateReceived + oneDay * 2,
            comment: "Initial review complete",
          },
          {
            step: 1,
            approvedBy: userId,
            approvedAt: dateReceived + oneDay * 5,
            comment: "Documentation verified",
          },
          {
            step: 2,
            approvedBy: userId,
            approvedAt: approvedAt!,
            comment: "Final approval granted",
          },
        ];
      } else if (status === "rejected") {
        workflowHistory = [
          {
            step: 0,
            approvedBy: userId,
            approvedAt: dateReceived + oneDay * 2,
            comment: "Initial review - concerns noted",
          },
          {
            step: 1,
            approvedBy: userId,
            approvedAt: approvedAt!,
            comment: "Rejected due to provenance concerns",
          },
        ];
      }

      const workflowStep =
        status === "pending" ? randomInt(0, 2) : status === "approved" ? 2 : 1;

      await ctx.runMutation(internal.seedMet.createAccession, {
        organizationId: orgId,
        collectionId,
        accessionNumber,
        dateReceived,
        source,
        donorAccountId,
        method,
        cost,
        approvedBy: status !== "pending" ? userId : undefined,
        approvedAt,
        status,
        notes:
          status === "pending"
            ? "Awaiting documentation review"
            : status === "rejected"
              ? "Rejected - provenance documentation insufficient"
              : undefined,
        assignedTo: userId,
        workflowStep,
        workflowHistory,
      });

      totalAccessions++;
    }),
  );

  let deaccessionIndex = 1;
  const collectionsForDeaccession = collections.slice(0, 15);

  for (let i = 0; i < 10; i++) {
    if (i >= collectionsForDeaccession.length) break;

    const collection = collectionsForDeaccession[i]!;
    const status = getDeaccessionStatus();
    const dateOffset = randomInt(-oneYear / 2, oneDay * 30);
    const dateDeaccessioned = now + dateOffset;
    const year = new Date(dateDeaccessioned).getFullYear();

    const deaccessionNumber = generateDeaccessionNumber(
      year,
      deaccessionIndex++,
    );
    const reason = randomElement(DEACCESSION_REASONS);
    const method = randomElement(DEACCESSION_METHODS);
    const disposition = randomElement(DEACCESSION_DISPOSITIONS);

    const approvedAt =
      status !== "pending"
        ? dateDeaccessioned + oneDay * randomInt(7, 30)
        : undefined;

    let workflowHistory:
      | Array<{
          step: number;
          approvedBy: Id<"users">;
          approvedAt: number;
          comment?: string;
        }>
      | undefined;

    if (status === "approved") {
      workflowHistory = [
        {
          step: 0,
          approvedBy: userId,
          approvedAt: dateDeaccessioned + oneDay * 3,
          comment: "Curator review complete - recommends deaccession",
        },
        {
          step: 1,
          approvedBy: userId,
          approvedAt: dateDeaccessioned + oneDay * 14,
          comment: "Board review approved",
        },
        {
          step: 2,
          approvedBy: userId,
          approvedAt: approvedAt!,
          comment: "Director final approval",
        },
      ];
    } else if (status === "rejected") {
      workflowHistory = [
        {
          step: 0,
          approvedBy: userId,
          approvedAt: dateDeaccessioned + oneDay * 3,
          comment: "Curator review - concerns about removing from collection",
        },
        {
          step: 1,
          approvedBy: userId,
          approvedAt: approvedAt!,
          comment: "Board rejected - item has significant historical value",
        },
      ];
    }

    const workflowStep =
      status === "pending" ? randomInt(0, 2) : status === "approved" ? 2 : 1;

    const proceedsAmount =
      status === "approved" && method === "sale"
        ? randomInt(10000, 1000000)
        : undefined;

    await ctx.runMutation(internal.seedMet.createDeaccession, {
      organizationId: orgId,
      collectionId: collection._id,
      deaccessionNumber,
      dateDeaccessioned,
      reason,
      method,
      disposition: status === "approved" ? disposition : undefined,
      approvedBy: status !== "pending" ? userId : undefined,
      approvedAt,
      status,
      notes:
        status === "pending"
          ? "Awaiting board review"
          : status === "rejected"
            ? "Rejected by board - item to remain in collection"
            : undefined,
      workflowStep,
      workflowHistory,
      assignedTo: userId,
      proceedsAmount,
      proceedsCurrency: proceedsAmount ? "USD" : undefined,
    });

    totalDeaccessions++;
  }

  console.log(
    `  Created accessions data: ${totalAccessions} accessions, ${totalDeaccessions} deaccessions`,
  );
}

function generatePolicyNumberUnique(
  carrier: string,
  year: number,
  index: number,
): string {
  const prefix = carrier.substring(0, 3).toUpperCase();
  return `${prefix}-${year}-${String(index).padStart(6, "0")}`;
}

function generateClaimNumber(year: number, index: number): string {
  return `CLM-${year}-${String(index).padStart(4, "0")}`;
}

async function seedInsuranceData(
  ctx: ActionCtx,
  orgId: Id<"organizations">,
  userId: Id<"users">,
): Promise<void> {
  const [collections, loans, exhibitions] = await Promise.all([
    ctx.runQuery(internal.seedMet.getCollections, {
      organizationId: orgId,
    }),
    ctx.runQuery(internal.seedMet.getLoans, {
      organizationId: orgId,
    }),
    ctx.runQuery(internal.seedMet.getExhibitions, {
      organizationId: orgId,
    }),
  ] as const);
  if (collections.length === 0) {
    console.log("  No collections found, skipping insurance seeding");
    return;
  }

  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const oneYear = 365 * oneDay;
  const currentYear = new Date().getFullYear();

  let totalAppraisals = 0;
  let totalPolicies = 0;
  let totalCoverages = 0;
  let totalClaims = 0;

  const appraisalIds: Map<string, Id<"appraisals">> = new Map();
  const collectionsToAppraise = collections.slice(
    0,
    Math.ceil(collections.length * 0.5),
  );

  await Promise.all(
    Array.from(collectionsToAppraise).map(async (collection) => {
      const appraiserData =
        APPRAISER_COMPANIES[
          Math.floor(Math.random() * APPRAISER_COMPANIES.length)
        ]!;
      const appraisalType =
        APPRAISAL_TYPES[Math.floor(Math.random() * APPRAISAL_TYPES.length)]!;
      const appraisalDate = now - randomInt(oneDay * 30, oneYear);
      const value = randomInt(10000, 5000000);

      const appraisalId = await ctx.runMutation(
        internal.seedMet.createAppraisal,
        {
          organizationId: orgId,
          collectionId: collection._id,
          appraisalDate,
          appraiserName: appraiserData.name.split(" ")[0]!,
          appraiserCompany: appraiserData.name,
          appraiserCredentials: appraiserData.credentials,
          appraisalType,
          value,
          currency: "USD",
          notes:
            Math.random() > 0.7
              ? `Appraisal conducted for ${appraisalType} purposes`
              : undefined,
          createdBy: userId,
          validUntil: appraisalDate + oneYear * 2,
          isCurrentAppraisal: true,
        },
      );

      appraisalIds.set(collection._id, appraisalId);
      totalAppraisals++;
    }),
  );

  console.log(`  Created ${totalAppraisals} appraisals`);

  const policyIds: Id<"insurancePolicies">[] = [];
  let policyIndex = 1;

  await Promise.all(
    Array.from(POLICY_TYPES).map(async (policyType) => {
      const carrierData =
        INSURANCE_CARRIER_DATA[policyIndex % INSURANCE_CARRIER_DATA.length]!;
      const effectiveDate = now - randomInt(0, oneYear / 2);
      const expirationDate = effectiveDate + oneYear;
      const coverageAmount = randomInt(1000000, 50000000);

      const status =
        expirationDate < now
          ? ("expired" as const)
          : effectiveDate > now
            ? ("pending" as const)
            : ("active" as const);

      const policyId = await ctx.runMutation(
        internal.seedMet.createInsurancePolicy,
        {
          organizationId: orgId,
          policyNumber: generatePolicyNumberUnique(
            carrierData.carrier,
            currentYear,
            policyIndex,
          ),
          carrier: carrierData.carrier,
          carrierContact: carrierData.contact,
          carrierPhone: carrierData.phone,
          carrierEmail: carrierData.email,
          policyType,
          coverageAmount,
          deductible: randomInt(1000, 25000),
          perItemLimit: Math.floor(coverageAmount / 10),
          premiumAmount: Math.floor(coverageAmount * 0.005),
          premiumFrequency: "annual",
          effectiveDate,
          expirationDate,
          status,
          territory: policyType === "transit" ? "Worldwide" : "North America",
          notes: `${policyType.charAt(0).toUpperCase() + policyType.slice(1)} coverage policy`,
          createdBy: userId,
        },
      );

      policyIds.push(policyId);
      policyIndex++;
      totalPolicies++;
    }),
  );

  console.log(`  Created ${totalPolicies} insurance policies`);

  const _blanketPolicy = policyIds[0]!;
  const scheduledPolicy = policyIds[1]!;
  const exhibitionPolicy = policyIds[2]!;
  const _transitPolicy = policyIds[3]!;
  const loanPolicy = policyIds[4]!;
  await Promise.all([
    Promise.all(
      Array.from(collectionsToAppraise.slice(0, 20)).map(async (collection) => {
        const appraisalId = appraisalIds.get(collection._id);
        const coveredValue = randomInt(10000, 2000000);
        await ctx.runMutation(internal.seedMet.createInsuranceCoverage, {
          organizationId: orgId,
          policyId: scheduledPolicy,
          collectionId: collection._id,
          coveredValue,
          status: "active",
          verified: true,
          appraisalId,
          notes: "Scheduled item coverage",
          createdBy: userId,
        });
        totalCoverages++;
      }),
    ),
    Promise.all(
      Array.from(loans.slice(0, 10)).map(async (loan) => {
        const coveredValue = loan.insuranceValue ?? randomInt(50000, 1000000);
        await ctx.runMutation(internal.seedMet.createInsuranceCoverage, {
          organizationId: orgId,
          policyId: loanPolicy,
          loanId: loan._id,
          coveredValue,
          status: loan.status === "returned" ? "expired" : "active",
          verified: true,
          notes: `Coverage for ${loan.type} loan ${loan.loanNumber}`,
          createdBy: userId,
        });
        totalCoverages++;
      }),
    ),
    Promise.all(
      Array.from(exhibitions.slice(0, 5)).map(async (exhibition) => {
        const coveredValue = randomInt(500000, 10000000);
        await ctx.runMutation(internal.seedMet.createInsuranceCoverage, {
          organizationId: orgId,
          policyId: exhibitionPolicy,
          exhibitionId: exhibition._id,
          coveredValue,
          status: exhibition.status === "closed" ? "expired" : "active",
          verified: true,
          notes: `Exhibition coverage for "${exhibition.title}"`,
          createdBy: userId,
        });
        totalCoverages++;
      }),
    ),
  ] as const);

  console.log(`  Created ${totalCoverages} insurance coverages`);

  const numClaims = randomInt(3, 5);
  let claimIndex = 1;

  await Promise.all(
    Array.from({ length: numClaims }, async (_, _i) => {
      const policyId = policyIds[Math.floor(Math.random() * policyIds.length)]!;
      const incidentType =
        INCIDENT_TYPES[Math.floor(Math.random() * INCIDENT_TYPES.length)]!;
      const incidentDate = now - randomInt(oneDay * 7, oneYear);
      const reportedDate = incidentDate + randomInt(oneDay, oneDay * 3);

      const claimedAmount = randomInt(5000, 500000);
      const statusRand = Math.random();
      let status: (typeof CLAIM_STATUSES)[number];
      let assessedAmount: number | undefined;
      let settledAmount: number | undefined;
      let submittedDate: number | undefined;
      let decisionDate: number | undefined;
      let settlementDate: number | undefined;
      let denialReason: string | undefined;

      if (statusRand < 0.15) {
        status = "draft";
      } else if (statusRand < 0.3) {
        status = "submitted";
        submittedDate = reportedDate + oneDay * 2;
      } else if (statusRand < 0.45) {
        status = "under_review";
        submittedDate = reportedDate + oneDay * 2;
      } else if (statusRand < 0.6) {
        status = "approved";
        submittedDate = reportedDate + oneDay * 2;
        decisionDate = submittedDate + oneDay * randomInt(7, 30);
        assessedAmount = Math.floor(
          claimedAmount * (0.7 + Math.random() * 0.3),
        );
      } else if (statusRand < 0.75) {
        status = "settled";
        submittedDate = reportedDate + oneDay * 2;
        decisionDate = submittedDate + oneDay * randomInt(7, 30);
        assessedAmount = Math.floor(
          claimedAmount * (0.7 + Math.random() * 0.3),
        );
        settlementDate = decisionDate + oneDay * randomInt(14, 60);
        settledAmount = Math.floor(
          assessedAmount * (0.8 + Math.random() * 0.2),
        );
      } else if (statusRand < 0.85) {
        status = "denied";
        submittedDate = reportedDate + oneDay * 2;
        decisionDate = submittedDate + oneDay * randomInt(7, 30);
        denialReason = "Claim falls outside policy coverage terms";
      } else {
        status = "closed";
        submittedDate = reportedDate + oneDay * 2;
        decisionDate = submittedDate + oneDay * randomInt(7, 30);
        assessedAmount = Math.floor(
          claimedAmount * (0.7 + Math.random() * 0.3),
        );
        settlementDate = decisionDate + oneDay * randomInt(14, 60);
        settledAmount = Math.floor(
          assessedAmount * (0.8 + Math.random() * 0.2),
        );
      }

      const affectedCollections = collections
        .slice(0, randomInt(1, 3))
        .map((c) => c._id);
      const adjuster =
        ADJUSTER_NAMES[Math.floor(Math.random() * ADJUSTER_NAMES.length)]!;
      const incidentDescription =
        INCIDENT_DESCRIPTIONS[
          Math.floor(Math.random() * INCIDENT_DESCRIPTIONS.length)
        ]!;

      await ctx.runMutation(internal.seedMet.createInsuranceClaim, {
        organizationId: orgId,
        policyId,
        claimNumber: generateClaimNumber(currentYear, claimIndex),
        collectionIds: affectedCollections,
        incidentDate,
        incidentLocation: "Main Gallery",
        incidentType,
        incidentDescription,
        claimedAmount,
        assessedAmount,
        settledAmount,
        deductibleApplied:
          status === "settled" || status === "closed"
            ? randomInt(1000, 10000)
            : undefined,
        status,
        reportedDate,
        submittedDate,
        decisionDate,
        settlementDate,
        adjusterName: status !== "draft" ? adjuster : undefined,
        adjusterPhone: status !== "draft" ? "+1-555-0100" : undefined,
        adjusterEmail:
          status !== "draft"
            ? `${adjuster.toLowerCase().replace(" ", ".")}@adjusters.com`
            : undefined,
        denialReason,
        internalNotes:
          Math.random() > 0.5
            ? "Claim processed according to standard procedures"
            : undefined,
        createdBy: userId,
      });

      claimIndex++;
      totalClaims++;
    }),
  );

  console.log(`  Created ${totalClaims} insurance claims`);
  console.log(
    `  Insurance data complete: ${totalAppraisals} appraisals, ${totalPolicies} policies, ${totalCoverages} coverages, ${totalClaims} claims`,
  );
}

type ExhibitionStatus =
  | "proposed"
  | "approved"
  | "installing"
  | "active"
  | "deinstalling"
  | "closed";

function getExhibitionStatus(
  startDate: number,
  endDate: number,
): ExhibitionStatus {
  const now = Date.now();
  if (startDate > now) return "approved";
  if (endDate && endDate < now) return "closed";
  return "active";
}

async function seedExhibitionsData(
  ctx: ActionCtx,
  orgId: Id<"organizations">,
  userId: Id<"users">,
): Promise<void> {
  const [collections, locations] = await Promise.all([
    ctx.runQuery(internal.seedMet.getCollections, {
      organizationId: orgId,
    }),
    ctx.runQuery(internal.seedMet.getLocations, {
      organizationId: orgId,
    }),
  ] as const);
  if (collections.length === 0) {
    console.log("  No collections found, skipping exhibitions seeding");
    return;
  }

  const galleryLocations = locations.filter(
    (l) => l.type === "room" && l.name.includes("Gallery"),
  );

  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const oneMonth = 30 * oneDay;
  const oneYear = 365 * oneDay;

  let totalExhibitions = 0;
  let totalExhibitionObjects = 0;
  let totalInstallationTasks = 0;

  const numExhibitions = Math.min(15, collections.length);
  const collectionsForExhibitions = collections.slice(0, numExhibitions * 3);

  await Promise.all(
    Array.from({ length: numExhibitions }, async (_, i) => {
      const title = EXHIBITION_TITLES[i % EXHIBITION_TITLES.length]!;
      const venue = EXHIBITION_VENUES[i % EXHIBITION_VENUES.length]!;
      const primaryCollection = collectionsForExhibitions[i]!;

      const startOffset = randomInt(-oneYear, oneMonth * 6);
      const startDate = now + startOffset;
      const duration = randomInt(oneMonth * 2, oneMonth * 6);
      const endDate = startDate + duration;

      const status = getExhibitionStatus(startDate, endDate);
      const isCurrent = status === "active";
      const locationId =
        galleryLocations.length > 0
          ? galleryLocations[i % galleryLocations.length]!._id
          : undefined;

      const exhibitionId = await ctx.runMutation(
        internal.seedMet.createExhibition,
        {
          organizationId: orgId,
          collectionId: primaryCollection._id,
          title,
          location: venue,
          locationId,
          startDate,
          endDate,
          isCurrent,
          isLoan: Math.random() > 0.8,
          loanVenue: Math.random() > 0.8 ? "Partner Museum" : undefined,
          notes: `Exhibition featuring ${primaryCollection.title}`,
          status,
          workflowStep: status === "proposed" ? 0 : 2,
          approvedBy: status !== "proposed" ? userId : undefined,
          approvedAt:
            status !== "proposed" ? startDate - oneDay * 30 : undefined,
          createdBy: userId,
        },
      );

      totalExhibitions++;

      const numObjects = randomInt(3, 8);
      const startIdx = i * 3;
      const objectCollections = collectionsForExhibitions.slice(
        startIdx,
        startIdx + numObjects,
      );

      await Promise.all(
        Array.from(objectCollections).map(async (collection) => {
          const objectStatus =
            status === "closed"
              ? "returned"
              : status === "active"
                ? "installed"
                : "pending";

          await ctx.runMutation(internal.seedMet.createExhibitionObject, {
            exhibitionId,
            organizationId: orgId,
            collectionId: collection._id,
            originalLocationId: locationId,
            exhibitionLocationId: locationId,
            installedAt:
              objectStatus === "installed" || objectStatus === "returned"
                ? startDate
                : undefined,
            installedBy:
              objectStatus === "installed" || objectStatus === "returned"
                ? userId
                : undefined,
            installationNotes:
              Math.random() > 0.7
                ? "Installed per curator specifications"
                : undefined,
            conditionAtInstallation:
              objectStatus !== "pending"
                ? randomElement(CONDITION_DESCRIPTIONS)
                : undefined,
            deinstalledAt: objectStatus === "returned" ? endDate : undefined,
            deinstalledBy: objectStatus === "returned" ? userId : undefined,
            conditionAtDeinstallation:
              objectStatus === "returned"
                ? randomElement(CONDITION_DESCRIPTIONS)
                : undefined,
            returnedToOriginalLocation: objectStatus === "returned",
            returnedAt:
              objectStatus === "returned" ? endDate + oneDay : undefined,
            status: objectStatus,
          });

          totalExhibitionObjects++;
        }),
      );

      if (
        status === "approved" ||
        status === "installing" ||
        status === "active"
      ) {
        const numTasks = randomInt(5, 10);
        const selectedTasks = INSTALLATION_TASKS.toSorted(
          () => Math.random() - 0.5,
        ).slice(0, numTasks);

        await Promise.all(
          Array.from(selectedTasks).map(async (task) => {
            const taskStatus =
              status === "active"
                ? "completed"
                : status === "installing"
                  ? Math.random() > 0.5
                    ? "completed"
                    : "in_progress"
                  : "todo";

            await ctx.runMutation(internal.seedMet.createInstallationTask, {
              organizationId: orgId,
              exhibitionId,
              title: task.title,
              description: `${task.title} for ${title}`,
              taskType: task.type,
              status: taskStatus,
              priority: Math.random() > 0.7 ? "high" : "medium",
              assigneeId: userId,
              dueDate: startDate - oneDay * randomInt(1, 14),
              completedAt:
                taskStatus === "completed"
                  ? startDate - oneDay * randomInt(1, 7)
                  : undefined,
              completedBy: taskStatus === "completed" ? userId : undefined,
              estimatedHours: task.hours,
              actualHours:
                taskStatus === "completed"
                  ? task.hours + randomInt(-1, 2)
                  : undefined,
              notes: Math.random() > 0.8 ? "Completed as specified" : undefined,
              createdBy: userId,
            });

            totalInstallationTasks++;
          }),
        );
      }
    }),
  );

  console.log(
    `  Created exhibitions data: ${totalExhibitions} exhibitions, ${totalExhibitionObjects} exhibition objects, ${totalInstallationTasks} installation tasks`,
  );
}

async function seedConservationData(
  ctx: ActionCtx,
  orgId: Id<"organizations">,
  userId: Id<"users">,
): Promise<void> {
  const [collections, locations] = await Promise.all([
    ctx.runQuery(internal.seedMet.getCollections, {
      organizationId: orgId,
    }),
    ctx.runQuery(internal.seedMet.getLocations, {
      organizationId: orgId,
    }),
  ] as const);
  if (collections.length === 0) {
    console.log("  No collections found, skipping conservation seeding");
    return;
  }

  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const oneMonth = 30 * oneDay;
  const oneYear = 365 * oneDay;

  let totalTreatments = 0;
  let totalAlerts = 0;
  let totalSchedules = 0;
  let totalReadings = 0;

  const collectionsForTreatments = collections.slice(
    0,
    Math.min(30, collections.length),
  );

  await Promise.all(
    Array.from(collectionsForTreatments).map(async (collection) => {
      const numTreatments = randomInt(1, 3);
      const selectedTreatments = CONSERVATION_TREATMENTS.toSorted(
        () => Math.random() - 0.5,
      ).slice(0, numTreatments);

      await Promise.all(
        Array.from(selectedTreatments).map(async (treatment) => {
          const performedAt = now - randomInt(oneDay * 30, oneYear * 2);
          const statusRand = Math.random();
          const status =
            statusRand < 0.7
              ? ("completed" as const)
              : statusRand < 0.9
                ? ("in_progress" as const)
                : ("proposed" as const);

          await ctx.runMutation(internal.seedMet.createConservationTreatment, {
            collectionId: collection._id,
            organizationId: orgId,
            treatmentType: treatment.type,
            title: treatment.title,
            description: `${treatment.title} for ${collection.title}`,
            performedBy: userId,
            performedByName: "Conservation Staff",
            performedAt,
            notes:
              status === "completed"
                ? "Treatment completed successfully"
                : status === "in_progress"
                  ? "Treatment ongoing"
                  : undefined,
            status,
            workflowStep:
              status === "completed" ? 2 : status === "in_progress" ? 1 : 0,
            approvedBy: status !== "proposed" ? userId : undefined,
            approvedAt:
              status !== "proposed" ? performedAt - oneDay * 7 : undefined,
            createdBy: userId,
            laborHours: treatment.hours,
            laborRate: 75,
            laborCost: treatment.hours * 75,
            materialsCost: Math.floor(treatment.cost * 0.3),
            totalCost: treatment.cost,
            currency: "USD",
          });

          totalTreatments++;
        }),
      );
    }),
  );

  const collectionsForAlerts = collections.slice(0, 10);
  await Promise.all(
    Array.from(collectionsForAlerts).map(async (collection) => {
      const alertType =
        ALERT_TYPES[Math.floor(Math.random() * ALERT_TYPES.length)]!;
      const alertTitle =
        ALERT_TITLES[Math.floor(Math.random() * ALERT_TITLES.length)]!;
      const priorityRand = Math.random();
      const priority =
        priorityRand < 0.1
          ? ("critical" as const)
          : priorityRand < 0.3
            ? ("high" as const)
            : priorityRand < 0.6
              ? ("medium" as const)
              : ("low" as const);

      const statusRand = Math.random();
      const status =
        statusRand < 0.3
          ? ("active" as const)
          : statusRand < 0.6
            ? ("acknowledged" as const)
            : statusRand < 0.9
              ? ("resolved" as const)
              : ("dismissed" as const);

      await ctx.runMutation(internal.seedMet.createConservationAlert, {
        organizationId: orgId,
        collectionId: collection._id,
        alertType,
        title: alertTitle,
        description: `${alertTitle} for ${collection.title}`,
        priority,
        status,
        acknowledgedBy: status !== "active" ? userId : undefined,
        acknowledgedAt:
          status !== "active" ? now - randomInt(oneDay, oneMonth) : undefined,
        resolvedBy: status === "resolved" ? userId : undefined,
        resolvedAt:
          status === "resolved"
            ? now - randomInt(oneDay, oneDay * 14)
            : undefined,
        resolutionNotes:
          status === "resolved" ? "Issue addressed and resolved" : undefined,
        createdBy: userId,
      });

      totalAlerts++;
    }),
  );

  await Promise.all(
    Array.from(ASSESSMENT_SCHEDULES).map(async (schedule) => {
      const lastCompleted =
        now - randomInt(oneDay, schedule.intervalDays * oneDay);
      const nextDue = lastCompleted + schedule.intervalDays * oneDay;

      await ctx.runMutation(internal.seedMet.createAssessmentSchedule, {
        organizationId: orgId,
        name: schedule.name,
        description: `${schedule.name} for collection objects`,
        intervalDays: schedule.intervalDays,
        assessmentType: schedule.type,
        nextDueDate: nextDue,
        lastCompletedDate: lastCompleted,
        lastCompletedBy: userId,
        isActive: true,
        assignedTo: userId,
        reminderDaysBefore: 7,
        createdBy: userId,
      });

      totalSchedules++;
    }),
  );

  const galleryLocations = locations.filter((l) => l.type === "room");
  const numReadingsPerLocation = 24;

  await Promise.all(
    Array.from(galleryLocations.slice(0, 5)).map(async (location) => {
      await Promise.all(
        Array.from({ length: numReadingsPerLocation }, async (_, i) => {
          const recordedAt = now - i * 60 * 60 * 1000;
          const baseTemp = 20;
          const baseHumidity = 45;

          await ctx.runMutation(internal.seedMet.createEnvironmentalReading, {
            organizationId: orgId,
            locationId: location._id,
            temperature: baseTemp + (Math.random() * 4 - 2),
            humidity: baseHumidity + (Math.random() * 10 - 5),
            lightLevel: randomInt(50, 200),
            uvLevel: Math.random() * 50,
            recordedAt,
            recordedBy: Math.random() > 0.8 ? userId : undefined,
            source: Math.random() > 0.8 ? "manual" : "sensor",
            sensorId:
              Math.random() > 0.8
                ? undefined
                : `SENSOR-${location._id.slice(-4)}`,
            notes:
              Math.random() > 0.95
                ? "Unusual reading - verified manually"
                : undefined,
          });

          totalReadings++;
        }),
      );
    }),
  );

  console.log(
    `  Created conservation data: ${totalTreatments} treatments, ${totalAlerts} alerts, ${totalSchedules} schedules, ${totalReadings} environmental readings`,
  );
}

function generateTransitNumber(year: number, index: number): string {
  return `TRN-${year}-${String(index).padStart(4, "0")}`;
}

async function seedTransitData(
  ctx: ActionCtx,
  orgId: Id<"organizations">,
  userId: Id<"users">,
): Promise<void> {
  const [collections, loans] = await Promise.all([
    ctx.runQuery(internal.seedMet.getCollections, {
      organizationId: orgId,
    }),
    ctx.runQuery(internal.seedMet.getLoans, {
      organizationId: orgId,
    }),
  ] as const);
  if (collections.length === 0) {
    console.log("  No collections found, skipping transit seeding");
    return;
  }

  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const oneMonth = 30 * oneDay;
  const currentYear = new Date().getFullYear();

  let totalTransitRecords = 0;
  let totalTransitItems = 0;
  let totalStatusUpdates = 0;

  const numTransits = 20;
  let transitIndex = 1;

  for (let i = 0; i < numTransits; i++) {
    const carrier = TRANSIT_CARRIERS[i % TRANSIT_CARRIERS.length]!;
    const origin = TRANSIT_LOCATIONS[i % TRANSIT_LOCATIONS.length]!;
    const destination = TRANSIT_LOCATIONS[(i + 1) % TRANSIT_LOCATIONS.length]!;

    const transitType =
      i < 5
        ? ("outgoing" as const)
        : i < 10
          ? ("incoming" as const)
          : i < 15
            ? ("internal" as const)
            : ("return" as const);

    const scheduledPickup = now - randomInt(0, oneMonth * 3);
    const actualPickup =
      Math.random() > 0.2
        ? scheduledPickup + randomInt(-oneDay, oneDay * 2)
        : undefined;
    const estimatedDelivery = scheduledPickup + randomInt(oneDay, oneDay * 7);

    const statusRand = Math.random();
    let status: (typeof TRANSIT_STATUSES)[number];
    let actualDelivery: number | undefined;

    if (statusRand < 0.1) {
      status = "draft";
    } else if (statusRand < 0.2) {
      status = "scheduled";
    } else if (statusRand < 0.4) {
      status = "in_transit";
    } else if (statusRand < 0.5) {
      status = "out_for_delivery";
    } else {
      status = "delivered";
      actualDelivery = estimatedDelivery + randomInt(-oneDay, oneDay * 2);
    }

    const numHandling = randomInt(1, 4);
    const specialHandling = SPECIAL_HANDLING.toSorted(
      () => Math.random() - 0.5,
    ).slice(0, numHandling);

    const numItems = randomInt(1, 4);
    const transitCollections = collections
      .slice(i * 3, i * 3 + numItems)
      .map((c) => c._id);

    const associatedLoan =
      transitType !== "internal" && loans.length > 0 && Math.random() > 0.5
        ? loans[i % loans.length]!._id
        : undefined;

    const transitRecordId = await ctx.runMutation(
      internal.seedMet.createTransitRecord,
      {
        organizationId: orgId,
        transitNumber: generateTransitNumber(currentYear, transitIndex++),
        collectionIds: transitCollections,
        loanId: associatedLoan,
        transitType,
        originName: origin.name,
        originAddress: origin.address,
        originContact: carrier.contact,
        destinationName: destination.name,
        destinationAddress: destination.address,
        destinationContact: "Receiving Department",
        carrier: carrier.name,
        carrierContact: carrier.contact,
        carrierType: carrier.type,
        trackingNumber:
          status !== "draft"
            ? `TRK${String(Math.random()).slice(2, 14)}`
            : undefined,
        scheduledPickupDate: scheduledPickup,
        actualPickupDate: actualPickup,
        estimatedDeliveryDate: estimatedDelivery,
        actualDeliveryDate: actualDelivery,
        status,
        packageCount: numItems,
        totalWeight: randomInt(10, 200),
        weightUnit: "kg",
        specialHandling,
        insuranceValue: randomInt(50000, 2000000),
        shippingCost: randomInt(500, 10000),
        currency: "USD",
        conditionAtPickup:
          actualPickup !== undefined
            ? randomElement(CONDITION_DESCRIPTIONS)
            : undefined,
        conditionAtDelivery:
          status === "delivered"
            ? randomElement(CONDITION_DESCRIPTIONS)
            : undefined,
        notes:
          Math.random() > 0.7
            ? "Standard transit procedures followed"
            : undefined,
        createdBy: userId,
      },
    );

    totalTransitRecords++;

    await Promise.all(
      Array.from({ length: transitCollections.length }, async (_, j) => {
        const collectionId = transitCollections[j]!;
        const itemStatus =
          status === "delivered"
            ? ("delivered" as const)
            : status === "in_transit" || status === "out_for_delivery"
              ? ("in_transit" as const)
              : ("pending" as const);

        await ctx.runMutation(internal.seedMet.createTransitItem, {
          transitRecordId,
          collectionId,
          conditionAtPickup:
            actualPickup !== undefined
              ? randomElement(CONDITION_DESCRIPTIONS)
              : undefined,
          conditionAtDelivery:
            itemStatus === "delivered"
              ? randomElement(CONDITION_DESCRIPTIONS)
              : undefined,
          packingNotes:
            Math.random() > 0.7 ? "Custom crate with foam padding" : undefined,
          specialHandling: specialHandling.slice(0, randomInt(1, 2)),
          status: itemStatus,
          notes: undefined,
        });

        totalTransitItems++;
      }),
    );

    if (status !== "draft") {
      const statusSequence: Array<{
        status: (typeof TRANSIT_STATUSES)[number];
        offset: number;
        location: string;
        description: string;
      }> = [
        {
          status: "scheduled",
          offset: 0,
          location: origin.name,
          description: "Shipment scheduled for pickup",
        },
      ];

      if (actualPickup !== undefined) {
        statusSequence.push({
          status: "in_transit",
          offset: (actualPickup - scheduledPickup) / oneDay,
          location: origin.name,
          description: "Package picked up and in transit",
        });
      }

      if (status === "out_for_delivery" || status === "delivered") {
        statusSequence.push({
          status: "out_for_delivery",
          offset: (estimatedDelivery - scheduledPickup) / oneDay - 0.5,
          location: destination.name,
          description: "Package out for delivery",
        });
      }

      if (status === "delivered") {
        statusSequence.push({
          status: "delivered",
          offset:
            ((actualDelivery ?? estimatedDelivery) - scheduledPickup) / oneDay,
          location: destination.name,
          description: "Package delivered successfully",
        });
      }

      await Promise.all(
        Array.from(statusSequence).map(async (update) => {
          const reportedAt = scheduledPickup + update.offset * oneDay;

          await ctx.runMutation(internal.seedMet.createTransitStatusUpdate, {
            transitRecordId,
            status: update.status,
            location: update.location,
            description: update.description,
            temperature: 20 + Math.random() * 4 - 2,
            humidity: 45 + Math.random() * 10 - 5,
            reportedBy: Math.random() > 0.5 ? userId : undefined,
            reportedByName: Math.random() > 0.5 ? carrier.contact : undefined,
            reportedAt,
            notes: undefined,
          });

          totalStatusUpdates++;
        }),
      );
    }
  }

  console.log(
    `  Created transit data: ${totalTransitRecords} transit records, ${totalTransitItems} transit items, ${totalStatusUpdates} status updates`,
  );
}

// ========================================
// PHASE 11: LIBRARY MODULE DATA
// ========================================

const LIBRARY_BOOKS = [
  {
    title: "The Art of Ancient Egypt",
    author: "Gay Robins",
    isbn: "978-0674030657",
    publisher: "Harvard University Press",
    year: 2008,
    subjects: ["Egyptian Art", "Ancient History", "Archaeology"],
    pages: 288,
  },
  {
    title: "A History of Western Art",
    author: "Laurie Schneider Adams",
    isbn: "978-0073379227",
    publisher: "McGraw-Hill",
    year: 2010,
    subjects: ["Art History", "Western Art", "Visual Arts"],
    pages: 624,
  },
  {
    title: "Museum Studies: An Anthology of Contexts",
    author: "Bettina Messias Carbonell",
    isbn: "978-1405173810",
    publisher: "Wiley-Blackwell",
    year: 2012,
    subjects: ["Museum Studies", "Curation", "Cultural Heritage"],
    pages: 608,
  },
  {
    title: "The Museum Experience Revisited",
    author: "John H. Falk",
    isbn: "978-1611320459",
    publisher: "Routledge",
    year: 2012,
    subjects: ["Museum Studies", "Visitor Experience", "Education"],
    pages: 416,
  },
  {
    title: "Conservation of Easel Paintings",
    author: "Joyce Hill Stoner",
    isbn: "978-0750681995",
    publisher: "Butterworth-Heinemann",
    year: 2012,
    subjects: ["Conservation", "Painting", "Restoration"],
    pages: 872,
  },
  {
    title: "Preventive Conservation in Museums",
    author: "Chris Caple",
    isbn: "978-0415579704",
    publisher: "Routledge",
    year: 2011,
    subjects: ["Conservation", "Museum Management", "Preservation"],
    pages: 352,
  },
  {
    title: "The Manual of Museum Exhibitions",
    author: "Barry Lord",
    isbn: "978-0759122338",
    publisher: "AltaMira Press",
    year: 2014,
    subjects: ["Exhibition Design", "Museum Management", "Curation"],
    pages: 640,
  },
  {
    title: "Collecting the Pre-Columbian Past",
    author: "Elizabeth Hill Boone",
    isbn: "978-0884021926",
    publisher: "Dumbarton Oaks",
    year: 1993,
    subjects: ["Pre-Columbian Art", "Collecting", "Latin America"],
    pages: 352,
  },
  {
    title: "Japanese Art and Design",
    author: "Greg Irvine",
    isbn: "978-1851778171",
    publisher: "V&A Publishing",
    year: 2016,
    subjects: ["Japanese Art", "Design", "Asian Studies"],
    pages: 224,
  },
  {
    title: "African Art: A Century at the Brooklyn Museum",
    author: "Susan Vogel",
    isbn: "978-3791348759",
    publisher: "Prestel",
    year: 2009,
    subjects: ["African Art", "Museum Collections", "Cultural Heritage"],
    pages: 288,
  },
  {
    title: "Renaissance Art: A Very Short Introduction",
    author: "Geraldine A. Johnson",
    isbn: "978-0192803542",
    publisher: "Oxford University Press",
    year: 2005,
    subjects: ["Renaissance", "Art History", "European Art"],
    pages: 152,
  },
  {
    title: "The Art of the Islamic Garden",
    author: "Emma Clark",
    isbn: "978-1847972040",
    publisher: "Crowood Press",
    year: 2010,
    subjects: ["Islamic Art", "Garden Design", "Architecture"],
    pages: 224,
  },
  {
    title: "Photography and the Art Market",
    author: "Juliet Hacking",
    isbn: "978-1848221185",
    publisher: "Lund Humphries",
    year: 2018,
    subjects: ["Photography", "Art Market", "Collecting"],
    pages: 224,
  },
  {
    title: "Textiles: A World Tour",
    author: "Catherine Legrand",
    isbn: "978-0500291801",
    publisher: "Thames & Hudson",
    year: 2012,
    subjects: ["Textiles", "Design", "Cultural Heritage"],
    pages: 336,
  },
  {
    title: "Arms and Armor of the Medieval Knight",
    author: "David Edge",
    isbn: "978-0517643259",
    publisher: "Crescent Books",
    year: 1988,
    subjects: ["Medieval History", "Arms and Armor", "Military History"],
    pages: 192,
  },
];

const MEMBERSHIP_TYPES_DATA = [
  {
    name: "Student",
    code: "STU",
    duration: 365,
    fee: 0,
    maxCheckouts: 5,
    maxHolds: 3,
    loanPeriod: 14,
    maxRenewals: 2,
    finePerDay: 0.1,
    maxFine: 5,
  },
  {
    name: "Staff",
    code: "STF",
    duration: 365,
    fee: 0,
    maxCheckouts: 20,
    maxHolds: 10,
    loanPeriod: 28,
    maxRenewals: 5,
    finePerDay: 0,
    maxFine: 0,
  },
  {
    name: "Researcher",
    code: "RES",
    duration: 365,
    fee: 50,
    maxCheckouts: 15,
    maxHolds: 8,
    loanPeriod: 60,
    maxRenewals: 3,
    finePerDay: 0.25,
    maxFine: 25,
  },
  {
    name: "Public",
    code: "PUB",
    duration: 365,
    fee: 25,
    maxCheckouts: 10,
    maxHolds: 5,
    loanPeriod: 21,
    maxRenewals: 2,
    finePerDay: 0.25,
    maxFine: 10,
  },
  {
    name: "Institutional",
    code: "INS",
    duration: 365,
    fee: 200,
    maxCheckouts: 50,
    maxHolds: 25,
    loanPeriod: 90,
    maxRenewals: 5,
    finePerDay: 1,
    maxFine: 100,
  },
];

const SHELF_LOCATIONS = [
  "A-101",
  "A-102",
  "A-201",
  "A-202",
  "B-101",
  "B-102",
  "B-201",
  "B-202",
  "C-101",
  "C-102",
  "REF-001",
  "REF-002",
  "ARC-001",
  "ARC-002",
  "RR-001",
];

const COPY_CONDITIONS = ["new", "excellent", "good", "fair", "poor"] as const;

const COPY_STATUSES = [
  "available",
  "checked_out",
  "on_hold",
  "in_transit",
  "processing",
  "repair",
] as const;

const CIRCULATION_STATUSES = ["active", "returned", "overdue"] as const;

const HOLD_STATUSES = [
  "pending",
  "available",
  "fulfilled",
  "cancelled",
  "expired",
] as const;

const FINE_TYPES = [
  "overdue",
  "lost_item",
  "damaged_item",
  "processing_fee",
] as const;

async function seedLibraryData(
  ctx: ActionCtx,
  orgId: Id<"organizations">,
  userId: Id<"users">,
): Promise<void> {
  console.log("  Seeding library data...");

  const [, _membershipTypeIds, [locations, patrons]] = await Promise.all([
    ctx.runMutation(internal.seedMet.createLibrarySettings, {
      organizationId: orgId,
      defaultLoanPeriodDays: 21,
      defaultRenewalLimit: 3,
      renewalPeriodDays: 14,
      maxRenewalsAllowed: 5,
      finePerDayDefault: 0.25,
      gracePeriodDays: 1,
      holdExpirationDays: 7,
      maxHoldsPerPatron: 5,
      autoGenerateCardNumbers: true,
      classificationSystem: "dewey",
    }),
    Promise.all(
      MEMBERSHIP_TYPES_DATA.map((mt, i) =>
        ctx.runMutation(internal.seedMet.createMembershipType, {
          organizationId: orgId,
          name: mt.name,
          description: `${mt.name} membership with ${mt.maxCheckouts} max checkouts`,
          borrowingLimit: mt.maxCheckouts,
          holdLimit: mt.maxHolds,
          loanPeriodDays: mt.loanPeriod,
          renewalLimit: mt.maxRenewals,
          finePerDay: mt.finePerDay,
          gracePeriodDays: 1,
          fee: mt.fee,
          isDefault: i === 0,
        }),
      ),
    ),
    Promise.all([
      ctx.runQuery(internal.seedMet.getLocations, {
        organizationId: orgId,
      }),
      ctx.runQuery(internal.seedMet.getPatronAccounts, {
        organizationId: orgId,
      }),
    ] as const),
  ] as const);
  const locationIds = locations.map((l) => l._id);

  // Create library items and copies
  const libraryItemIds: Id<"libraryItems">[] = [];
  const copyIds: Id<"itemCopies">[] = [];

  let itemIndex = 0;
  await Promise.all(
    Array.from(LIBRARY_BOOKS).map(async (book) => {
      const itemId = await ctx.runMutation(internal.seedMet.createLibraryItem, {
        organizationId: orgId,
        title: book.title,
        itemType: "book",
        isbn: book.isbn,
        authors: [book.author],
        publisher: book.publisher,
        publicationYear: book.year,
        language: "English",
        subjects: book.subjects,
        description: `A comprehensive resource on ${book.subjects[0]?.toLowerCase() ?? "the subject"}.`,
        totalCopies: randomInt(1, 4),
        availableCopies: 0,
        catalogStatus: "published",
        isCirculating: true,
        loanPeriodDays: 21,
        maxRenewals: 3,
        createdBy: userId,
      });
      libraryItemIds.push(itemId);

      const numCopies = randomInt(1, 3);
      const copyResults = await Promise.all(
        Array.from({ length: numCopies }, async (_, copyIndex) => {
          const c = copyIndex + 1;
          const copyStatus = randomElement(COPY_STATUSES);

          const copyId = await ctx.runMutation(
            internal.seedMet.createItemCopy,
            {
              organizationId: orgId,
              itemId,
              copyNumber: c,
              barcode: `LIB-${String(itemIndex).padStart(4, "0")}-${c}`,
              locationId:
                locationIds.length > 0
                  ? locationIds[randomInt(0, locationIds.length - 1)]
                  : undefined,
              shelfLocation: randomElement(SHELF_LOCATIONS),
              status: copyStatus,
              condition: randomElement(COPY_CONDITIONS),
              acquisitionDate:
                Date.now() - randomInt(30, 365 * 5) * 24 * 60 * 60 * 1000,
              acquisitionPrice: randomInt(20, 150),
              replacementCost: randomInt(30, 200),
              notes:
                Math.random() > 0.8
                  ? "Reference copy - restricted circulation"
                  : undefined,
            },
          );

          return { copyId, isAvailable: copyStatus === "available" };
        }),
      );

      let _availableCount = 0;
      for (const result of copyResults) {
        copyIds.push(result.copyId);
        if (result.isAvailable) {
          _availableCount++;
        }
      }
      itemIndex++;
    }),
  );

  // Create circulations, holds, and fines if we have patrons
  let totalCirculations = 0;
  let totalHolds = 0;
  let totalFines = 0;

  if (patrons.length > 0 && copyIds.length > 0 && libraryItemIds.length > 0) {
    // Create circulations
    const numCirculations = Math.min(20, copyIds.length);
    const circulationIds = await Promise.all(
      Array.from({ length: numCirculations }, async (_, i) => {
        const patron = patrons[i % patrons.length]!;
        const copyId = copyIds[i % copyIds.length]!;
        const itemId =
          libraryItemIds[Math.floor(i / 3) % libraryItemIds.length]!;

        const checkoutDate =
          Date.now() - randomInt(1, 60) * 24 * 60 * 60 * 1000;
        const loanDays = randomInt(14, 28);
        const dueDate = checkoutDate + loanDays * 24 * 60 * 60 * 1000;
        const status = randomElement(CIRCULATION_STATUSES);
        const returnDate =
          status === "returned"
            ? dueDate - randomInt(-5, 10) * 24 * 60 * 60 * 1000
            : undefined;

        const isOverdue =
          status === "overdue" ||
          (status === "returned" && returnDate && returnDate > dueDate);
        const fineAmount = isOverdue ? randomInt(1, 10) * 0.25 : undefined;

        const circulationId = await ctx.runMutation(
          internal.seedMet.createCirculation,
          {
            organizationId: orgId,
            accountId: patron._id,
            copyId,
            itemId,
            checkoutDate,
            dueDate,
            returnDate,
            renewalCount: randomInt(0, 2),
            status,
            fineAmount,
            fineStatus: fineAmount
              ? Math.random() > 0.5
                ? "paid"
                : "billed"
              : "none",
            checkedOutBy: userId,
            checkedInBy: status === "returned" ? userId : undefined,
            notes:
              Math.random() > 0.9
                ? "Extended loan period requested"
                : undefined,
          },
        );

        let createdFine = false;
        if (isOverdue && fineAmount && Math.random() > 0.5) {
          await ctx.runMutation(internal.seedMet.createLibraryFine, {
            organizationId: orgId,
            accountId: patron._id,
            circulationId,
            copyId,
            fineType: "overdue",
            description: "Overdue fine for late return",
            amount: fineAmount,
            amountPaid: Math.random() > 0.5 ? fineAmount : 0,
            balance: Math.random() > 0.5 ? 0 : fineAmount,
            status: Math.random() > 0.5 ? "paid" : "outstanding",
            dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
            paidAt:
              Math.random() > 0.5
                ? Date.now() - randomInt(1, 14) * 24 * 60 * 60 * 1000
                : undefined,
            notes: undefined,
          });
          createdFine = true;
        }

        return { createdFine };
      }),
    );
    totalCirculations = circulationIds.length;
    totalFines += circulationIds.filter((result) => result.createdFine).length;

    // Create holds
    const numHolds = Math.min(15, patrons.length * 2);
    await Promise.all(
      Array.from({ length: numHolds }, async (_, i) => {
        const patron = patrons[i % patrons.length]!;
        const itemId = libraryItemIds[i % libraryItemIds.length]!;
        const holdDate = Date.now() - randomInt(1, 30) * 24 * 60 * 60 * 1000;
        const status = randomElement(HOLD_STATUSES);

        await ctx.runMutation(internal.seedMet.createLibraryHold, {
          organizationId: orgId,
          accountId: patron._id,
          itemId,
          copyId:
            status === "available" || status === "fulfilled"
              ? copyIds[i % copyIds.length]
              : undefined,
          holdDate,
          queuePosition: (i % 5) + 1,
          pickupLocationId:
            locationIds.length > 0
              ? locationIds[randomInt(0, locationIds.length - 1)]
              : undefined,
          availableDate:
            status === "available"
              ? Date.now() - randomInt(1, 5) * 24 * 60 * 60 * 1000
              : undefined,
          expirationDate:
            status === "available"
              ? Date.now() + 7 * 24 * 60 * 60 * 1000
              : holdDate + 90 * 24 * 60 * 60 * 1000,
          status,
          notificationSent: status === "available",
          notes: Math.random() > 0.9 ? "Urgent research request" : undefined,
        });
        totalHolds++;
      }),
    );

    // Create some additional fines (lost items, damaged items)
    await Promise.all(
      Array.from({ length: 5 }, async (_, i) => {
        const patron = patrons[i % patrons.length]!;
        const fineType = randomElement(FINE_TYPES);
        const amount =
          fineType === "lost_item"
            ? 50
            : fineType === "damaged_item"
              ? 25
              : fineType === "processing_fee"
                ? 5
                : randomInt(1, 10) * 0.25;

        await ctx.runMutation(internal.seedMet.createLibraryFine, {
          organizationId: orgId,
          accountId: patron._id,
          circulationId: undefined,
          copyId: copyIds[i % copyIds.length],
          fineType,
          description: `${fineType.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())} fee`,
          amount,
          amountPaid: Math.random() > 0.6 ? amount : 0,
          balance: Math.random() > 0.6 ? 0 : amount,
          status: Math.random() > 0.6 ? "paid" : "outstanding",
          dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
          paidAt:
            Math.random() > 0.6
              ? Date.now() - randomInt(1, 14) * 24 * 60 * 60 * 1000
              : undefined,
          notes: undefined,
        });
        totalFines++;
      }),
    );
  }

  console.log(
    `  Created library data: ${libraryItemIds.length} items, ${copyIds.length} copies, ${totalCirculations} circulations, ${totalHolds} holds, ${totalFines} fines`,
  );
}

// ========================================
// PHASE 12: AUDIT & MISC DATA
// ========================================

const AUDIT_ACTIONS = [
  {
    action: "create",
    entityType: "collections",
    description: "Created collection item",
  },
  {
    action: "update",
    entityType: "collections",
    description: "Updated collection item",
  },
  {
    action: "delete",
    entityType: "collections",
    description: "Deleted collection item",
  },
  { action: "create", entityType: "loans", description: "Created loan record" },
  { action: "update", entityType: "loans", description: "Updated loan record" },
  {
    action: "approve",
    entityType: "loans",
    description: "Approved loan request",
  },
  {
    action: "dispatch",
    entityType: "loans",
    description: "Dispatched loan items",
  },
  { action: "return", entityType: "loans", description: "Returned loan items" },
  {
    action: "create",
    entityType: "exhibitions",
    description: "Created exhibition",
  },
  {
    action: "update",
    entityType: "exhibitions",
    description: "Updated exhibition",
  },
  { action: "create", entityType: "accounts", description: "Created account" },
  { action: "update", entityType: "accounts", description: "Updated account" },
  {
    action: "move",
    entityType: "collections",
    description: "Moved collection item",
  },
  {
    action: "checkout",
    entityType: "circulations",
    description: "Checked out library item",
  },
  {
    action: "checkin",
    entityType: "circulations",
    description: "Checked in library item",
  },
  {
    action: "create",
    entityType: "accessions",
    description: "Created accession record",
  },
  {
    action: "approve",
    entityType: "accessions",
    description: "Approved accession",
  },
  {
    action: "complete",
    entityType: "conservation",
    description: "Completed conservation treatment",
  },
] as const;

const NOTIFICATION_TYPES = [
  {
    type: "loan_approval_required",
    title: "Loan Approval Required",
    message: "A new loan request requires your approval",
  },
  {
    type: "loan_due_soon",
    title: "Loan Due Soon",
    message: "A loan is due for return within the next 7 days",
  },
  {
    type: "loan_overdue",
    title: "Loan Overdue",
    message: "A loan has exceeded its return date",
  },
  {
    type: "exhibition_opening",
    title: "Exhibition Opening Soon",
    message: "An exhibition is scheduled to open within 2 weeks",
  },
  {
    type: "conservation_alert",
    title: "Conservation Alert",
    message: "Environmental conditions require attention",
  },
  {
    type: "accession_approval",
    title: "Accession Approval Required",
    message: "A new accession requires your review",
  },
  {
    type: "transit_update",
    title: "Transit Status Update",
    message: "A shipment status has been updated",
  },
  {
    type: "hold_available",
    title: "Library Hold Available",
    message: "An item you placed on hold is now available",
  },
  {
    type: "item_overdue",
    title: "Library Item Overdue",
    message: "A checked out item is now overdue",
  },
  {
    type: "insurance_renewal",
    title: "Insurance Renewal Due",
    message: "An insurance policy is due for renewal",
  },
] as const;

const MOVE_REASONS = [
  "Exhibition installation",
  "Conservation treatment",
  "Storage optimization",
  "Climate control requirements",
  "Loan preparation",
  "Photography session",
  "Research access",
  "Security relocation",
  "Inventory reorganization",
  "Space consolidation",
] as const;

const SAVED_VIEW_CONFIGS = [
  {
    name: "Active Loans",
    module: "loans" as const,
    filters: { status: "active" },
  },
  {
    name: "Pending Approvals",
    module: "loans" as const,
    filters: { status: "pending" },
  },
  {
    name: "Overdue Items",
    module: "loans" as const,
    filters: { status: "overdue" },
  },
  {
    name: "High Value Objects",
    module: "objects" as const,
    filters: { minValue: 100000 },
  },
  {
    name: "Recent Acquisitions",
    module: "objects" as const,
    filters: { dateRange: "last30days" },
  },
  {
    name: "Pending Accessions",
    module: "accessions" as const,
    filters: { status: "pending" },
  },
  {
    name: "Active Borrowers",
    module: "accounts" as const,
    filters: { accountType: "borrower", hasActiveLoans: true },
  },
  {
    name: "Storage Locations",
    module: "locations" as const,
    filters: { type: "storage" },
  },
] as const;

const USER_PREFERENCE_KEYS = [
  { key: "objects.viewMode", value: "grid" },
  {
    key: "objects.columns",
    value: '["title","accessionNumber","status","location"]',
  },
  { key: "objects.sortBy", value: "createdAt" },
  { key: "objects.sortOrder", value: "desc" },
  { key: "loans.viewMode", value: "table" },
  {
    key: "dashboard.widgets",
    value: '["recentActivity","upcomingDueDates","stats"]',
  },
  { key: "theme", value: "dark" },
  { key: "language", value: "en" },
] as const;

async function seedAuditData(
  ctx: ActionCtx,
  orgId: Id<"organizations">,
  userId: Id<"users">,
): Promise<void> {
  console.log("  Seeding audit & misc data...");

  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const _oneMonth = 30 * oneDay;

  const [collections, locations] = await Promise.all([
    ctx.runQuery(internal.seedMet.getCollections, {
      organizationId: orgId,
    }),
    ctx.runQuery(internal.seedMet.getLocations, {
      organizationId: orgId,
    }),
  ] as const);
  let totalAuditLogs = 0;
  let totalNotifications = 0;
  let totalLocationHistory = 0;
  let totalSavedViews = 0;
  let totalUserPreferences = 0;

  await Promise.all(
    Array.from({ length: 50 }, async (_, i) => {
      const auditEntry = AUDIT_ACTIONS[i % AUDIT_ACTIONS.length]!;
      const daysAgo = randomInt(0, 90);
      const timestamp = now - daysAgo * oneDay - randomInt(0, oneDay);

      let entityId = `entity-${randomInt(1000, 9999)}`;
      if (auditEntry.entityType === "collections" && collections.length > 0) {
        entityId = collections[i % collections.length]!._id;
      }

      await ctx.runMutation(internal.seedMet.createAuditLog, {
        organizationId: orgId,
        userId,
        action: auditEntry.action,
        entityType: auditEntry.entityType,
        entityId,
        changes:
          auditEntry.action === "update"
            ? { before: { status: "pending" }, after: { status: "active" } }
            : undefined,
        ipAddress: `192.168.1.${randomInt(1, 255)}`,
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        timestamp,
      });
      totalAuditLogs++;
    }),
  );

  await Promise.all(
    Array.from({ length: 20 }, async (_, i) => {
      const notification = NOTIFICATION_TYPES[i % NOTIFICATION_TYPES.length]!;
      const daysAgo = randomInt(0, 30);
      const createdAt = now - daysAgo * oneDay - randomInt(0, oneDay);

      await ctx.runMutation(internal.seedMet.createNotification, {
        organizationId: orgId,
        userId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        read: Math.random() > 0.4,
        relatedEntityType: notification.type.includes("loan")
          ? "loans"
          : notification.type.includes("exhibition")
            ? "exhibitions"
            : undefined,
        relatedEntityId: undefined,
        createdAt,
      });
      totalNotifications++;
    }),
  );

  if (collections.length > 0 && locations.length > 1) {
    const numMoves = Math.min(30, collections.length);
    await Promise.all(
      Array.from({ length: numMoves }, async (_, i) => {
        const collection = collections[i % collections.length]!;
        const fromIndex = randomInt(0, locations.length - 1);
        let toIndex = randomInt(0, locations.length - 1);
        while (toIndex === fromIndex && locations.length > 1) {
          toIndex = randomInt(0, locations.length - 1);
        }

        const daysAgo = randomInt(1, 180);
        const movedAt = now - daysAgo * oneDay;

        await ctx.runMutation(internal.seedMet.createLocationHistory, {
          collectionId: collection._id,
          fromLocationId:
            Math.random() > 0.2 ? locations[fromIndex]!._id : undefined,
          toLocationId: locations[toIndex]!._id,
          movedBy: userId,
          movedAt,
          reason: randomElement(MOVE_REASONS),
          notes:
            Math.random() > 0.7
              ? "Movement completed without incident"
              : undefined,
        });
        totalLocationHistory++;
      }),
    );
  }

  await Promise.all(
    Array.from(SAVED_VIEW_CONFIGS).map(async (viewConfig) => {
      await ctx.runMutation(internal.seedMet.createSavedView, {
        organizationId: orgId,
        userId,
        name: viewConfig.name,
        module: viewConfig.module,
        filters: JSON.stringify(viewConfig.filters),
        isDefault: viewConfig.name === "Active Loans",
        createdAt: now - randomInt(1, 60) * oneDay,
        lastUsedAt:
          Math.random() > 0.3 ? now - randomInt(0, 7) * oneDay : undefined,
      });
      totalSavedViews++;
    }),
  );

  await Promise.all(
    Array.from(USER_PREFERENCE_KEYS).map(async (pref) => {
      await ctx.runMutation(internal.seedMet.createUserPreferences, {
        userId,
        organizationId: orgId,
        key: pref.key,
        value: pref.value,
        updatedAt: now - randomInt(0, 30) * oneDay,
      });
      totalUserPreferences++;
    }),
  );

  console.log(
    `  Created audit data: ${totalAuditLogs} audit logs, ${totalNotifications} notifications, ${totalLocationHistory} location history, ${totalSavedViews} saved views, ${totalUserPreferences} user preferences`,
  );
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

async function seedModuleDetails(
  ctx: ActionCtx,
  orgId: Id<"organizations">,
  _userId: Id<"users">,
  orgType: "museum" | "gallery" | "library" | "collector",
): Promise<void> {
  // Get all collections for this org
  const collections = await ctx.runQuery(internal.seedMet.getCollections, {
    organizationId: orgId,
  });

  console.log(
    `  Creating module details for ${collections.length} collections`,
  );

  // Distribution based on org type
  const distributions: Record<string, Record<string, number>> = {
    museum: { fineArt: 0.6, naturalHistory: 0.3, vehicle: 0.05, wine: 0.05 },
    gallery: { fineArt: 0.9, wine: 0.1, naturalHistory: 0, vehicle: 0 },
    library: {
      archive: 0.8,
      fineArt: 0.2,
      naturalHistory: 0,
      vehicle: 0,
      wine: 0,
    },
    collector: {
      wine: 0.4,
      vehicle: 0.3,
      fineArt: 0.3,
      naturalHistory: 0,
      archive: 0,
    },
  };

  const dist = distributions[orgType] ?? distributions.museum!;

  // Helper to pick module type based on distribution
  function pickModuleType(): string {
    const rand = Math.random();
    let cumulative = 0;
    for (const [type, prob] of Object.entries(dist!)) {
      cumulative += prob;
      if (rand < cumulative) return type;
    }
    return "fineArt";
  }

  // Wine data generators
  const wineRegions = [
    "Bordeaux",
    "Burgundy",
    "Napa Valley",
    "Tuscany",
    "Rioja",
    "Champagne",
    "Barossa Valley",
  ];
  const wineVarietals = [
    "Cabernet Sauvignon",
    "Pinot Noir",
    "Chardonnay",
    "Merlot",
    "Syrah",
    "Riesling",
    "Sauvignon Blanc",
  ];
  const wineProducers = [
    "Château Margaux",
    "Opus One",
    "Penfolds",
    "Domaine de la Romanée-Conti",
    "Antinori",
  ];

  // Vehicle data generators
  const vehicleMakes = [
    "Ferrari",
    "Porsche",
    "Mercedes-Benz",
    "Aston Martin",
    "Jaguar",
    "Rolls-Royce",
    "Bentley",
  ];
  const vehicleModels: Record<string, string[]> = {
    Ferrari: ["250 GTO", "F40", "Testarossa", "308 GTB"],
    Porsche: ["911 Carrera", "356 Speedster", "959", "Carrera GT"],
    "Mercedes-Benz": ["300SL Gullwing", "540K", "W196"],
    "Aston Martin": ["DB5", "DB4 GT", "Vantage"],
    Jaguar: ["E-Type", "XK120", "D-Type"],
    "Rolls-Royce": ["Silver Ghost", "Phantom", "Corniche"],
    Bentley: ["Blower", "Continental", "Speed Six"],
  };

  // Natural history data
  const kingdoms = ["Animalia", "Plantae", "Fungi"];
  const preservationMethods = [
    "dry",
    "wet",
    "frozen",
    "pinned",
    "pressed",
    "mounted",
    "fossil",
  ] as const;

  // Archive data
  const confidentialityLevels = [
    "public",
    "internal",
    "confidential",
    "restricted",
  ] as const;
  const departments = [
    "Administration",
    "Research",
    "Legal",
    "Finance",
    "Operations",
    "Human Resources",
  ];

  const moduleCount = {
    fineArt: 0,
    wine: 0,
    vehicle: 0,
    naturalHistory: 0,
    archive: 0,
  };

  type ModuleSeedOutcome =
    | "wine"
    | "vehicle"
    | "naturalHistory"
    | "archive"
    | "fineArt"
    | null;

  const moduleOutcomes = await Promise.all(
    collections.map(async (collection): Promise<ModuleSeedOutcome> => {
      const moduleType = pickModuleType();

      try {
        switch (moduleType) {
          case "wine": {
            const region =
              wineRegions[Math.floor(Math.random() * wineRegions.length)]!;
            const varietal =
              wineVarietals[Math.floor(Math.random() * wineVarietals.length)]!;
            const producer =
              wineProducers[Math.floor(Math.random() * wineProducers.length)]!;
            const vintage = 1960 + Math.floor(Math.random() * 60);

            await ctx.runMutation(internal.seedMet.createWineDetails, {
              collectionId: collection._id,
              organizationId: orgId,
              vintage,
              producer,
              region,
              varietal,
              bottleSize: "750ml",
              quantity: 1 + Math.floor(Math.random() * 12),
              purchasePrice: 100 + Math.floor(Math.random() * 5000),
              currentValue: 200 + Math.floor(Math.random() * 10000),
            });
            return "wine";
          }

          case "vehicle": {
            const make =
              vehicleMakes[Math.floor(Math.random() * vehicleMakes.length)]!;
            const models = vehicleModels[make] || ["Classic Model"];
            const model = models[Math.floor(Math.random() * models.length)]!;
            const year = 1950 + Math.floor(Math.random() * 50);

            const vinChars = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";
            let vin = "";
            for (let i = 0; i < 17; i++) {
              vin += vinChars[Math.floor(Math.random() * vinChars.length)];
            }

            await ctx.runMutation(internal.seedMet.createVehicleDetails, {
              collectionId: collection._id,
              organizationId: orgId,
              vin,
              make,
              model,
              year,
              odometer: Math.floor(Math.random() * 100000),
              odometerUnit: "miles",
              insuranceValue: 50000 + Math.floor(Math.random() * 500000),
            });
            return "vehicle";
          }

          case "naturalHistory": {
            const kingdom =
              kingdoms[Math.floor(Math.random() * kingdoms.length)]!;
            const preservationMethod =
              preservationMethods[
                Math.floor(Math.random() * preservationMethods.length)
              ];

            await ctx.runMutation(
              internal.seedMet.createNaturalHistoryDetails,
              {
                collectionId: collection._id,
                organizationId: orgId,
                kingdom,
                commonName: collection.title,
                preservationMethod,
                locality: "Field Collection Site",
                habitat: "Various",
              },
            );
            return "naturalHistory";
          }

          case "archive": {
            const confidentialityLevel =
              confidentialityLevels[
                Math.floor(Math.random() * confidentialityLevels.length)
              ];
            const department =
              departments[Math.floor(Math.random() * departments.length)]!;

            await ctx.runMutation(internal.seedMet.createArchiveDetails, {
              collectionId: collection._id,
              organizationId: orgId,
              documentType: "Historical Record",
              retentionCategory: "Permanent",
              retentionYears: 100,
              confidentialityLevel,
              originatingDepartment: department,
            });
            return "archive";
          }

          default:
            return "fineArt";
        }
      } catch {
        console.log(
          `  Skipped module detail for ${collection._id} (may already exist)`,
        );
        return null;
      }
    }),
  );

  for (const outcome of moduleOutcomes) {
    if (outcome === "wine") moduleCount.wine++;
    else if (outcome === "vehicle") moduleCount.vehicle++;
    else if (outcome === "naturalHistory") moduleCount.naturalHistory++;
    else if (outcome === "archive") moduleCount.archive++;
    else if (outcome === "fineArt") moduleCount.fineArt++;
  }

  console.log(
    `  Module details created: wine=${moduleCount.wine}, vehicle=${moduleCount.vehicle}, naturalHistory=${moduleCount.naturalHistory}, archive=${moduleCount.archive}`,
  );
}

async function seedRelationshipsAndDocuments(
  ctx: ActionCtx,
  orgId: Id<"organizations">,
  userId: Id<"users">,
): Promise<void> {
  console.log("  Seeding relationships and documents...");

  // --- Account Relationships ---
  const [lenders, _borrowers, loans] = await Promise.all([
    ctx.runQuery(internal.seedMet.getAccounts, {
      organizationId: orgId,
      accountType: "lender",
    }),
    ctx.runQuery(internal.seedMet.getAccounts, {
      organizationId: orgId,
      accountType: "borrower",
    }),
    ctx.runQuery(internal.seedMet.getLoans, {
      organizationId: orgId,
    }),
  ] as const);
  // Get loans to link accounts to
  let relationshipCount = 0;
  await Promise.all(
    Array.from(lenders.slice(0, 10)).map(async (lender) => {
      // Link each lender to 2-3 random loans
      const lenderLoans = loans.slice(0, 2 + Math.floor(Math.random() * 2));
      await Promise.all(
        Array.from(lenderLoans).map(async (loan) => {
          await ctx.runMutation(internal.seedMet.createAccountRelationship, {
            organizationId: orgId,
            accountId: lender._id,
            relatedEntityType: "loan",
            relatedEntityId: loan._id,
            relationshipType: "lender",
            startDate:
              Date.now() -
              Math.floor(Math.random() * 365 * 24 * 60 * 60 * 1000),
            createdAt: Date.now(),
          });
          relationshipCount++;
        }),
      );
    }),
  );
  console.log(`  Created ${relationshipCount} account relationships`);

  // --- Object Comments ---
  const collections = await ctx.runQuery(internal.seedMet.getCollections, {
    organizationId: orgId,
  });

  const commentTemplates = [
    "Excellent condition, well preserved.",
    "Requires minor conservation attention.",
    "Beautiful example of the period.",
    "Provenance verified through documentation.",
    "Subject of recent scholarly research.",
    "Popular with visitors during exhibitions.",
    "Acquired through generous donation.",
    "Rare find, one of few known examples.",
    "Recently restored, condition improved.",
    "Cataloging notes updated.",
  ];

  let commentCount = 0;
  // Add comments to ~30% of collections
  const collectionsWithComments = collections.filter(() => Math.random() < 0.3);
  await Promise.all(
    Array.from(collectionsWithComments).map(async (collection) => {
      const numComments = 1 + Math.floor(Math.random() * 3); // 1-3 comments
      await Promise.all(
        Array.from({ length: numComments }, async (_, _i) => {
          const comment =
            commentTemplates[
              Math.floor(Math.random() * commentTemplates.length)
            ]!;
          await ctx.runMutation(internal.seedMet.createObjectComment, {
            organizationId: orgId,
            objectId: collection._id,
            userId,
            content: comment,
            createdAt:
              Date.now() - Math.floor(Math.random() * 90 * 24 * 60 * 60 * 1000), // Last 90 days
          });
          commentCount++;
        }),
      );
    }),
  );
  console.log(`  Created ${commentCount} object comments`);

  // --- Condition Disputes ---
  // Get returned loans for potential disputes
  const returnedLoans = loans.filter((l) => l.status === "returned");

  let disputeCount = 0;
  // Create disputes for ~10% of returned loans
  const loansWithDisputes = returnedLoans.filter(() => Math.random() < 0.1);
  const disputeResults = await Promise.all(
    loansWithDisputes.map(async (loan) => {
      const loanCollections = collections.slice(0, 1);
      if (loanCollections.length === 0) {
        return false;
      }

      await ctx.runMutation(internal.seedMet.createConditionDispute, {
        loanId: loan._id,
        organizationId: orgId,
        collectionId: loanCollections[0]!._id,
        conditionBefore: "Good",
        conditionBeforeNotes: "Item was in good condition before loan",
        conditionAfter: "Fair",
        conditionAfterNotes: "Minor scratches observed on return",
        disputeDescription:
          "Borrower claims damage was pre-existing. Investigating.",
        reportedBy: userId,
        reportedAt: Date.now(),
        status: "investigating",
      });
      return true;
    }),
  );
  disputeCount = disputeResults.filter(Boolean).length;
  console.log(`  Created ${disputeCount} condition disputes`);

  // --- Conservation Alert Rules ---
  const alertRules = [
    {
      name: "High Humidity Alert",
      triggerType: "environmental" as const,
      priority: "high" as const,
      description: "Alert when humidity exceeds safe levels",
    },
    {
      name: "Temperature Warning",
      triggerType: "environmental" as const,
      priority: "medium" as const,
      description: "Alert when temperature is out of range",
    },
    {
      name: "Overdue Treatment",
      triggerType: "treatment_overdue" as const,
      priority: "critical" as const,
      description: "Alert when conservation treatment is overdue",
      daysOverdue: 30,
    },
    {
      name: "Assessment Due",
      triggerType: "assessment_due" as const,
      priority: "medium" as const,
      description: "Alert when periodic assessment is due",
      assessmentIntervalDays: 365,
    },
    {
      name: "Critical Condition",
      triggerType: "condition_threshold" as const,
      priority: "critical" as const,
      description: "Alert when object condition drops to critical",
      conditionThreshold: "critical",
    },
  ];

  await Promise.all(
    Array.from(alertRules).map(async (rule) => {
      await ctx.runMutation(internal.seedMet.createConservationAlertRule, {
        organizationId: orgId,
        name: rule.name,
        description: rule.description,
        triggerType: rule.triggerType,
        conditionThreshold: rule.conditionThreshold,
        daysOverdue: rule.daysOverdue,
        assessmentIntervalDays: rule.assessmentIntervalDays,
        priority: rule.priority,
        emailNotification: true,
        inAppNotification: true,
        isActive: true,
        createdBy: userId,
        createdAt: Date.now(),
      });
    }),
  );
  console.log(`  Created ${alertRules.length} conservation alert rules`);

  console.log("  Relationships and documents seeding complete");
}

async function seedLocationAssignments(
  ctx: ActionCtx,
  orgId: Id<"organizations">,
  userId: Id<"users">,
): Promise<void> {
  const locations = await ctx.runQuery(internal.seedMet.getLocationsForOrg, {
    organizationId: orgId,
    types: ["room", "cabinet"],
  });

  if (locations.length === 0) {
    console.log("  No locations available for assignment");
    return;
  }

  const collections = await ctx.runQuery(
    internal.seedMet.getCollectionsWithoutLocation,
    { organizationId: orgId },
  );

  console.log(`  Assigning locations to ${collections.length} collections`);

  await Promise.all(
    Array.from(collections).map(async (collection) => {
      const location = locations[Math.floor(Math.random() * locations.length)]!;

      await ctx.runMutation(internal.seedMet.updateCollectionLocation, {
        collectionId: collection._id,
        locationId: location._id,
      });

      await ctx.runMutation(internal.seedMet.createLocationHistory, {
        collectionId: collection._id,
        toLocationId: location._id,
        movedBy: userId,
        movedAt: Date.now(),
        reason: "Initial placement during collection seeding",
      });
    }),
  );

  console.log(`  Assigned locations to ${collections.length} collections`);
}

async function seedAdminData(
  ctx: ActionCtx,
  orgId: Id<"organizations">,
  userId: Id<"users">,
): Promise<void> {
  console.log("  Seeding admin data...");

  // --- API Keys ---
  const apiKeys = [
    {
      name: "Read-Only Integration",
      permissions: ["read:collections", "read:loans", "read:accounts"],
    },
    {
      name: "Full Access Key",
      permissions: [
        "read:all",
        "write:collections",
        "write:loans",
        "write:accounts",
      ],
    },
  ];

  await Promise.all(
    Array.from(apiKeys).map(async (key) => {
      await ctx.runMutation(internal.seedMet.createApiKey, {
        organizationId: orgId,
        name: key.name,
        prefix: `seed_${Date.now().toString(36)}`,
        keyHash: `seed_key_hash_placeholder_${Math.random().toString(36).slice(2)}`,
        permissions: key.permissions,
        isRevoked: false,
        createdBy: userId,
        createdAt: Date.now(),
      });
    }),
  );
  console.log(`  Created ${apiKeys.length} API keys`);

  // --- Webhooks ---
  const webhooks = [
    {
      name: "Loan Events Webhook",
      events: ["loan.created", "loan.approved", "loan.returned"],
    },
    {
      name: "Collection Events Webhook",
      events: [
        "collection.created",
        "collection.updated",
        "collection.deleted",
      ],
    },
    {
      name: "Alert Events Webhook",
      events: ["alert.triggered", "alert.resolved"],
    },
  ];

  await Promise.all(
    Array.from(webhooks).map(async (webhook) => {
      await ctx.runMutation(internal.seedMet.createWebhook, {
        organizationId: orgId,
        name: webhook.name,
        url: `https://example.com/webhook/seed-${webhook.name.toLowerCase().replace(/\s+/g, "-")}`,
        secret: `whsec_seed_secret_${Math.random().toString(36).slice(2)}`,
        events: webhook.events,
        isActive: true,
        createdBy: userId,
        createdAt: Date.now(),
      });
    }),
  );
  console.log(`  Created ${webhooks.length} webhooks`);

  // --- Scheduled Reports ---
  const reports = [
    {
      name: "Weekly Collection Health",
      reportType: "collection_health" as const,
      schedule: "weekly" as const,
    },
    {
      name: "Monthly Loan Status",
      reportType: "loan_performance" as const,
      schedule: "monthly" as const,
    },
    {
      name: "Quarterly Conservation Summary",
      reportType: "conservation_status" as const,
      schedule: "quarterly" as const,
    },
  ];

  await Promise.all(
    Array.from(reports).map(async (report) => {
      await ctx.runMutation(internal.seedMet.createScheduledReport, {
        organizationId: orgId,
        name: report.name,
        description: `Automated ${report.schedule} report for ${report.reportType.replace(/_/g, " ")}`,
        reportType: report.reportType,
        schedule: report.schedule,
        emailRecipients: ["reports@example.com"],
        isActive: true,
        createdBy: userId,
        createdAt: Date.now(),
      });
    }),
  );
  console.log(`  Created ${reports.length} scheduled reports`);

  // --- Notification Preferences ---
  await ctx.runMutation(internal.seedMet.createNotificationPreference, {
    userId,
    organizationId: orgId,
    enableApprovals: true,
    enableReminders: true,
    enableAlerts: true,
    enableAssignments: true,
    enableSystem: true,
    emailEnabled: true,
    updatedAt: Date.now(),
  });
  console.log("  Created notification preferences for seed user");

  console.log("  Admin data seeding complete");
}

async function seedLibraryExtensions(
  ctx: ActionCtx,
  orgId: Id<"organizations">,
  userId: Id<"users">,
  orgType: "museum" | "gallery" | "library" | "collector",
): Promise<void> {
  if (orgType !== "library") {
    console.log("  Skipping library extensions (not a library org)");
    return;
  }

  console.log("  Seeding library extensions...");

  const vendorData = [
    { name: "Academic Press", website: "https://academicpress.example.com" },
    {
      name: "Heritage Books Inc",
      website: "https://heritagebooks.example.com",
    },
    {
      name: "Digital Archives Ltd",
      website: "https://digitalarchives.example.com",
    },
    {
      name: "Scholarly Publications",
      website: "https://scholarlypubs.example.com",
    },
    {
      name: "Classic Reprints Co",
      website: "https://classicreprints.example.com",
    },
  ];

  const vendorIds: Id<"libraryVendors">[] = [];
  await Promise.all(
    Array.from(vendorData).map(async (vendor) => {
      const vendorId = await ctx.runMutation(
        internal.seedMet.createLibraryVendor,
        {
          organizationId: orgId,
          name: vendor.name,
          contactName: `${vendor.name} Sales Team`,
          email: `sales@${vendor.name.toLowerCase().replace(/\s+/g, "")}.example.com`,
          phone: `+1-555-${Math.floor(Math.random() * 9000 + 1000).toString()}`,
          website: vendor.website,
          paymentTerms: "Net 30",
          discountPercent: 10 + Math.floor(Math.random() * 15),
          isActive: true,
          createdAt: Date.now(),
        },
      );
      vendorIds.push(vendorId);
    }),
  );
  console.log(`  Created ${vendorData.length} library vendors`);

  const bookTitles = [
    "Modern Conservation Techniques",
    "History of European Art",
    "Digital Preservation Handbook",
    "Archive Management Systems",
    "Cultural Heritage Studies",
    "Museum Leadership Guide",
    "Collection Care Manual",
    "Rare Books Restoration",
    "Archaeological Documentation",
    "Art Authentication Methods",
  ];

  const statuses = [
    "submitted",
    "under_review",
    "approved",
    "ordered",
    "received",
    "cataloged",
  ] as const;
  const priorities = ["low", "normal", "high", "urgent"] as const;

  await Promise.all(
    Array.from(bookTitles).map(async (title) => {
      const priority =
        priorities[Math.floor(Math.random() * priorities.length)]!;
      const status = statuses[Math.floor(Math.random() * statuses.length)]!;

      await ctx.runMutation(internal.seedMet.createLibraryAcquisitionRequest, {
        organizationId: orgId,
        title,
        authors: [`Author ${Math.floor(Math.random() * 100)}`],
        isbn: `978-${Math.floor(Math.random() * 9000000000 + 1000000000).toString()}`,
        publisher:
          vendorData[Math.floor(Math.random() * vendorData.length)]!.name,
        requestedBy: userId,
        requestedAt:
          Date.now() - Math.floor(Math.random() * 90 * 24 * 60 * 60 * 1000),
        reason: "Requested for research collection",
        priority,
        quantity: 1,
        status,
      });
    }),
  );
  console.log(`  Created ${bookTitles.length} acquisition requests`);

  const libraryItems = await ctx.runQuery(internal.seedMet.getLibraryItems, {
    organizationId: orgId,
  });

  if (libraryItems.length === 0) {
    console.log("  No library items found for serial subscriptions");
    return;
  }

  const frequencies = ["monthly", "quarterly", "annually"] as const;
  const subscriptionCount = Math.min(5, libraryItems.length);

  await Promise.all(
    Array.from({ length: subscriptionCount }, async (_, i) => {
      const item = libraryItems[i]!;
      const frequency =
        frequencies[Math.floor(Math.random() * frequencies.length)]!;
      const vendorId = vendorIds[Math.floor(Math.random() * vendorIds.length)];

      const subscriptionId = await ctx.runMutation(
        internal.seedMet.createSerialSubscription,
        {
          organizationId: orgId,
          itemId: item._id,
          vendorId,
          subscriptionNumber: `SUB-${Date.now().toString(36)}-${i}`,
          startDate: Date.now() - 365 * 24 * 60 * 60 * 1000,
          endDate: Date.now() + 365 * 24 * 60 * 60 * 1000,
          frequency,
          expectedIssues:
            frequency === "monthly" ? 12 : frequency === "quarterly" ? 4 : 1,
          cost: 100 + Math.floor(Math.random() * 500),
          status: "active",
          autoRenew: true,
          createdAt: Date.now(),
        },
      );

      const issueCount = 3 + Math.floor(Math.random() * 4);
      const issueStatuses = [
        "expected",
        "received",
        "received",
        "received",
      ] as const;

      await Promise.all(
        Array.from({ length: issueCount }, async (_, j) => {
          const issueStatus =
            issueStatuses[Math.floor(Math.random() * issueStatuses.length)]!;
          await ctx.runMutation(internal.seedMet.createSerialIssue, {
            organizationId: orgId,
            subscriptionId,
            itemId: item._id,
            issueNumber: (j + 1).toString(),
            volume: `Vol. ${2024 - Math.floor(j / 4)}`,
            issueDate: Date.now() - (issueCount - j) * 30 * 24 * 60 * 60 * 1000,
            receivedDate:
              issueStatus === "received"
                ? Date.now() - (issueCount - j - 1) * 30 * 24 * 60 * 60 * 1000
                : undefined,
            status: issueStatus,
            createdAt: Date.now(),
          });
        }),
      );
    }),
  );
  console.log(
    `  Created ${subscriptionCount} serial subscriptions with issues`,
  );

  console.log("  Library extensions seeding complete");
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
    const seedUserId = userId;
    console.log("Found user, proceeding...");

    console.log("Clearing existing data...");
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
    ];

    async function clearTableWithRetries(tableName: string) {
      let deleted = 0;
      let retries = 0;
      const maxRetries = 3;

      async function clearNextBatch(): Promise<void> {
        let batchDeleted = 0;
        try {
          batchDeleted = await ctx.runMutation(
            internal.seedMet.clearTableBatch,
            {
              tableName,
              batchSize: 100,
            },
          );
          deleted += batchDeleted;
          retries = 0;
          await sleep(100);
        } catch (error) {
          if (
            error instanceof Error &&
            error.message.includes("OptimisticConcurrencyControlFailure")
          ) {
            retries++;
            if (retries >= maxRetries) {
              console.warn(
                `OCC retry limit reached for ${tableName}, continuing...`,
              );
              return;
            }

            console.log(
              `OCC conflict on ${tableName}, retry ${retries}/${maxRetries}...`,
            );
            await sleep(500 * retries);
            batchDeleted = 100;
          } else {
            throw error;
          }
        }

        if (batchDeleted === 100) {
          await clearNextBatch();
        }
      }

      await clearNextBatch();

      if (deleted > 0) {
        console.log(`  Cleared ${deleted} from ${tableName}`);
      }
    }

    await Promise.all(
      tablesToClear.map((tableName) => clearTableWithRetries(tableName)),
    );

    let storageDeleted = 0;
    async function clearStorageBatches() {
      const storageBatch = await ctx.runMutation(
        internal.seedMet.clearStorageBatch,
        {
          batchSize: 100,
        },
      );
      storageDeleted += storageBatch;
      if (storageBatch === 100) {
        await clearStorageBatches();
      }
    }

    await clearStorageBatches();
    if (storageDeleted > 0) {
      console.log(`  Cleared ${storageDeleted} storage files`);
    }

    await sleep(500);

    const orgSeedResults = await Promise.all(
      ORGANIZATIONS.map(async (org) => {
        console.log(`\nSeeding ${org.name}...`);

        const orgId = await ctx.runMutation(
          internal.seedMet.createOrganization,
          {
            name: org.name,
            slug: org.slug,
            type: org.type,
            subscriptionTier: org.subscriptionTier,
          },
        );
        const [, objectIds] = await Promise.all([
          Promise.all([
            ctx.runMutation(internal.seedMet.assignUserToOrg, {
              userId,
              organizationId: orgId,
            }),
            seedFoundationData(ctx, orgId, userId),
            seedAccountsData(ctx, orgId, userId),
            seedWorkflowData(ctx, orgId, userId),
          ]),
          fetchMetSearch(org.metQuery),
        ] as const);
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
        const seedChunkSize = 10;

        async function seedMetObjectsChunk(startIndex: number) {
          if (
            startIndex >= objectIds.length ||
            successCount >= targetCount ||
            attemptCount >= maxAttempts
          ) {
            return;
          }

          const chunk = objectIds.slice(startIndex, startIndex + seedChunkSize);
          const seededInChunk = await Promise.all(
            chunk.map(async (metId) => {
              attemptCount++;

              const obj = await fetchMetObject(metId);
              if (!obj?.primaryImageSmall) {
                return 0;
              }

              const blob = await fetchImageBlob(obj.primaryImageSmall);
              if (!blob) {
                return 0;
              }

              const [storageId, collectionId] = await Promise.all([
                ctx.storage.store(blob),
                ctx.runMutation(internal.seedMet.createCollection, {
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
                  creditLine:
                    obj.creditLine || "The Metropolitan Museum of Art",
                }),
              ] as const);

              await ctx.runMutation(internal.seedMet.createMediaFile, {
                collectionId,
                organizationId: orgId,
                userId: seedUserId,
                storageId,
                fileName: `${org.prefix}-MET-${metId}.jpg`,
                fileSize: blob.size,
              });

              return 1;
            }),
          );

          successCount += seededInChunk.reduce<number>(
            (sum, value) => sum + value,
            0,
          );
          if (successCount > 0 && successCount % 10 === 0) {
            console.log(`  ${org.name}: ${successCount}/${targetCount}`);
          }

          await seedMetObjectsChunk(startIndex + seedChunkSize);
        }

        await seedMetObjectsChunk(0);

        console.log(
          `Finished ${org.name}: ${successCount} objects (${attemptCount} attempts)`,
        );
        if (successCount < 10) {
          console.warn(`WARNING: ${org.name} has <10 objects`);
        }

        await Promise.all([
          seedLocationAssignments(ctx, orgId, userId),
          seedModuleDetails(ctx, orgId, userId, org.type),
          seedRelationshipsAndDocuments(ctx, orgId, userId),
          seedAdminData(ctx, orgId, userId),
          seedLibraryExtensions(ctx, orgId, userId, org.type),
          seedCollectionDetailsData(ctx, orgId, userId),
          seedLoansData(ctx, orgId, userId),
          seedAccessionsData(ctx, orgId, userId),
          seedExhibitionsData(ctx, orgId, userId),
          seedConservationData(ctx, orgId, userId),
          seedTransitData(ctx, orgId, userId),
          seedLibraryData(ctx, orgId, userId),
          seedInsuranceData(ctx, orgId, userId),
          seedAuditData(ctx, orgId, userId),
        ] as const);

        return successCount;
      }),
    );

    const totalCollections = orgSeedResults.reduce(
      (sum, successCount) => sum + successCount,
      0,
    );

    console.log(`\nSeed completed! Total collections: ${totalCollections}`);
    return null;
  },
});
