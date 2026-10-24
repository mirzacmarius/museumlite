# Export format versions

Catalog exports are version 3; audit and register exports are version 1. A job keeps the version it was created with, and its manifest describes the columns of that version.

Catalog, audit and register exports run as durable Convex jobs. Filters, format, organization, creator, schema version and creation cutoff are fixed at request creation. A selected export uploads IDs in batches of at most 100, then seals the requested count. Duplicate uploads are harmless. Missing or unauthorized selected objects fail the job; they are never silently omitted.

Catalog exports use the same filter predicate as the catalog. Catalog values and membership are captured during processing, with `capturedAt` on every row. The creation cutoff excludes later inserts. Updates before capture appear in the export; updates after capture do not change captured chunks. Deletions before capture are absent from filtered exports. This is an exhausted cursor traversal over a capture interval, not a historical snapshot of mutable catalog values. Audit exports use immutable recorded evidence and exclude inserts after the creation cutoff, including backdated events.

JSONL is UTF-8, one JSON object per line, preserving numbers, booleans, structured values and missing fields. CSV uses RFC 4180 quoting and CRLF records. Numeric columns are unlocalized numbers; dates are UTC epoch milliseconds. Empty CSV cells represent missing/null values. Text and JSON columns prefix spreadsheet formula expressions with an apostrophe based on their explicit type. CSV cannot encode spreadsheet cell types: import using the manifest column schema to retain leading zeros and literal text. CSV's `record` column contains the complete catalog JSON record; JSONL is preferable for lossless processing.

Download the manifest with the artifact. It records frozen filters, version, creation cutoff, capture interval, counts, column types, chunk counts/checksums and full artifact SHA-256. Completion requires cursor exhaustion and matching captured/emitted counts, byte counts and checksums. Audit `scanned` is returned matching entries; it does not claim the count of the underlying filtered scan. The client verifies the downloaded artifact checksum.

Inventory-scope filters inspect at most 32 loan associations per object, with ten objects per source page. A larger relation history fails visibly; export an explicit selection instead.

Limits are 16 MiB per artifact, 512 KiB per encoded page, 1,024 artifact chunks, 10,000 source pages and 200,000 requested selected IDs. Oversized jobs fail visibly; reduce the filter/selection and create a new request. Finalization consolidates at most 16 stored parts per continuation and holds at most 16 MiB of data plus bounded copies in the Node action runtime. Consolidation checkpoints survive cancellation and retry. Each new request reserves one monthly export allowance; idempotent requests, retries and downloads do not charge again.

Cancellation invalidates in-flight workers. Resume/retry continues from the last committed checkpoint. Stalled workers can be recovered after the two-minute lease expires. Interrupted selection uploads can be retried while the selection remains in the browser; after reload, create a new selection request. Audit jobs also require the Enterprise compliance feature at creation, continuation and download. Status and artifacts are limited to the request creator with current organization read permission; continuations independently recheck that permission. HTTP downloads authenticate and reauthorize each request and never expose persistent storage URLs. Already downloaded bytes cannot be recalled.

Derived files expire after seven days. Bounded cleanup removes artifact/chunk storage, retaining job and manifest metadata. Permanent museum source evidence remains unchanged. Additive schema versions require an explicit new version; parsers should ignore unknown JSON properties and use CSV headers rather than positions.

## Catalog columns and the date made

Version 2 added the date made to catalog exports (ADR 0021). Version 1 jobs keep their columns.

| Column | Type | Meaning |
| --- | --- | --- |
| dateCreated | text | The date made as written |
| dateCreatedEdtf | text | The EDTF staff entered; empty when none was |
| productionDateEdtf | text | The EDTF in effect: the entered one, otherwise what MuseumLite reads `dateCreated` as; empty when neither states a date |
| productionEarliestYear, productionLatestYear | number | The years that date spans |

