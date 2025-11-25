---
title: Integrations - Complete Library Management System (ILS)
---

### Overview

A full-featured **Integrated Library System** covering everything a librarian/bookseller needs: catalog, patrons, circulation, holds, fines, acquisitions, and reporting.

## 1. Integrations Framework

**Settings:** `/settings/integrations`

- Enable/disable integrations per organization
- `organizations.settings.enabledIntegrations: ["library"]`

---

## 2. Complete Database Schema

### A. Catalog Module

**`libraryItems`** - Universal catalog (books, periodicals, media)

```typescript
libraryItems: defineTable({
  organizationId: v.id("organizations"),
  collectionId: v.optional(v.id("collections")), // Link to rare/archival items
  
  // Item type
  itemType: v.union(
    v.literal("book"),
    v.literal("ebook"),
    v.literal("audiobook"),
    v.literal("periodical"),    // Magazines, journals
    v.literal("newspaper"),
    v.literal("dvd"),
    v.literal("cd"),
    v.literal("map"),
    v.literal("manuscript"),
    v.literal("thesis"),
    v.literal("other"),
  ),
  
  // Identifiers
  isbn: v.optional(v.string()),
  isbn13: v.optional(v.string()),
  issn: v.optional(v.string()),      // For periodicals
  barcode: v.optional(v.string()),
  callNumber: v.optional(v.string()), // Dewey/LC classification
  accessionNumber: v.optional(v.string()),
  
  // Bibliographic data
  title: v.string(),
  subtitle: v.optional(v.string()),
  authors: v.array(v.string()),
  contributors: v.optional(v.array(v.object({
    name: v.string(),
    role: v.string(), // editor, translator, illustrator, narrator
  }))),
  
  // Publication
  publisher: v.optional(v.string()),
  publicationYear: v.optional(v.number()),
  publicationPlace: v.optional(v.string()),
  edition: v.optional(v.string()),
  volume: v.optional(v.string()),
  issue: v.optional(v.string()),      // For periodicals
  
  // Language
  language: v.string(),
  originalLanguage: v.optional(v.string()),
  originalTitle: v.optional(v.string()),
  
  // Physical description
  pages: v.optional(v.number()),
  duration: v.optional(v.number()),   // For audio/video (minutes)
  format: v.optional(v.string()),     // hardcover, paperback, DVD, etc.
  dimensions: v.optional(v.string()),
  
  // Classification & subjects
  deweyDecimal: v.optional(v.string()),
  lcClassification: v.optional(v.string()),
  categories: v.optional(v.array(v.string())),
  genres: v.optional(v.array(v.string())),
  subjects: v.optional(v.array(v.string())),
  keywords: v.optional(v.array(v.string())),
  targetAudience: v.optional(v.union(
    v.literal("children"),
    v.literal("young_adult"),
    v.literal("adult"),
    v.literal("all_ages"),
  )),
  
  // Series
  series: v.optional(v.string()),
  seriesNumber: v.optional(v.number()),
  
  // Content
  description: v.optional(v.string()),
  tableOfContents: v.optional(v.string()),
  summary: v.optional(v.string()),
  
  // Media
  coverImageId: v.optional(v.id("_storage")),
  coverImageUrl: v.optional(v.string()), // External URL
  
  // Inventory summary
  totalCopies: v.number(),
  availableCopies: v.number(),
  
  // Status
  catalogStatus: v.union(
    v.literal("draft"),
    v.literal("published"),
    v.literal("archived"),
  ),
  
  // Circulation rules
  isCirculating: v.boolean(),         // Can be borrowed
  loanPeriodDays: v.optional(v.number()), // Override default
  maxRenewals: v.optional(v.number()),
  
  // Metadata
  notes: v.optional(v.string()),
  internalNotes: v.optional(v.string()), // Staff only
  createdBy: v.id("users"),
  createdAt: v.number(),
  lastModifiedBy: v.optional(v.id("users")),
  lastModifiedAt: v.optional(v.number()),
})
```

**`itemCopies`** - Individual physical copies

