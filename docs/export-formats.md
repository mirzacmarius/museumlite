# Export format version 1

Catalog, audit and register exports run as durable Convex jobs. Filters, format, organization, creator, schema version and creation cutoff are fixed at request creation. A selected export uploads IDs in batches of at most 100, then seals the requested count. Duplicate uploads are harmless. Missing or unauthorized selected objects fail the job; they are never silently omitted.

Catalog exports use the same filter predicate as the catalog. Catalog values and membership are captured during processing, with `capturedAt` on every row. The creation cutoff excludes later inserts. Updates before capture appear in the export; updates after capture do not change captured chunks. Deletions before capture are absent from filtered exports. This is an exhausted cursor traversal over a capture interval, not a historical snapshot of mutable catalog values. Audit exports use immutable recorded evidence and exclude inserts after the creation cutoff, including backdated events.

JSONL is UTF-8, one JSON object per line, preserving numbers, booleans, structured values and missing fields. CSV uses RFC 4180 quoting and CRLF records. Numeric columns are unlocalized numbers; dates are UTC epoch milliseconds. Empty CSV cells represent missing/null values. Text and JSON columns prefix spreadsheet formula expressions with an apostrophe based on their explicit type. CSV cannot encode spreadsheet cell types: import using the manifest column schema to retain leading zeros and literal text. CSV's `record` column contains the complete catalog JSON record; JSONL is preferable for lossless processing.

Download the manifest with the artifact. It records frozen filters, version, creation cutoff, capture interval, counts, column types, chunk counts/checksums and full artifact SHA-256. Completion requires cursor exhaustion and matching captured/emitted counts, byte counts and checksums. Audit `scanned` is returned matching entries; it does not claim the count of the underlying filtered scan. The client verifies the downloaded artifact checksum.

Inventory-scope filters inspect at most 32 loan associations per object, with ten objects per source page. A larger relation history fails visibly; export an explicit selection instead.

Limits are 16 MiB per artifact, 512 KiB per encoded page, 1,024 artifact chunks, 10,000 source pages and 200,000 requested selected IDs. Oversized jobs fail visibly; reduce the filter/selection and create a new request. Finalization consolidates at most 16 stored parts per continuation and holds at most 16 MiB of data plus bounded copies in the Node action runtime. Consolidation checkpoints survive cancellation and retry. Each new request reserves one monthly export allowance; idempotent requests, retries and downloads do not charge again.

Cancellation invalidates in-flight workers. Resume/retry continues from the last committed checkpoint. Stalled workers can be recovered after the two-minute lease expires. Interrupted selection uploads can be retried while the selection remains in the browser; after reload, create a new selection request. Audit jobs also require the Enterprise compliance feature at creation, continuation and download. Status and artifacts are limited to the request creator with current organization read permission; continuations independently recheck that permission. HTTP downloads authenticate and reauthorize each request and never expose persistent storage URLs. Already downloaded bytes cannot be recalled.

Derived files expire after seven days. Bounded cleanup removes artifact/chunk storage, retaining job and manifest metadata. Permanent museum source evidence remains unchanged. Additive schema versions require an explicit new version; existing version 1 parsers should ignore unknown JSON properties and use CSV headers rather than positions.

## Register profiles (profile version 1)

Registers are institutional outputs built on the same job engine: `accession`, `disposal`, `custody` and `condition`. Each is a MuseumLite interchange profile with a fixed, typed column schema. They make no SPECTRUM, LIDO, accreditation or other conformance claim; profiles MuseumLite cannot produce (for example SPECTRUM or LIDO XML) are shown as unavailable and cannot be requested.