The text columns follow `dateCreated` and the years follow the dimensions; `record` and JSONL carry the same fields under the same names, absent when empty. EDTF is ISO 8601-2, a subset of levels 0 and 1: `1850`, `1850-05-12`, `185X` (the 1850s), `18XX` (the 1800s), `1850~` (circa), `1850?` (uncertain), `1850%` (both), and intervals such as `1850/1860`, with `..` for an open side (`../1900` is before 1900, `1850/..` after 1850). Provenance partial dates write those open sides as `[..1937]` and `[1925..]` instead. An unspecified month or day (`1850-XX`, `1850-05-XX`) is read as the year or month and written as `1850` or `1850-05`, and an unknown side (`1850/`) as open (`1850/..`). Times, seasons, fully unspecified years (`XXXX`) and `Y`-prefixed years are not read, nor is an interval that ends before it starts. Years are astronomical, as in EDTF: 0 is 1 BC and -499 is 500 BC, written `-0499`. A circa date is widened by 5 years, 10 for a decade and 25 for a century, so `c. 1850` spans 1845 to 1855; an open side has no year. Text that does not read as a date (`Ming dynasty`) leaves the three derived values empty. In CSV, EDTF starting with `-` receives the formula apostrophe like any text (`'-0499`); the years are number cells (`-499`). A change to how MuseumLite reads date text can change `productionDateEdtf` and the years of Objects nobody edited.

The catalog filter's date made range (`madeFrom`, `madeTo`) takes inclusive astronomical years, whole numbers up to 9999 either side, with `madeFrom` not after `madeTo`. It keeps Objects whose years overlap it, open-ended dates included, and leaves undated Objects out.

## Register and report profiles

Registers and reports are institutional outputs built on the same job engine, as profiles of the `register` export source:

- registers: `accession`, `disposal`, `custody` and `condition`;
- financial reports: `valuation` (for a board) and `insurance` (a schedule for insurers);
- research report: `provenance`.

Each is a MuseumLite interchange profile with a fixed, typed column schema. They make no SPECTRUM, LIDO, accreditation or other conformance claim; profiles MuseumLite cannot produce (for example SPECTRUM or LIDO XML) are shown as unavailable and cannot be requested.

Each profile has its own version, recorded in the manifest as `generator.profileVersion` and bumped whenever that profile's columns or row semantics change: `accession`, `disposal`, `custody` and `condition` are at version 2; `valuation`, `insurance` and `provenance` at version 1. Version 2 of the registers added temporary-entry events (`entry_received`, `entry_exit`, `entry_condition`) to the custody and condition registers; columns are unchanged.

Access: the requester needs a plan with reporting (Pro or Enterprise) and `collections.read`. Custody registers also need `locations.read` and `loans.read`, and condition registers `loans.read`, because they include location and loan evidence. The insurance schedule also needs `loans.read` and the plan that includes insurance, like the Insurance page. The provenance report also needs `media.read`, because its evidence names the object's files. Every continuation, listing and download rechecks these.

Criteria are fixed at request creation, and each profile accepts only its own:

| Criterion | Profiles | Meaning |
| --- | --- | --- |
| `fromDate`, `toDate` | accession, disposal, custody, condition | UTC epoch milliseconds, inclusive, applied to the profile's event date |
| `status` | accession, disposal | `pending`, `approved` or `rejected` |
| `asOf` | all | UTC epoch milliseconds, not in the future |
| `objectId` | all but insurance | One object the organization holds, or one it transferred out |
| `purpose` | valuation | Appraisal purpose: `insurance`, `replacement`, `market`, `fair_market` or `liquidation` |
| `currency` | valuation, insurance | Upper-case ISO 4217 code, such as `EUR` |
| `inventoryScope` | valuation | `owned`, `incoming` or `unclassified` (see valuation) |
| `policyId` | insurance | One of the organization's insurance policies |

A criterion the profile does not use, an unrecognised or lower-case currency, a reversed date range or a future `asOf` is refused with the stable code `REGISTER_CRITERIA_INVALID`; an `objectId` or `policyId` outside the organization is refused as a filter outside the organization.