```typescript
itemCopies: defineTable({
  organizationId: v.id("organizations"),
  itemId: v.id("libraryItems"),
  
  copyNumber: v.number(),
  barcode: v.string(),               // Unique per copy
  
  // Location
  locationId: v.optional(v.id("locations")), // Shelf/room
  shelfLocation: v.optional(v.string()),     // Specific shelf mark
  
  // Status
  status: v.union(
    v.literal("available"),
    v.literal("checked_out"),
    v.literal("on_hold"),
    v.literal("in_transit"),
    v.literal("processing"),
    v.literal("repair"),
    v.literal("lost"),
    v.literal("missing"),
    v.literal("damaged"),
    v.literal("withdrawn"),
  ),
  
  // Condition
  condition: v.union(
    v.literal("new"),
    v.literal("excellent"),
    v.literal("good"),
    v.literal("fair"),
    v.literal("poor"),
  ),
  conditionNotes: v.optional(v.string()),
  
  // Acquisition
  acquisitionDate: v.optional(v.number()),
  acquisitionMethod: v.optional(v.string()),
  acquisitionPrice: v.optional(v.number()),
  vendor: v.optional(v.string()),
  
  // Value
  replacementCost: v.optional(v.number()),
  
  notes: v.optional(v.string()),
  createdAt: v.number(),
})
```

---

### B. Patron Module

**`patrons`** - Library members

```typescript
patrons: defineTable({
  organizationId: v.id("organizations"),
  userId: v.optional(v.id("users")),  // Link to app user (optional)
  
  // Library card
  cardNumber: v.string(),             // Library card / barcode
  pin: v.optional(v.string()),        // For self-service
  
  // Personal info
  firstName: v.string(),
  lastName: v.string(),
  email: v.optional(v.string()),
  phone: v.optional(v.string()),
  dateOfBirth: v.optional(v.number()),
  
  // Address
  address: v.optional(v.object({
    street: v.string(),
    city: v.string(),
    state: v.optional(v.string()),
    postalCode: v.string(),
    country: v.optional(v.string()),
  })),
  
  // Membership
  membershipType: v.string(),         // Standard, Student, Senior, Staff, etc.
  registrationDate: v.number(),
  expirationDate: v.optional(v.number()),
  
  // Status
  status: v.union(
    v.literal("active"),
    v.literal("expired"),
    v.literal("suspended"),
    v.literal("blocked"),             // Due to fines
    v.literal("inactive"),
  ),
  blockReason: v.optional(v.string()),
  
  // Limits & privileges
  borrowingLimit: v.number(),         // Max items at once
  holdLimit: v.number(),              // Max holds at once
  
  // Balances
  fineBalance: v.number(),            // Outstanding fines
  
  // Preferences
  preferredBranch: v.optional(v.id("locations")),
  notificationPreferences: v.optional(v.object({
    email: v.boolean(),
    sms: v.boolean(),
    dueDateReminder: v.boolean(),
    holdReady: v.boolean(),
  })),
  
  // Statistics
  totalCheckouts: v.optional(v.number()),
  
  notes: v.optional(v.string()),
  createdBy: v.id("users"),
  createdAt: v.number(),
})
```

**`membershipTypes`** - Configurable membership tiers

```typescript
membershipTypes: defineTable({
  organizationId: v.id("organizations"),
  name: v.string(),                   // Standard, Student, Senior, etc.
  description: v.optional(v.string()),
  borrowingLimit: v.number(),
  holdLimit: v.number(),
  loanPeriodDays: v.number(),
  renewalLimit: v.number(),
  finePerDay: v.number(),
  gracePeriodDays: v.number(),
  fee: v.optional(v.number()),        // Annual membership fee
  isDefault: v.boolean(),
})
```

---

### C. Circulation Module

**`circulations`** - Checkout/checkin transactions