Access: the requester needs `collections.read` and a plan with reporting (Pro or Enterprise). Every continuation and download rechecks both. Criteria are fixed at request creation: `fromDate`/`toDate` (UTC epoch milliseconds, inclusive, applied to the profile's event date), `status` (`pending`, `approved` or `rejected`; accession and disposal only), `asOf` (UTC epoch milliseconds, not in the future) and `objectId` (one object of the organization). Invalid criteria are refused with the stable code `REGISTER_CRITERIA_INVALID`; an `objectId` outside the organization is refused as a filter outside the organization.

As-of: `effectiveAsOf` is `criteria.asOf`, or the creation cutoff when absent. Evidence recorded after it is excluded: movements, loan condition reports and register records by recording time; accepted assessments by `acceptedAt`; loan handoffs, lender exits, transfer handoffs and legacy condition changes by their event time. Accession and deaccession rows are mutable records: descriptive values and `status` are captured at `capturedAt`, and columns suffixed `AsOf` are derived from timestamps and append-only case history at or before `effectiveAsOf`. A historical as-of therefore shows what MuseumLite had recorded by then, not later corrections or imports.

Missing facts are explicit and never inferred. Every row ends with `recordedAt`, `evidenceStatus` (`recorded`, or `legacy` when the row predates or bypassed structured evidence), `notRecorded` (semicolon-separated names of columns left empty because MuseumLite holds no record of that fact at as-of, including references held by another organization) and `capturedAt`.

Encoding: JSONL emits every schema column on each line, in schema order, with `null` for empty values. CSV has a header row, RFC 4180 quoting and CRLF records. `id` and `text` cells are always quoted; a leading apostrophe is added when the value starts with a formula prefix (`=`, `+`, `-`, `@` after optional leading whitespace, or a leading tab, CR or LF) or with an apostrophe, so a parser removes exactly one leading apostrophe from a quoted text cell. `number` and `utcEpochMs` cells are unlocalized numbers, `boolean` cells are `true` or `false`, and an unquoted empty cell is `null` (a quoted empty cell is the empty string). Decoding a CSV with the manifest `columns` therefore reproduces the JSONL values exactly; `packages/backend/tests/registerExports.test.ts` verifies this round trip for every profile.

The manifest adds `generator` (`name`, `profile` such as `register.accession`, `profileVersion`, `exportSchemaVersion`), `organizationId`, `requestedBy`, frozen `criteria`, `effectiveAsOf`, the profile's `consistency` statement and its `columns`. The `export.completed` audit entry records the profile, criteria and effective as-of with the artifact checksum. `scanned` counts source records examined (register records, objects and evidence records), not rows.

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
| objectPriorAccessionNumbers | text | Superseded object numbers, semicolon-separated |
| sourceVerified, sourceVerificationException | boolean | Source verification state |
| identifierConflictReviewed | boolean | A duplicate-identifier review was recorded by as-of |
| approvedAt | utcEpochMs | Approval time |
| approvedBy | id | Approving user |
| approvedAsOf | boolean | Approved at or before as-of |
| approvalStepsAsOf | number | Approval steps in case history by as-of |

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

One row per custody event. Objects are visited in creation order, then objects transferred out of the organization (latest executed transfer each), so history stays in the source organization's register. Within an object rows follow evidence source and recording order; sort by `eventAt` for a chronological view. `eventType` is `movement`, `loan_dispatched`, `loan_returned`, `lender_exit`, `transfer_departure` or `transfer_arrival`. Movements wholly within another organization's locations are not exported; a reference to another organization's location is left empty and listed in `notRecorded`. An empty location means unknown.

| Column | Type | Meaning |
| --- | --- | --- |
| eventId | id | Evidence record (`locationHistory`, `loanItems`, `loanCustodyExits` or `organizationTransferCustodyEvents`, per `evidenceSource`) |
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
| counterparty | text | Borrower, lender or exit recipient |
| moveRequestId, transitItemId, transferRequestId | id | Linked request, transit item or transfer |

### condition

One row per accepted condition assessment, loan condition report or legacy condition. Draft assessments are excluded. `eventType` is `assessment_accepted`, `loan_condition_report`, `legacy_condition_change` (a catalogue condition edit) or `legacy_condition_snapshot` (an undated condition on the object record, with `assessedAt`, `assessorId` and `recordedAt` in `notRecorded`; omitted when a date range is set).

| Column | Type | Meaning |
| --- | --- | --- |
| eventId | id | Assessment or loan report; empty for conditions stored on the object record |
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
| reportDirection | text | `out` or `in` for loan reports |

Register pages read at most 25 register records, or 25 objects and 200 evidence records, and continue mid-object across pages. A record with more than 200 approval steps or a loan object with more than 20 condition reports fails visibly with a processing-limit error.

Smaller legacy exports (list CSV buttons, data settings CSV, analytics report summaries and server CSV/XML profile exports) are not durable jobs and do not carry manifests. Their CSV cells follow the same type-based policy: numbers and booleans are unlocalized, Date values are UTC ISO timestamps, and text cells starting with a formula prefix receive a leading apostrophe. Column names never change how a cell is encoded.