The preview (`registers.preview`) reads one bounded source page with the same criteria and returns the typed columns and its first ten rows. It takes the client's clock as `now`, the as-of when the criteria name none, because a query cannot read the clock; it never computes totals, which need the whole report.

As-of: `effectiveAsOf` is `criteria.asOf`, or the creation cutoff when absent. Evidence recorded after it is excluded: movements, loan condition reports and register records by recording time; accepted assessments by `acceptedAt`; loan handoffs, lender exits, transfer handoffs and legacy condition changes by their event time. Accession and deaccession rows are mutable records: descriptive values and `status` are captured at `capturedAt`, and columns suffixed `AsOf` are derived from timestamps and append-only case history at or before `effectiveAsOf`. A historical as-of therefore shows what MuseumLite had recorded by then, not later corrections or imports.

Missing facts are explicit and never inferred. Every row ends with `recordedAt`, `evidenceStatus` (`recorded`, or `legacy` when the row predates or bypassed structured evidence), `notRecorded` (semicolon-separated names of columns left empty because MuseumLite holds no record of that fact at as-of, including references held by another organization) and `capturedAt`.

Encoding: JSONL emits every schema column on each line, in schema order, with `null` for empty values. CSV has a header row, RFC 4180 quoting and CRLF records. `id` and `text` cells are always quoted; a leading apostrophe is added when the value starts with an apostrophe, a tab, CR or LF, or when its first character after leading whitespace and control characters is `=`, `+`, `-` or `@`, so a parser removes exactly one leading apostrophe from a quoted text cell. `number` and `utcEpochMs` cells are unlocalized numbers, `boolean` cells are `true` or `false`, and an unquoted empty cell is `null` (a quoted empty cell is the empty string). Decoding a CSV with the manifest `columns` therefore reproduces the JSONL values exactly; `packages/backend/tests/registerExports.test.ts` verifies this round trip for every profile.

The manifest adds `generator` (`name`, `profile` such as `register.accession`, `profileVersion`, `exportSchemaVersion`), `organizationId`, `requestedBy`, frozen `criteria`, `effectiveAsOf`, the profile's `consistency` statement and its `columns`. The `export.completed` audit entry records the profile, criteria, effective as-of and any totals with the artifact checksum. `scanned` counts source records examined (register records, objects and evidence records), not rows.

### Currency totals

The `valuation` and `insurance` profiles carry monetary columns. Their totals are computed from exactly the rows written to the artifact, page by page, and committed with each page, so a retried or resumed job never counts a page twice. The job status (`exports.status`, `exports.list`) returns them as `totals`, and the manifest has a `totals` section:

| Field | Meaning |
| --- | --- |
| `definition` | The rule below, in words |
| `groupBy` | Columns whose values form each total's group: `inventoryScope` and `purpose` for valuation, `stateAsOf` for insurance |
| `amountColumn`, `currencyColumn` | `value` and `currency` for valuation, `coveredValue` and `currency` for insurance |
| `entries` | One per group and currency: the `groupBy` columns, `currency`, `total` and `count` |

Amounts are summed per group and recognised ISO 4217 currency and are never added across currencies or converted between them. `total` is exact decimal text (0.1 and 0.2 total `"0.3"`). Rows whose currency is missing or not a recognised code are counted under `currency: null` with `total: null`, and are not summed. Rows without an amount, such as a valuation row for an object without a current valuation, are not counted. Entries are ordered by group, then currency, with null last. Profiles without monetary columns have no totals.

### accession

One row per accession record, ordered by `dateReceived`.