```typescript
circulations: defineTable({
  organizationId: v.id("organizations"),
  patronId: v.id("patrons"),
  copyId: v.id("itemCopies"),
  itemId: v.id("libraryItems"),       // Denormalized for queries
  
  // Dates
  checkoutDate: v.number(),
  dueDate: v.number(),
  returnDate: v.optional(v.number()),
  
  // Renewals
  renewalCount: v.number(),
  lastRenewalDate: v.optional(v.number()),
  
  // Status
  status: v.union(
    v.literal("active"),              // Currently checked out
    v.literal("returned"),
    v.literal("overdue"),
    v.literal("lost"),
    v.literal("claimed_returned"),
  ),
  
  // Fines
  fineAmount: v.optional(v.number()),
  fineStatus: v.optional(v.union(
    v.literal("none"),
    v.literal("accruing"),
    v.literal("billed"),
    v.literal("paid"),
    v.literal("waived"),
  )),
  
  // Staff
  checkedOutBy: v.id("users"),
  checkedInBy: v.optional(v.id("users")),
  
  notes: v.optional(v.string()),
})
```

**`holds`** - Reservations queue

```typescript
holds: defineTable({
  organizationId: v.id("organizations"),
  patronId: v.id("patrons"),
  itemId: v.id("libraryItems"),
  copyId: v.optional(v.id("itemCopies")), // Specific copy when fulfilled
  
  // Queue
  holdDate: v.number(),
  queuePosition: v.number(),
  
  // Pickup
  pickupLocationId: v.optional(v.id("locations")),
  availableDate: v.optional(v.number()),  // When ready for pickup
  expirationDate: v.optional(v.number()), // Pickup deadline
  
  // Status
  status: v.union(
    v.literal("pending"),             // In queue
    v.literal("available"),           // Ready for pickup
    v.literal("fulfilled"),           // Checked out
    v.literal("cancelled"),
    v.literal("expired"),
  ),
  
  // Notifications
  notificationSent: v.optional(v.boolean()),
  notificationDate: v.optional(v.number()),
  
  notes: v.optional(v.string()),
  createdAt: v.number(),
})
```

---

### D. Fines & Payments Module

**`fines`** - Fee tracking

```typescript
fines: defineTable({
  organizationId: v.id("organizations"),
  patronId: v.id("patrons"),
  circulationId: v.optional(v.id("circulations")),
  copyId: v.optional(v.id("itemCopies")),
  
  fineType: v.union(
    v.literal("overdue"),
    v.literal("lost_item"),
    v.literal("damaged_item"),
    v.literal("processing_fee"),
    v.literal("replacement_cost"),
    v.literal("membership_fee"),
    v.literal("other"),
  ),
  
  description: v.string(),
  amount: v.number(),
  amountPaid: v.number(),
  balance: v.number(),
  
  status: v.union(
    v.literal("outstanding"),
    v.literal("paid"),
    v.literal("waived"),
    v.literal("forgiven"),
    v.literal("refunded"),
  ),
  
  createdAt: v.number(),
  dueDate: v.optional(v.number()),
  paidAt: v.optional(v.number()),
  waivedBy: v.optional(v.id("users")),
  waivedReason: v.optional(v.string()),
  
  notes: v.optional(v.string()),
})
```

**`payments`** - Payment transactions

```typescript
payments: defineTable({
  organizationId: v.id("organizations"),
  patronId: v.id("patrons"),
  
  amount: v.number(),
  paymentMethod: v.union(
    v.literal("cash"),
    v.literal("card"),
    v.literal("check"),
    v.literal("online"),
    v.literal("other"),
  ),
  
  // Applied to fines
  fineIds: v.array(v.id("fines")),
  
  receiptNumber: v.optional(v.string()),
  receivedBy: v.id("users"),
  receivedAt: v.number(),
  
  notes: v.optional(v.string()),
})
```

---

### E. Acquisitions Module

**`acquisitionRequests`** - Purchase requests