| Column | Type | Meaning |
| --- | --- | --- |
| accessionId | id | Accession record |
| accessionNumber | text | Accession number |
| catalogIdentifier | text | Catalogue identifier as entered |
| status | text | Stored status at capture; unknown future statuses are passed through |
| dateReceived | utcEpochMs | Date received |
| method | text | Acquisition method |
| source | text | Source as recorded |
| cost | number | Cost as recorded |
| objectId | id | Linked object |
| objectAccessionNumber, objectTitle | text | Linked object's current number and title (this organization's objects only) |
| objectPriorAccessionNumbers | text | Other numbers the object held by as-of (including the one in force at as-of if since replaced), semicolon-separated |
| sourceVerified, sourceVerificationException | boolean | Source verification state |
| identifierConflictReviewed | boolean | A duplicate-identifier review was recorded by as-of |
| approvedAt | utcEpochMs | Approval time |
| approvedBy | id | Approving user |
| approvedAsOf | boolean | Approved at or before as-of |
| approvalStepsAsOf | number | Approval steps (step 1 and later) in case history by as-of; the step-0 submission marker is not counted |

### disposal

One row per deaccession record, ordered by `dateDeaccessioned`. `category` is `deaccession`, `institution_transfer` (created by an approved transfer to another organization) or `legacy_loan_return` (a synthetic record from returning a borrowed object before lender exits existed).

| Column | Type | Meaning |
| --- | --- | --- |
| deaccessionId | id | Deaccession record |
| deaccessionNumber | text | Deaccession number |
| category | text | See above |
| status, method, reason, disposition | text | As recorded; status at capture |
| dateDeaccessioned | utcEpochMs | Deaccession date |
| objectId | id | Object |
| objectAccessionNumber | text | Current number, or the number at transfer for transferred objects |
| objectTitle | text | Title of an object this organization still holds |
| approvedAt, approvedBy, approvedAsOf, approvalStepsAsOf | utcEpochMs, id, boolean, number | As for accessions |
| decisionPolicyVersion | number | Disposal policy version checked |
| decisionCheckedAt | utcEpochMs | When the decision checks ran |
| decisionChecksPassed | boolean | Every required check passed |
| decisionException | boolean | An authorized exception waived checks |
| exitDate, exitRecipient, exitReference | utcEpochMs, text, text | Physical exit recorded by as-of |
| exitRecordedAsOf | boolean | A physical exit was recorded by as-of |
| proceedsAmount, proceedsCurrency | number, text | Proceeds as recorded |
| transferRequestId | id | Transfer request for `institution_transfer` |

Approved records without decision checks predate them and are `legacy` with the decision columns in `notRecorded`.

### custody

One row per custody event. Objects are visited in creation order, then objects transferred out of the organization (latest executed transfer each), so history stays in the source organization's register. Within an object rows follow evidence source and recording order; sort by `eventAt` for a chronological view. `eventType` is `movement`, `loan_dispatched`, `loan_returned` (outgoing loans), `lender_exit` (a borrowed object returned to its lender), `transfer_departure`, `transfer_arrival`, `entry_received` (property received into temporary custody under an entry; `counterparty` is the depositor and `reason` the entry purpose) or `entry_exit` (unaccessioned property handed to its recipient). Entry exits are custody events, never disposals, so they do not appear in the disposal register. Movements wholly within another organization's locations are not exported; a reference to another organization's location is left empty and listed in `notRecorded`. An empty location means unknown.

| Column | Type | Meaning |
| --- | --- | --- |
| eventId | id | Evidence record (`locationHistory`, `loanItems`, `loanCustodyExits`, `organizationTransferCustodyEvents` or `objectEntries`, per `evidenceSource`) |
| evidenceSource | text | Evidence table |
| eventType | text | See above |
| eventAt | utcEpochMs | When the event happened |
| objectId, objectAccessionNumber, objectTitle | id, text, text | Object |
| movementKind | text | How a movement was authorized; empty on legacy movements |
| fromLocationId, fromLocationName, toLocationId, toLocationName | id, text, id, text | This organization's locations (current names) |
| actorId | id | User who recorded the event |
| authorizedBy | id | Authorizing user of a guarded movement |
| reason | text | Movement reason |
| loanId | id | Loan for loan handoffs and lender exits |
| counterparty | text | Borrower, lender, depositor or exit recipient |
| moveRequestId, transitItemId, transferRequestId | id | Linked request, transit item or transfer |

### condition

One row per accepted condition assessment, loan condition report, condition stated at entry or legacy condition. Draft assessments are excluded. Assessments and conditions stored on the object record follow the object on institution transfer, so they appear in the register of the organization that now holds the object; loan condition reports stay with the loan's organization. `eventType` is `assessment_accepted`, `loan_condition_report`, `entry_condition` (the condition recorded when property was received under an entry, `reportDirection` `in`), `legacy_condition_change` (a catalogue condition edit) or `legacy_condition_snapshot` (an undated condition on the object record, with `assessedAt`, `assessorId` and `recordedAt` in `notRecorded`; omitted when a date range is set).

| Column | Type | Meaning |
| --- | --- | --- |
| eventId | id | Assessment, loan report or entry; empty for conditions stored on the object record |
| evidenceSource | text | Evidence table or object field |
| eventType | text | See above |
| assessedAt | utcEpochMs | When the condition was observed |
| objectId, objectAccessionNumber, objectTitle | id, text, text | Object |
| condition | text | Condition value or description |
| summary | text | Assessment summary or change note |
| observationCount, photoCount | number | Observations or damages, and photos |
| assessorId | id | Assessor |
| acceptedAt, acceptedBy | utcEpochMs, id | Acceptance of a retained assessment |
| loanId | id | Loan of a loan condition report |
| reportDirection | text | `out` or `in` for loan reports; `in` for entry conditions |

### valuation

The board valuation report: one row per current valuation of each object the organization holds that was catalogued by as-of, ordered by object catalogue order, then purpose (insurance, replacement, market, fair market, liquidation) and currency. The current valuation is the shared MuseumLite rule applied at as-of: the latest appraisal (by appraisal date, then recording time) per object, purpose and currency that was recorded by as-of and not superseded by as-of. Values are never converted between currencies. Appraisals are immutable and corrections supersede them, so a historical as-of reproduces exactly the valuations then current. An object with no current valuation matching the criteria has one row with `validityAsOf` `none`, the criteria's purpose and currency, and the missing valuation columns in `notRecorded`.

`objectStatus` and `inventoryScope` are captured at `capturedAt`. `inventoryScope` is the operational inventory classification (`operational_inventory_v1`, the definition the dashboard uses): `owned`, `incoming` (borrowed, or received under an entry and not accessioned), `unclassified` (conflicting loan evidence) or `excluded` (deaccessioned, legacy deleted, or with an open deaccession). Totals are grouped by it, so borrowed property is never added to the owned collection's value; use the `inventoryScope` criterion to report one scope.

| Column | Type | Meaning |
| --- | --- | --- |
| objectId, objectAccessionNumber, objectTitle | id, text, text | Object |
| objectStatus | text | Catalogue status at capture |
| inventoryScope | text | See above |
| purpose | text | Appraisal purpose |
| currency | text | Currency as recorded |
| currencyRecognized | boolean | The currency is a recognised ISO 4217 code; otherwise the row is `legacy` and its value is not summed |
| value | number | Appraised value, unconverted |
| validityAsOf | text | `valid` (dated by as-of and within its two-year age and any valid-until date), `renewal_due` (past either), `future_dated` (dated after as-of) or `none` |
| appraisalId | id | Appraisal |
| appraisalDate | utcEpochMs | Date of the appraisal |
| validUntil | utcEpochMs | Valid-until date, when recorded |
| renewalDueAt | utcEpochMs | Two years after the appraisal date, or the valid-until date if earlier |
| appraiserName, appraiserCompany, appraiserCredentials | text | Appraiser as recorded |
| supersedesAppraisalId | id | The appraisal this one corrected |
| supersessionReason | text | Reason given for that correction |

`recordedAt` is when the appraisal was recorded.

### insurance

The insurer schedule: one row per insurance coverage recorded by as-of, in recording order, optionally for one policy. Each coverage insures one object, loan or exhibition in its own currency.