```typescript
acquisitionRequests: defineTable({
  organizationId: v.id("organizations"),
  
  // Item info
  title: v.string(),
  authors: v.optional(v.array(v.string())),
  isbn: v.optional(v.string()),
  publisher: v.optional(v.string()),
  itemType: v.optional(v.string()),
  
  // Request
  requestedBy: v.id("users"),
  requestedAt: v.number(),
  reason: v.optional(v.string()),
  priority: v.union(v.literal("low"), v.literal("normal"), v.literal("high"), v.literal("urgent")),
  quantity: v.number(),
  
  // Pricing
  estimatedPrice: v.optional(v.number()),
  vendor: v.optional(v.string()),
  fundSource: v.optional(v.string()),    // Budget allocation
  
  // Workflow
  status: v.union(
    v.literal("submitted"),
    v.literal("under_review"),
    v.literal("approved"),
    v.literal("ordered"),
    v.literal("received"),
    v.literal("cataloged"),
    v.literal("rejected"),
    v.literal("cancelled"),
  ),
  
  // Approval
  reviewedBy: v.optional(v.id("users")),
  reviewedAt: v.optional(v.number()),
  reviewNotes: v.optional(v.string()),
  
  // Order tracking
  orderNumber: v.optional(v.string()),
  orderDate: v.optional(v.number()),
  expectedDelivery: v.optional(v.number()),
  receivedDate: v.optional(v.number()),
  actualPrice: v.optional(v.number()),
  
  // Link to created item
  libraryItemId: v.optional(v.id("libraryItems")),
  
  notes: v.optional(v.string()),
})
```

**`vendors`** - Supplier management

```typescript
vendors: defineTable({
  organizationId: v.id("organizations"),
  name: v.string(),
  contactName: v.optional(v.string()),
  email: v.optional(v.string()),
  phone: v.optional(v.string()),
  website: v.optional(v.string()),
  address: v.optional(v.string()),
  accountNumber: v.optional(v.string()),
  paymentTerms: v.optional(v.string()),
  discountPercent: v.optional(v.number()),
  notes: v.optional(v.string()),
  isActive: v.boolean(),
})
```

---

### F. Serials Management (Periodicals)

**`serialSubscriptions`** - Magazine/journal subscriptions

```typescript
serialSubscriptions: defineTable({
  organizationId: v.id("organizations"),
  itemId: v.id("libraryItems"),       // Parent periodical record
  
  vendorId: v.optional(v.id("vendors")),
  subscriptionNumber: v.optional(v.string()),
  
  startDate: v.number(),
  endDate: v.optional(v.number()),
  frequency: v.union(
    v.literal("daily"),
    v.literal("weekly"),
    v.literal("biweekly"),
    v.literal("monthly"),
    v.literal("bimonthly"),
    v.literal("quarterly"),
    v.literal("annually"),
    v.literal("irregular"),
  ),
  
  expectedIssues: v.optional(v.number()),  // Per year
  cost: v.optional(v.number()),
  
  status: v.union(
    v.literal("active"),
    v.literal("cancelled"),
    v.literal("expired"),
    v.literal("pending_renewal"),
  ),
  
  autoRenew: v.boolean(),
  renewalReminderDays: v.optional(v.number()),
  
  notes: v.optional(v.string()),
})
```

**`serialIssues`** - Individual issues received

```typescript
serialIssues: defineTable({
  organizationId: v.id("organizations"),
  subscriptionId: v.id("serialSubscriptions"),
  itemId: v.id("libraryItems"),
  
  issueNumber: v.optional(v.string()),
  volume: v.optional(v.string()),
  issueDate: v.optional(v.number()),
  
  receivedDate: v.optional(v.number()),
  status: v.union(
    v.literal("expected"),
    v.literal("received"),
    v.literal("claimed"),             // Requested missing issue
    v.literal("missing"),
  ),
  
  copyId: v.optional(v.id("itemCopies")), // Link to physical copy
  
  notes: v.optional(v.string()),
})
```

---

### G. Library Settings

**`librarySettings`** - Organization-level configuration