`stateAsOf` is judged at as-of from the coverage's interval (its own dates, else its policy's period) and its policy's period: `in_force`, `not_started`, `expired`, `policy_inactive` (cancelled or suspended policy, or a policy MuseumLite cannot find), `removed` or `needs_review` (a legacy coverage naming several targets, until a person resolves it in Coverage review). A status the daily reconciliation records later (expired, active) does not change the state at an earlier as-of. Removal, cancellation and suspension have no recorded time, so they apply as recorded at capture, as do other mutable policy and coverage values such as dates; this limits how exactly a historical as-of can reproduce a past schedule. Covered loans and exhibitions are not expanded into their objects.

| Column | Type | Meaning |
| --- | --- | --- |
| coverageId | id | Coverage |
| policyId | id | Policy |
| policyNumber, carrier, policyType | text | Policy as recorded |
| policyStatusAsOf | text | `active`, `pending` or `expired` from the policy period at as-of; `cancelled` or `suspended` as recorded |
| policyEffectiveDate, policyExpirationDate | utcEpochMs | Policy period |
| targetKind | text | `object`, `loan` or `exhibition`; empty for `needs_review` |
| targetId | id | Covered object, loan or exhibition |
| targetReference | text | Object accession number or loan number |
| targetLabel | text | Object title, loan counterparty or exhibition title |
| coveredValue | number | Insured value, unconverted |
| currency | text | Currency as recorded |
| currencyRecognized | boolean | The currency is a recognised ISO 4217 code; otherwise the row is `legacy` and its value is not summed |
| coverageStart, coverageEnd | utcEpochMs | Coverage interval |
| stateAsOf | text | See above |
| appraisalStatusAsOf | text | For object coverages, the current insurance valuation at as-of in the coverage's currency: `current`, `stale` (past three years or its valid-until date), `missing` or `currency_not_recorded`; `not_applicable` for loan, exhibition and unresolved coverages |
| appraisalId, appraisalValue, appraisalDate, appraiserName | id, number, utcEpochMs, text | That valuation |

`recordedAt` is when the coverage was recorded; coverages without a recognised currency or naming several targets are `legacy`.

### provenance

The research report. Objects follow the custody register's order, including objects transferred out of the organization, whose claims stay with the organization that recorded them. For each object, `recordType` gives one row per provenance claim recorded by as-of (`claim`), then one per evidence item linked by as-of (`evidence`), then the legacy free-text provenance (`legacy_text`) and each legacy ownership history entry (`legacy_ownership`).

Claims are immutable assertions (ADR 0006). A claim corrected or retracted after as-of is current at as-of, and its review status is the latest review decision made by as-of. Claims current at as-of come first in chronological order of their partial dates, then claims corrected or retracted by as-of, most recently first, as the Provenance tab lists them. Evidence follows in the order it was linked. Partial dates are written as EDTF (ISO 8601-2): `1937-03`, `192X` (the 1920s), `1925~` (circa), `1937?` (uncertain), `[..1937]` (not after) and `[1925..]` (not before); they are never timestamps. Assertion facts a claim does not state (role, method, place, dates, or an anonymous holder's description) are listed in `notRecorded`. Legacy text and ownership entries are undated catalogue fields: they are captured at `capturedAt`, `legacy`, with `recordedAt` in `notRecorded`, and never migrated into claims. Party identifications and the fine-art provenance chain are not exported.

| Column | Type | Meaning |
| --- | --- | --- |
| recordType | text | `claim`, `evidence`, `legacy_text` or `legacy_ownership` |
| objectId, objectAccessionNumber, objectTitle | id, text, text | Object (number at transfer and no title for objects transferred out) |
| claimId | id | The claim, or the claim an evidence item supports |
| currentAsOf | boolean | Claims: not corrected or retracted by as-of. Evidence: not retracted by as-of |
| statement | text | Claim as written; the legacy text; a legacy entry's description |
| partyKind | text | `named`, `anonymous` or `unknown` holder |
| partyText | text | Holder as the source names or describes them; a legacy entry's owner |
| role | text | `owner` or `custodian`; empty when the source does not say |
| method | text | `purchase`, `auction`, `gift`, `bequest`, `inheritance`, `exchange`, `commission`, `fieldCollection`, `confiscation`, `restitution` or `other` |
| place | text | Place as written |
| startDate, endDate | text | EDTF partial dates |
| confidence | text | `documented`, `probable`, `possible` or `unassessed` |
| reviewStatusAsOf | text | `unreviewed`, `accepted`, `disputed` or `rejected` at as-of |
| reviewedAt, reviewedBy, reviewNote | utcEpochMs, id, text | That review decision |
| contradictsClaimId | id | The claim this claim was recorded against |
| contestedAsOf | boolean | Part of a contradiction at as-of, following corrections to the current claim |
| supersedesClaimId | id | The claim this claim corrects |
| supersededAt, supersededByClaimId, supersessionReason | utcEpochMs, id, text | Correction or retraction by as-of; no replacement for a retraction |
| evidenceId | id | Evidence item |
| evidenceKind | text | `citation` or `media` |
| citation, url | text | Citation as entered; a legacy entry's verification source |
| mediaId | id | Cited file of the object |
| fileName | text | The file's name when it was cited |
| excerpt, locator | text | What the source says, and the page, lot or folio |
| retractedAt, retractionReason | utcEpochMs, text | Evidence retracted by as-of |
| legacyStartYear, legacyEndYear | text | A legacy entry's years as recorded |
| legacyVerified | boolean | A legacy entry was marked verified |

## Catalog columns for the description and rights

Version 3 added the number of objects, subject, completeness, measured parts and rights statements to catalog exports (ADR 0022). Version 1 and 2 jobs keep their columns.

| Column | Type | Meaning |
| --- | --- | --- |
| dimensionUnit, weightUnit | text | The units of the main set of measurements, as entered |
| dimensionMeasuredPart | text | The part the main set was taken from: `overall`, `framed`, `unframed`, `image`, `sight`, `sheet`, `plate`, `mount`, `base` or `other`; empty when not stated |
| measurementSets | json | Further sets of measurements, one per part: `part`, an optional `partNote` ("lid"), any of `height`, `width`, `depth`, `diameter` and `weight` (numbers above 0), and optional `unit` and `weightUnit` |
| numberOfObjects | number | How many things the record describes (2 for a pair); empty when not recorded |
| subjects | text | What the Object depicts or is about, apart from `tags`; CSV joins the terms with `; ` and JSONL keeps the list |
| completeness | text | `complete`, `incomplete` or `fragment`; empty when not recorded |
| completenessNote | text | What is missing, as written |
| rightsStatement | text | The rights statement URI recorded on the Object; empty when none was |
| rightsStatementInEffect | text | The recorded URI, otherwise the Organization's default for Objects when the row was captured; empty when neither is set |

The columns follow the four measurement numbers and come before the production years; `record` and JSONL carry the same fields under the same names, absent when empty. A statement URI is one of the twelve RightsStatements.org statements (`http://rightsstatements.org/vocab/InC/1.0/`), CC0 or the Public Domain Mark (`https://creativecommons.org/publicdomain/zero/1.0/`, `.../mark/1.0/`) or a Creative Commons 4.0 licence (`https://creativecommons.org/licenses/by-sa/4.0/`). A change to the Organization's default changes `rightsStatementInEffect` of Objects nobody edited. Images carry their own statements, which catalog exports do not include.

`recordedAt` is when a claim was recorded or an evidence item linked.

### Limits

Register pages read at most 25 register records, or 25 objects and 200 evidence records (in batches of 20, stopping at about 128 KiB of row data), and continue mid-object across pages. Valuation pages read 25 objects and insurance pages 25 coverages. An object with more than 200 appraisals or provenance claims, or a claim with more than 100 review decisions, fails visibly with a processing-limit error, as does an object with more than 32 loan associations in the valuation report, whose inventory scope could not be classified. A record with more than 200 approval steps, an object with more than 100 transfer requests, lender exits or identifier reviews, or a loan object with more than 20 condition reports fails visibly with a processing-limit error rather than truncating. An object transferred during capture may be omitted from that run's custody, condition or provenance output.

## Smaller legacy exports

Smaller legacy exports (list CSV buttons, data settings CSV, analytics report summaries and server CSV/XML profile exports) are not durable jobs and do not carry manifests. Their CSV cells follow the same type-based policy: numbers and booleans are unlocalized, Date values are UTC ISO timestamps, and text cells starting with a formula prefix receive a leading apostrophe. Column names never change how a cell is encoded.

The date made in these files:

- The Objects page export (CSV, JSON and XML) carries `dateCreated`, `dateCreatedEdtf`, `productionDateEdtf`, `productionEarliestYear` and `productionLatestYear` as in catalog exports; in its CSV the years are bare numbers.
- The data settings CSV and the objects import template carry `dateCreated` and `dateCreatedEdtf` only, so a re-import never turns a reading of the text into an entered date. The objects import reads `dateCreatedEdtf` as EDTF after removing one leading apostrophe before `-`, stores it in canonical form, and fails the row when it is not EDTF MuseumLite reads (see above).
- Dublin Core (oai_dc) writes the text as the first `dc:date` (the entered EDTF when there is no text), followed by the entered EDTF when that first value does not read as it: EDTF `1910-11` is November 1910, but as text it reads as 1910 to 1911, so it is written twice. Importing it, the first `dc:date` is the text, and the first later one that is EDTF becomes the entered date unless the text reads as that same EDTF.
- SPECTRUM XML keeps `<dateCreated>` as written and adds `<productionDateEdtf>`, `<productionDateEarliest>` and `<productionDateLatest>`, the EDTF in effect and its years.

The description and rights in these files:

- The Objects page export carries `dimensionMeasuredPart`, `measurementSets`, `numberOfObjects`, `subjects`, `completeness`, `completenessNote`, `rightsStatement` and `rightsStatementInEffect` as in catalog exports. Its CSV writes the sets as JSON text, the subject terms joined with `; ` and the number as a bare number; its XML repeats a `subjects` element per term and a `measurementSets` element per set.
- The data settings CSV and the objects import template carry the entered values only: `numberOfObjects`, `subjects` (joined with `; `), `completeness`, `completenessNote`, `dimensionMeasuredPart`, `measurementSets` (JSON) and `rightsStatement`, never the statement in effect, so a re-import never turns the Organization's default into the Object's own statement. The objects import reads a whole number from 1 to 100000, at most 50 subject terms of at most 200 characters (blank terms and repeats in any letter case are dropped), completeness and measured parts as the codes above or as the labels the app shows in any of its languages ("Ufullstendig", "Med ramme", "Encadré"), in any letter case, at most 20 further sets each with at least one value above 0, and a statement written as either URI scheme, without its trailing slash, as a RightsStatements.org or Creative Commons web page, or as a code such as `InC-EDU`, `CC0`, `PDM` or `CC BY-SA 4.0`. Other Creative Commons versions, such as 3.0, are refused, not upgraded. A value it cannot read fails the row.
- Dublin Core (oai_dc) writes the subject terms and then the tags as `dc:subject`, each term once, and the statement in effect as the first `dc:rights`, followed by the credit line, which ends in `; Legal restrictions apply` (or is only `Legal restrictions apply`) when the Object has legal restrictions. Importing it, the first 50 `dc:subject` terms of at most 200 characters become subject terms and the others, longer ones included, become tags, so no record fails for its subjects. The first `dc:rights` that names a statement becomes the Object's own statement; the other `dc:rights` values become the credit line, less the legal restrictions text, which marks the Object as having legal restrictions.
- SPECTRUM XML adds `<numberOfObjects>`, `<subject>` per term, `<completeness>`, `<completenessNote>`, `<measuredPart>` (and `<partNote>`) inside the main `<dimensions>`, which also holds the main `<weight>` when a part is stated (otherwise `<weight>` stays on its own; a part with no height, width, depth or weight is not written), a further `<dimensions>` element per set, and `<rightsStatement>`, the statement in effect.