```typescript
librarySettings: defineTable({
  organizationId: v.id("organizations"),
  
  // Circulation policies
  defaultLoanPeriodDays: v.number(),
  defaultRenewalLimit: v.number(),
  renewalPeriodDays: v.number(),
  maxRenewalsAllowed: v.number(),
  
  // Fines
  finePerDayDefault: v.number(),
  maxFinePerItem: v.optional(v.number()),
  gracePeriodDays: v.number(),
  fineThresholdForBlock: v.optional(v.number()), // Block patron at this amount
  
  // Holds
  holdExpirationDays: v.number(),     // Days to pickup after notification
  maxHoldsPerPatron: v.number(),
  
  // Card numbers
  cardNumberPrefix: v.optional(v.string()),
  cardNumberLength: v.optional(v.number()),
  autoGenerateCardNumbers: v.boolean(),
  
  // Classification
  classificationSystem: v.union(
    v.literal("dewey"),
    v.literal("lc"),                  // Library of Congress
    v.literal("custom"),
  ),
  
  // Notifications
  dueDateReminderDays: v.optional(v.number()), // Days before due
  overdueNoticeDays: v.optional(v.array(v.number())), // [1, 7, 14, 30]
  
  // Receipts
  receiptHeader: v.optional(v.string()),
  receiptFooter: v.optional(v.string()),
  
  createdAt: v.number(),
  lastModifiedAt: v.optional(v.number()),
})
```

---

## 3. Frontend Pages

```pages
/settings/integrations                    # Enable integrations
/settings/integrations/library            # Library policies & config

/library                                  # Dashboard: stats, alerts, quick actions
/library/catalog                          # Browse/search all items
/library/catalog/new                      # Add item (ISBN lookup)
/library/catalog/[id]                     # Item detail + copies
/library/catalog/[id]/edit                # Edit item
/library/catalog/import                   # Bulk import

/library/patrons                          # Member list
/library/patrons/new                      # Register patron
/library/patrons/[id]                     # Profile, history, fines

/library/circulation                      # Circulation desk
/library/circulation/checkout             # Scan & checkout
/library/circulation/checkin              # Returns
/library/circulation/renew                # Bulk renewals

/library/holds                            # Hold queue management
/library/fines                             # Fine management & payments

/library/acquisitions                     # Purchase requests
/library/acquisitions/new                 # New request
/library/vendors                          # Vendor management

/library/serials                          # Subscription management
/library/serials/checkin                  # Receive issues

/library/reports                          # Circulation stats, inventory, fines
```

---

## 4. Key Features Summary

| Module | Features |
|--------|----------|
| **Catalog** | Books, periodicals, multimedia; ISBN lookup; MARC-like metadata; Dewey/LC classification; Cover images; Full-text search |
| **Copies** | Multiple copies per title; Barcodes; Condition tracking; Location assignment; Withdrawal |
| **Patrons** | Member registration; Library cards; Membership types/tiers; Borrowing limits; Contact info |
| **Circulation** | Checkout/Checkin by barcode; Due dates; Renewals; Overdue tracking; Claim returned |
| **Holds** | Place holds; Queue position; Pickup notifications; Expiration |
| **Fines** | Auto-calculate overdue; Lost/damaged fees; Payment recording; Waive with audit; Block patrons |
| **Acquisitions** | Purchase requests; Approval workflow; Order tracking; Vendor management |
| **Serials** | Subscriptions; Issue tracking; Claim missing; Renewal alerts |
| **Reports** | Circulation stats; Popular items; Overdue list; Fine collection; Inventory |
| **Settings** | Loan periods; Fine rates; Card formats; Notification schedules |

---

## 5. Implementation Phases

**Phase 1: Foundation** (2-3 days)

- Schema (all library tables)
- Integrations settings page
- Library navigation in sidebar

**Phase 2: Catalog** (3-4 days)

- Library items CRUD
- ISBN lookup (Open Library API)
- Copy management
- Search & filters

**Phase 3: Patrons** (2-3 days)

- Patron CRUD
- Membership types
- Library card generation

**Phase 4: Circulation** (3-4 days)

- Checkout/Checkin workflows
- Barcode scanning interface
- Due date calculation
- Renewals

**Phase 5: Holds & Fines** (2-3 days)

- Hold placement & queue
- Fine calculation
- Payments

**Phase 6: Advanced** (3-4 days)

- Acquisitions workflow
- Serials/subscriptions
- Reports dashboard
- Bulk import

---

Ready to proceed?
