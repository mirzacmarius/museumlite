# Prioritized improvement recommendations

Read [audit scope and verification](README.md) first. P0 means stop-ship confidentiality, unauthorized-write, or irreversible permanent-record risk. P1 means material operational correctness or reliability. P2 strengthens daily product workflows. P3 extends capabilities after foundations are reliable. These priorities do not assert that a deployed incident has occurred.

Path abbreviations: **B** = `packages/backend/convex/`; **D** = `apps/app/src/app/[locale]/(dashboard)/`; **C** = `apps/app/src/components/`; **UI** = `packages/ui/src/components/`. Complexity is Small (localized changes), Medium (several coupled components plus meaningful validation), or Large (cross-module design, migration, or external integration). Risk refers to breaking existing behavior during implementation, not to the severity of leaving the problem unfixed.

## P0 — critical problems

### R01 — Close every demonstrated cross-tenant read

- **Problem/evidence:** mixed-ID media and loan batches authorize only the first organization; import-job get/list checks only login. All three were reproduced in memory. See [media.ts:534](/Users/marius/Developer/museumlite/packages/backend/convex/media.ts:534), [loans.ts:1366](/Users/marius/Developer/museumlite/packages/backend/convex/loans.ts:1366), and [imports.ts:128](/Users/marius/Developer/museumlite/packages/backend/convex/imports.ts:128). Source review also found `accountRelationships.listByEntity` authorizes only the first relationship then returns all organizations' matching rows; [accountRelationships.ts:63](/Users/marius/Developer/museumlite/packages/backend/convex/accountRelationships.ts:63). This latter path was not separately reproduced.
- **Why it matters:** another institution's private imagery, circulation metadata, or import errors become readable.
- **Proposed solution:** authorize every referenced record against its actual tenant before reading related data or resolving file URLs. Reject mixed-tenant batches consistently; cap input length; authorize job polling against the job's organization.
- **Affected files/modules:** B `media.ts`, `loans.ts`, `imports.ts`, `accountRelationships.ts`, `utils/batchLookup.ts`, authorization helpers; relevant backend tests and batch/polling callers.
- **Database changes:** none expected.
- **UX changes:** explicit unavailable/forbidden job state; callers submit one-organization batches.
- **Complexity:** Small. **Dependencies:** none. **Regression risk:** Low; accidental mixed batches will now fail. Test both authorized access and every unauthorized position/order.

### R02 — Make public files an explicit approved projection

- **Problem/evidence:** `collections.getPublic` returns original storage URLs for every attached file, including documents with `internal_only` rights, even when high-resolution download is disabled. Reproduced anonymously; [collections.ts:3531](/Users/marius/Developer/museumlite/packages/backend/convex/collections.ts:3531).
- **Why it matters:** publishing a catalog record can publish confidential operational documents or restricted originals.
- **Proposed solution:** explicit per-file approval, approved public image rendition, rights/expiry checks, and separate permission to expose originals. Apply the same policy to list thumbnails, object details, downloads, and other public projections. Legacy files default private until reviewed; retain their storage.
- **Affected files/modules:** B `schema.ts`, `collections.ts`, `media.ts`, `mediaThumbnails.ts`, `mediaVersions.ts`, public-policy helper, migrations; D `media/`, `objects/[id]/`, `portal/`; `apps/web/src/components/public-object-detail.tsx` and public catalog pages.
- **Database changes:** per-media publishing state/approval and public rendition reference; version-aware invalidation. Additive migration, no blob deletion.
- **UX changes:** show exactly which rendition is public, approval/rights reasons, preview and unpublish controls.
- **Complexity:** Medium. **Dependencies:** R01; user approved per-file publication. **Regression risk:** High for existing public galleries; conservative defaults deliberately remove unsafe exposure and require review. Unpublishing prevents future public projections but does not by itself recall previously distributed original URLs; assess historical exposure and a retention-safe storage protection procedure during rollout.

### R03 — Authenticate live environmental devices

- **Problem/evidence:** caller-controlled `source: "sensor"` bypasses login and inserts readings/alerts. Reproduced; [conservationTreatments.ts:2372](/Users/marius/Developer/museumlite/packages/backend/convex/conservationTreatments.ts:2372).
- **Why it matters:** readings influence collection care, alerts, and evidence. Untrusted callers can fabricate them for a known location.
- **Proposed solution:** provide authenticated temperature/humidity HTTPS ingestion with scoped device credentials, tenant/location binding, validation, rate limits, stable reading identity, timestamp policy, and credential rotation/revocation. Preserve any existing sender during verified cutover. Public staff mutation always requires user authorization; device ingestion invokes an internal validated write. The user plans Tuya devices, whose exact model/gateway/transport is unconfirmed. The inspected HTTP router has no environmental receiver; locate any current gateway/receiver and map its contract rather than assume its location. A vendor adapter must verify upstream messages and forward only bound-device readings; do not assume a physical Tuya sensor accepts a custom Bearer webhook configuration.
- **Affected files/modules:** B `http.ts`, `conservationTreatments.ts`, `schema.ts`, `apiKeys.ts` or dedicated sensor credential helpers; D `settings/integrations/` and conservation/location device status UI; backend integration tests and sender configuration.
- **Database changes:** registered devices with organization/location, hashed credentials, revocation/rotation state, last accepted reading; deduplication record or sensor reading uniqueness index.
- **UX changes:** device registration, one-time credential display, rotate/revoke, last-seen/error status, audited manual readings.
- **Complexity:** Medium. **Dependencies:** current webhook sender/payload/authentication and cutover details. **Regression risk:** High; live senders must migrate. Do not retain an anonymous compatibility bypass. Lux/UV already have schema fields; adding supported measurement types later does not require a separate ingestion architecture.

### R04 — Enforce tenant integrity on all location and attachment references

- **Problem/evidence:** bulk edit accepts a foreign location without movement history; direct bulk location/exhibition install-return paths also trust location IDs. Reproduced bulk write; [batchOperations.ts:633](/Users/marius/Developer/museumlite/packages/backend/convex/batchOperations.ts:633), [collections.ts:2953](/Users/marius/Developer/museumlite/packages/backend/convex/collections.ts:2953), B `utils/exhibitionObjectLocation.ts`.
- **Why it matters:** typed IDs do not guarantee same-organization ownership; corrupted references undermine every later custody/reporting workflow.
- **Proposed solution:** validate existence, organization, active/restricted-location policy and permission at write/execution time. Actual internal moves must create history from observed current state. Inventory public handlers accepting related IDs/storage IDs, including parent objects, collection groups, parties, documents and polymorphic account relationships. Bind attachments to an authorized upload/owner before linking.
- **Affected files/modules:** B `batchOperations.ts`, `collections.ts`, `locations.ts`, `utils/exhibitionObjectLocation.ts`, `accountRelationships.ts`, `media.ts`, publication and authorization helpers; backend tests.
- **Database changes:** additive upload ownership binding if existing metadata cannot establish it; migration report for bad references. Never silently reassign a historical record.
- **UX changes:** contextual invalid-reference/conflict errors; valid destination selectors and clear partial-batch outcomes.
- **Complexity:** Medium. **Dependencies:** R01; R10 later extends custody semantics. **Regression risk:** Medium; old inconsistent links require manual repair, not guessed destinations.

### R05 — Preserve permanent records through archival withdrawal

- **Problem/evidence:** `emptyDeletedCollections` and dependent cleanup hard-delete objects, deaccessions, appraisals, movements, loan/condition evidence and files; [collections.ts:563](/Users/marius/Developer/museumlite/packages/backend/convex/collections.ts:563), [collections.ts:2274](/Users/marius/Developer/museumlite/packages/backend/convex/collections.ts:2274). Other destructive register/treatment paths also need coverage.
- **Why it matters:** this conflicts directly with the accepted permanent-record requirement. An approved disposal can erase the evidence explaining it.
- **Proposed solution:** replace object empty-trash semantics with archival withdrawal and restore. Guard every destructive path for institutional register and evidentiary records; preserve IDs, linked files and historical relationships. Treat file cleanup as reference/retention-aware, never as a generic cascade. Scan orphaned attachments without deleting evidence.
- **Affected files/modules:** B `collections.ts`, `accessions.ts`, `deaccessions.ts`, `conservationTreatments.ts`, `utils/collectionDisposition.ts`, lifecycle/cleanup/organization-deletion handlers and `schema.ts`; D object/accession trash, conservation and settings-data controls.
- **Database changes:** additive withdrawn/archive metadata and any required immutable evidence snapshots; preserve legacy deleted rows for review/restore. No destructive backfill.
- **UX changes:** withdraw reason, retained register visibility, archive filters, restore permissions and clear retention explanation. Remove museum-record purge controls.
- **Complexity:** Medium for archival protection; a future formal purge policy would be Large. **Dependencies:** user approved archival withdrawal/restore. **Regression risk:** High; deliberate change to deletion semantics, including audit of indirect cleanup and organization deletion.

## P1 — important improvements

### R06 — Make backend compilation a required quality gate

- **Problem/evidence:** root typecheck passes but backend package has no typecheck script; direct backend compiler reports 34 diagnostics. See [compiler evidence](backend-typecheck.txt), `packages/backend/package.json`, and `.github/workflows/check.yml`.
- **Why it matters:** seed, test and production TypeScript errors remain invisible to the advertised gate.
- **Proposed solution:** add a finite backend typecheck task, correct lib/import-meta/test generics and inferred array issues, retain strictness, and include it in root/CI verification. Do not hide failures by loosening types or excluding production files.
- **Affected files/modules:** backend package/config, B `collections.ts`, `migrations.ts`, seed and affected tests/helpers, root scripts/Turbo/CI as necessary.
- **Database changes:** none. **UX changes:** none.
- **Complexity:** Medium. **Dependencies:** none; run before validating Batch 1. **Regression risk:** Low–Medium; fixes may reveal genuine production contracts. Completion requires standalone and root gates passing freshly.

### R07 — Make import retries safe and progress truthful

- **Problem/evidence:** replay of one accession batch inserts two same-number rows and yields 200% progress; failed rows do not advance attempted completion. Other import handlers use differing date/status/number normalization. [imports.ts:254](/Users/marius/Developer/museumlite/packages/backend/convex/imports.ts:254).
- **Why it matters:** network retries can corrupt permanent registers and jobs may appear stuck or falsely complete.
- **Proposed solution:** durable per-row identity/outcome keyed by job and source-row number; replay returns stored result. Enforce identifier policy before insert, track attempted/success/failure separately, verify job lifecycle, bound batches and support resumable correction. Use one validated parser per data type; unknown dates remain unknown/errors.
- **Affected files/modules:** B `imports.ts`, `importValidation.ts`, `mediaImports.ts`, `utils/importRows.ts`, numbering/publication helpers and schema; D import routes; C import mapper/validation/progress components.
- **Database changes:** import row/results table, stable source identity and indexes; additive job counters/version. Existing duplicates get a review report, not automatic deletion/renumbering.
- **UX changes:** attempted versus accepted counts, downloadable row errors, retry failed rows, resume/cancel outcomes.
- **Complexity:** Medium. **Dependencies:** R01, R06; agreed accession-number policy. **Regression risk:** Medium; old clients/jobs require explicit version handling.

### R08 — Complete loan custody and return semantics

- **Problem/evidence:** dispatch clears current location without saved home location; return does not restore it. `returnItem` differs from full return, leaves parent open, and incoming return inserts synthetic approved deaccessions. [loanMovement.ts:28](/Users/marius/Developer/museumlite/packages/backend/convex/utils/loanMovement.ts:28), [loanLifecycle.ts:233](/Users/marius/Developer/museumlite/packages/backend/convex/utils/loanLifecycle.ts:233).
- **Why it matters:** a physically returned object can remain unlocated, an open loan can block further work, and borrowed objects are conflated with owned acquisitions.
- **Proposed solution:** one explicit item dispatch/return command, lifecycle state independent of condition text, captured origin and confirmed return destination, custody events, parent reconciliation, and return-to-lender workflow for incoming custody. Preserve historical synthetic deaccessions as legacy evidence without generating new ones for borrowed property.
- **Affected files/modules:** B `loans.ts`, `utils/loanLifecycle.ts`, `utils/loanMovement.ts`, occupancy/access helpers, schema; D loan detail/return UI and object status panels.
- **Database changes:** item state, origin/destination and dispatch/return timestamps/events; conservative legacy migration. Unknown former locations require staff confirmation.
- **UX changes:** per-item receipt, condition requirement, destination confirmation, partial/full completion and outstanding items.
- **Complexity:** Large. **Dependencies:** R04, R05; custody definitions and R17 condition contract. **Regression risk:** High; active/legacy incoming loans and existing condition-only returns.

### R09 — Make approval requirements effective at finalization

- **Problem/evidence:** draft accessions bypass configured source verification; deaccession readiness reports required checks but final/auto approval does not enforce them. [accessions.ts:1538](/Users/marius/Developer/museumlite/packages/backend/convex/accessions.ts:1538), [deaccessions.ts:2080](/Users/marius/Developer/museumlite/packages/backend/convex/deaccessions.ts:2080).
- **Why it matters:** green workflow status can contradict the institution's declared controls.
- **Proposed solution:** shared mutation-safe finalization rules for every entry path. Verification must cover draft and existing-object accessions. Configure method-specific disposal evidence, separate decision approval from physical exit/proceeds receipt, and require audited reasons for permitted exceptions. Avoid demanding a sale receipt before a sale can legally/operationally occur merely because a current helper conflates stages.
- **Affected files/modules:** B `accessions.ts`, `deaccessions.ts`, workflow/config/execution helpers, lifecycle helpers, tests; D accession/deaccession review/forms/settings workflows.
- **Database changes:** explicit policy/stage fields and exception event if needed; grandfathered history marked as legacy, not retrospectively rewritten.
- **UX changes:** clear blocking checklist and stage-specific required evidence; authorized exception action.
- **Complexity:** Medium. **Dependencies:** R05; policy decision per disposition method. **Regression risk:** High; existing test intentionally expects draft-verification bypass and old bare approvals need reviewed migration policy.

### R10 — Unify physical movement commands and history

- **Problem/evidence:** ordinary moves, bulk edits, loans and exhibitions mutate location separately; move requests execute stale `fromLocationId`; exhibition close can imply all objects returned. B `locations.ts:1174/1360`, `utils/exhibitionObjectLocation.ts`, `utils/exhibitionWorkflow.ts:362`.
- **Why it matters:** no reliable answer to where an object is, who last accepted custody, and which work authorized it.
- **Proposed solution:** a canonical guarded movement/custody command records actor, observed source, destination, time, authorization, reason and linked case in the same transaction as projections. Revalidate occupancy and source when executing delayed work; closing a case cannot attest physical return without recorded handoffs/exceptions.
- **Affected files/modules:** B locations/loan/exhibition/transit/installation/transfer handlers, lifecycle helpers, schema; D move, receipt, installation and close actions.
- **Database changes:** append-only custody/movement events with typed case links, correlation IDs and indexes; preserve and map legacy history.
- **UX changes:** pending versus executed movement, staff receipt confirmation, conflict/re-review flow, unified object timeline.
- **Complexity:** Large. **Dependencies:** R04, R08, R16, R17 contracts. **Regression risk:** High across physical operations; migrate by workflow with parity fixtures rather than rewrite at once.

### R11 — Make queues and search complete and correct

- **Problem/evidence:** accession board loads only first 100 rows; counts/search filter that page. Global object search uses lexical `gte` instead of prefix boundaries, reproduced with an unrelated accession. [search.ts:76](/Users/marius/Developer/museumlite/packages/backend/convex/search.ts:76); D `accessions/accessions-page-client.tsx:38`.
- **Why it matters:** staff may miss work or retrieve wrong records without realizing results are partial.
- **Proposed solution:** indexed normalized identifiers/search documents, genuine prefix ranges with upper bound or full-text search as appropriate, server-side filters, paginated queues and independent accurate stage totals. Search-on-demand selectors replace auto-draining 5,000 records.
- **Affected files/modules:** B `search.ts`, `accessions.ts`, schema/search documents; D accessions/catalog and entity selectors; C search/autocomplete/multiselect; `use-drained-collection-list.ts`.
- **Database changes:** normalized search fields/indexes and maintained queue counts if needed; bounded backfill.
- **UX changes:** pagination, total versus loaded count, no-match state, search scope and identifier priority.
- **Complexity:** Medium. **Dependencies:** R07 identifier policy, R14 query budgets. **Regression risk:** Medium; ranking/filter/cursor behavior changes.

### R12 — Stop reporting success for unsupported output

- **Problem/evidence:** generator is real only for operational KPIs; other types mark metadata-only stub as successful. Email attachment/delivery remains unimplemented and timezone parameter is ignored. Reproduced; [reporting.ts:618](/Users/marius/Developer/museumlite/packages/backend/convex/reporting.ts:618), [reporting.ts:1478](/Users/marius/Developer/museumlite/packages/backend/convex/reporting.ts:1478).
- **Why it matters:** institutions can trust a nonexistent report or a schedule running at the wrong local time.
- **Proposed solution:** explicitly support KPI snapshot schedules now; unsupported type cannot be created/run as successful. Preserve legacy configurations with actionable unavailable status. Distinguish stored output, generated file and delivered email; implement each advertised channel fully before exposing it. Validate timezone/calendar scheduling including DST and month boundaries.
- **Affected files/modules:** B `reporting.ts`, schema, crons and email actions; D analytics scheduled-report/run UI; reporting tests.
- **Database changes:** supported generator version, structured result/delivery/error state, stable schedule ID in run relationships.
- **UX changes:** truthful capability/status, output access, failure/retry detail and timezone display. Do not match runs by name alone.
- **Complexity:** Medium. **Dependencies:** R06; R29 for broader report outputs; R31 for email delivery. **Regression risk:** Medium for stored unsupported schedules.

### R13 — Make the audit register complete and stable

- **Problem/evidence:** audit list scans at most 1,000 recent rows even with date filters, filters them, and calls that count total; pagination cannot reach older matching entries. [auditLog.ts:86](/Users/marius/Developer/museumlite/packages/backend/convex/auditLog.ts:86). Embedded workflow/condition histories can grow indefinitely.
- **Why it matters:** institutional evidence must remain searchable over years and actor identity must survive profile changes.
- **Proposed solution:** database cursor pagination with supported filters/indexes; clearly labeled approximate/loaded counts where exact counts are not maintained. Add event actor/display snapshots, immutable corrections, typed entity links and workflow correlation. Move growing histories to child rows without losing original order/content.
- **Affected files/modules:** B `auditLog.ts`, `audit.ts`, workflow/condition emitters, schema; D `activity/`, `settings/activity/`, object timeline.
- **Database changes:** event/filter indexes, durable actor snapshot and normalized historical child records; additive migration.
- **UX changes:** full date-range retrieval, event grouping/diff detail, export and retained actor identity.
- **Complexity:** Medium. **Dependencies:** R05, R10 event contract. **Regression risk:** Medium; cursor/filter and existing history display.

### R14 — Bound expensive jobs and reconcile projections

- **Problem/evidence:** reports/dashboard/exports scan whole organizations, often enrich each row; iterating instead of collecting still reads unbounded data. Counter creation does not itself reconstruct old data. B `dashboard.ts`, `reporting.ts`, `imports.ts`, `organizationUsage.ts`, `utils/operationalKpis.ts`.
- **Why it matters:** large collections can exceed Convex transaction/read limits, increase reactive cost and show drifted totals.
- **Proposed solution:** measured query/job budgets, pagination and bounded continuations, maintained aggregate/time-bucket projections and reliable rebuild checkpoints. Export large selections as durable storage-backed jobs. Reconcile counts/status/membership and publish discrepancies without silently repairing historical evidence.
- **Affected files/modules:** affected B dashboard/report/export/job/counter handlers and schema; D analytics, usage and job-status UI.
- **Database changes:** aggregate/time buckets, job checkpoints/artifacts and reconciliation runs as justified by measurements.
- **UX changes:** progress/cancel/resume, consistent snapshot totals and repair-review results.
- **Complexity:** Large. **Dependencies:** R06, R07, R10, R15 definitions. **Regression risk:** Medium–High; all writers must update projections transactionally. Test small, 5,000-object and larger synthetic institutions; no current latency claim is made.

## P2 — product improvements

### R15 — Define one meaning for each dashboard metric

- **Problem/evidence:** exhibition active count, active-now list and listing schedule filters use different definitions; `isCurrent` can keep past entries active and no-workflow future exhibitions are initialized active. [operationalKpis.ts:202](/Users/marius/Developer/museumlite/packages/backend/convex/utils/operationalKpis.ts:202). Browser also showed usage/overview discrepancies needing reconciliation.
- **Why it matters:** staff cannot use inconsistent totals for planning or reporting.
- **Proposed solution:** separate approval/lifecycle from schedule phase; define current/upcoming/past and inventory/loan totals centrally with exclusions. Derive time-sensitive views from passed time or maintained transitions. Drill-down links apply the same filters as metrics; reconcile legacy flags/counters.
- **Affected files/modules:** B `utils/operationalKpis.ts`, dashboard/reporting/exhibition CRUD; `apps/app/src/lib/exhibition-schedule-status.ts`; D overview/analytics/exhibitions; usage/billing display.
- **Database changes:** migration of legacy schedule flags and optional time-bucket projections.
- **UX changes:** metric definitions, as-of time, filter-matched drill-down and missing-capacity distinction.
- **Complexity:** Medium. **Dependencies:** R14, R16. **Regression risk:** Medium; correct totals may visibly change.

### R16 — Canonicalize exhibition and collection membership

- **Problem/evidence:** exhibition requires an anchor object and also has many-object rows; objects have primary group plus group join rows. B `schema.ts:440/2276/2359`, exhibition CRUD helpers.
- **Why it matters:** competing associations complicate multi-object exhibitions, group filtering, transfer, counts and deletion.
- **Proposed solution:** Exhibition owns event metadata; one exhibition-object table owns participation. Define a primary collection group explicitly if needed, with authoritative memberships separate from presentation. Remove duplicated ownership after an additive compatibility migration.
- **Affected files/modules:** B schema/exhibition/group handlers, transfers, reporting/import/export; D exhibitions and collection/object membership forms.
- **Database changes:** backfill canonical membership and anchor roles without dropping records; staged removal only after writer/reader parity.
- **UX changes:** many-object exhibition creation, member roles/order and clear primary versus secondary group selection.
- **Complexity:** Large. **Dependencies:** R04, R05; accepted membership semantics. **Regression risk:** High; broad reader/writer migration.

### R17 — Make condition checks first-class evidence

- **Problem/evidence:** object condition/history, loan out/in reports, exhibition snapshots and treatment status do not form one condition lifecycle; one loan-item report pointer can be overwritten by the other direction. B `schema.ts:1893`, `loans.ts:1025`, conservation/exhibition helpers.
- **Why it matters:** damage, responsibility and successful treatment cannot be reliably traced to a handoff.
- **Proposed solution:** append-only object condition assessments linked to custody event/case, with separate out/in links, assessor, date, structured observations and retained photographs. Accepted assessments update current-condition projection; treatment completion includes post-treatment assessment and follow-up.
- **Affected files/modules:** B schema/loans/conservation/exhibition handlers; D object, loan, exhibition and conservation condition forms/timelines.
- **Database changes:** general assessment/event table and explicit directional links; preserve existing descriptions/photos and provenance of migrated records.
- **UX changes:** capture/compare before-after, mark damage on images, sign-off and required-check prompts.
- **Complexity:** Large. **Dependencies:** R05, R08, R10. **Regression risk:** High for existing report relations and permissions.

### R18 — Link parties and provenance across the lifecycle

- **Problem/evidence:** donor/source/owner/lender/appraiser names exist in overlapping strings, accounts, donors, ownership history and fine-art chains; generic relationships accept string IDs. B schema, `accountRelationships.ts`, `fineArtDetails.ts`, `accessions.ts`, `loans.ts`.
- **Why it matters:** staff re-enter identity/contact information and cannot distinguish a changed claim from a different person.
- **Proposed solution:** shared person/institution authority records with contextual roles; typed validated relationships to cases/objects. Provenance is dated, evidence-backed claims with confidence, uncertain/partial dates and anonymous historical parties supported. Preserve original text and merge only after staff review.
- **Affected files/modules:** B accounts/contacts/donors/relationships/provenance/loan/accession/transfer handlers and schema; D account and object provenance forms and party selectors.
- **Database changes:** normalized party links and provenance events/evidence; explicit legacy-text snapshots and reviewed duplicate resolution.
- **UX changes:** reusable party picker, role history, evidence links and suggested duplicates.
- **Complexity:** Large. **Dependencies:** R04, R05, R21 vocabulary. **Regression risk:** High; identity merges and historical interpretation.

### R19 — Reconcile appraisals, coverage and currency

- **Problem/evidence:** coverage accepts multiple targets; current-appraisal flags coexist with latest-by-date and specialized value fields; coverage stats sum active values without one effective-date/policy/currency definition. B `insurance.ts:601`, `appraisals.ts`, `utils/insuranceStats.ts`, `utils/operationalKpis.ts`.
- **Why it matters:** misleading replacement values or coverage gaps affect decisions and insurer discussions.
- **Proposed solution:** exactly one typed coverage target per row; effective validity includes policy and date interval. Canonical dated valuation by purpose/currency, with explicit supersession; specialized values become projections/references. Report totals by currency unless an as-of conversion policy and rate source are explicitly implemented.
- **Affected files/modules:** B insurance/appraisal/specialized detail/stats/alerts/report handlers and schema; D insurance/object appraisal/analytics.
- **Database changes:** discriminated coverage target, canonical valuation linkage and optional exchange-rate snapshots; review/split legacy multi-target rows.
- **UX changes:** show value purpose/date/currency, validity, covered versus insufficient/unconfirmed coverage and superseded appraisals.
- **Complexity:** Medium. **Dependencies:** R05, R14; coverage/valuation policy. **Regression risk:** High for totals and historical coverage interpretation.

### R20 — Unify vocabulary, capabilities and optional modules

- **Problem/evidence:** object internally means `collections`; patron navigation duplicates routes; insurance frontend uses conservation feature while backend uses loan permission; site CRUD uses portal entitlement. Current Pro mappings do not prove a present insurance paywall bug. B feature/module/permission helpers and sites; C sidebar.
- **Why it matters:** staff training, role administration and future plan changes inherit accidental coupling.
- **Proposed solution:** accepted glossary and capability matrix distinguishing institution/site, feature entitlement, enabled module and role permission. Canonical navigation destinations; museum/lending/CRM terms separated from library patron/circulation. Derive sidebar, page and command access from shared policy.
- **Affected files/modules:** B `utils/featurePolicy.ts`, `moduleCatalog.ts`, `permissions.ts`, `sites.ts`, `insurance.ts`, roles/init; C sidebar/feature hooks; D settings; domain docs.
- **Database changes:** permission/module mapping migration only if policy changes; preserve access intentionally granted to existing institutions.
- **UX changes:** consistent labels, reasons for unavailable actions, optional library navigation and role templates.
- **Complexity:** Medium. **Dependencies:** product policy acceptance; existing monetization decision reviewed. **Regression risk:** High if entitlements are altered; avoid accidental commercial policy changes.

### R21 — Separate custody entry/exit from acquisition/deaccession

- **Problem:** incoming borrowed objects can become synthetic deaccessions; no distinct complete workflow was found for deposits, identification submissions, rejected acquisitions, temporary custody or return-to-owner. Source/title/ownership concepts overlap.
- **Why it matters:** possessing an object is different from owning it; staff need accountable intake and exit without asserting accession or disposal.
- **Proposed solution:** entry/exit cases with temporary identifier, depositor/owner, purpose, receipt, responsibility, due/return dates, condition and custody. Acquisition records approval/title evidence; accession records the accepted permanent register identity. Exit records recipient and physical handoff. Preserve old classifications as historical assertions.
- **Affected files/modules:** B schema/accessions/loans/deaccessions/parties/movements; D intake/acquisition/loan/exit forms and registers.
- **Database changes:** entry/exit/acquisition case records and typed object/custody links.
- **UX changes:** one intake journey branching by ownership/purpose; no forced accession for a temporary deposit.
- **Complexity:** Large. **Dependencies:** R08–R10, R17–R18; institutional policy and glossary. **Regression risk:** High; changes the domain lifecycle and legacy interpretation.

### R22 — Provide case-linked operational work queues

- **Problem:** assignments, approvals, installations, transit and conservation exist but staff must assemble the next work step across modules; no complete linked case progression was found.
- **Why it matters:** deadlines and handoffs are missed despite many individual records being present.
- **Proposed solution:** case-linked tasks with accountable owner, due date, dependency and evidence-backed completion. Intake approval can propose catalog/photography/assessment tasks; approved loans/exhibitions prepare packing, insurance, transport, installation and return tasks. Keep automatic suggestions reversible; physical completion requires evidence.
- **Affected files/modules:** B assignments/workflows/installations/transit/notifications and domain events; D assignments/overview/object/case details.
- **Database changes:** typed task-to-case/event links, dependencies and idempotent trigger identity.
- **UX changes:** My work/needs review, blockers, related object/case context and actionable next step.
- **Complexity:** Large. **Dependencies:** R08–R10, R16–R17, R23. **Regression risk:** Medium; avoid duplicating manually created tasks or existing workflow approvals.

### R23 — Make automation and notification preferences reliable

- **Problem/evidence:** main emitters insert notifications without calling category/type preference helper; email behavior varies; daily/weekly digest settings lack an inspected scheduled worker. Repeated environmental alerts lack one durable deduplication lifecycle. B `notifications.ts:513/619/972/1044`, crons.
- **Why it matters:** ignored preferences and duplicate alerts encourage staff to ignore important warnings; configured mail may never arrive.
- **Proposed solution:** one idempotent event-to-recipient dispatcher with permission/site checks, preference policy, in-app/email channels, digest processing and delivery result. Separate mandatory operational alerts from optional subscriptions transparently. Environmental threshold incidents open/update/resolve one case rather than one alert per sample.
- **Affected files/modules:** B notifications/crons/workflow SLA/conservation/loan/insurance emitters and schema/email actions; D notifications/settings/device/alert status.
- **Database changes:** event deduplication, delivery/digest jobs, incident identity/state.
- **UX changes:** honest channel settings, mute versus mandatory rules, digest preview, grouped incident and delivery failures.
- **Complexity:** Medium. **Dependencies:** R03, R10, R22, R31. **Regression risk:** Medium; recipient changes can suppress or duplicate notices if defaults are mishandled.

### R24 — Use one catalog draft and robust form contract

- **Problem/evidence:** accession draft supports fewer fields than direct catalog creation; staff may re-enter dimensions/technique/tags/credit line later. Multi-module forms vary in draft/save/validation behavior. B `utils/objectDraftData.ts`, `utils/accessionObjectDraftPublication.ts`; C form sections; auto-save hooks.
- **Why it matters:** repeated entry, abandoned long forms and unclear save state waste staff time.
- **Proposed solution:** shared catalog field contract and explicitly staged required fields; drafts preserve accepted data through publication. Consistent validation, save/pending/failure/retry state, unsaved-change guard, conflict/version handling and permission-aware edits. Test overlapping saves and switching organization/record; do not assume a hook is race-safe from its name.
- **Affected files/modules:** B draft/publication/catalog validators; D intake/object/loan/exhibition/conservation/account forms; C shared fields; `use-auto-save.tsx`, `use-before-unload.tsx`.
- **Database changes:** draft/version metadata where conflict control or recovery needs it.
- **UX changes:** progressive disclosure, save status and recovery; avoid requiring full catalog completeness at intake.
- **Complexity:** Medium. **Dependencies:** R07, R09, R18 field/party contracts. **Regression risk:** Medium; serialized lists and specialized fields need round-trip fixtures.

### R25 — Standardize operational lists and recovery

- **Problem/evidence:** catalog has URL-backed filters while loan/insurance/accession state is often local; object not-found lacks a recovery action; counts and no-match/empty states differ. D list/detail clients; `use-url-filters.tsx`.
- **Why it matters:** staff lose context when refreshing, sharing or returning from a record and cannot recover from a stale link.
- **Proposed solution:** shared URL filter/sort/pagination contract and originating-list context; distinguish loading, empty organization, no matches, forbidden, missing, unavailable and stale conflict. Add meaningful detail loading boundaries informed by installed Next docs; measure layout bootstrap before changing streaming.
- **Affected files/modules:** D operational list/detail/loading/error/not-found routes, dashboard layout; C list skeleton/filter controls and URL hooks.
- **Database changes:** none expected.
- **UX changes:** shareable work queues, back-to-results, clear filter reset and actionable recovery.
- **Complexity:** Medium. **Dependencies:** R11; authenticated browser QA. **Regression risk:** Medium for deep links/cursor state; loading latency currently unmeasured.

### R26 — Verify and redesign field-device accessibility

- **Problem/evidence:** dense fixed-width kanban/toolbars and generic-div table headers present code-based concerns; mobile and assistive-technology behavior was not visually verified. UI `data-table.tsx`, `filters-panel.tsx`; D accessions/objects/locations/scan.
- **Why it matters:** technicians work beside objects with phones/tablets and may rely on keyboard or assistive technology.
- **Proposed solution:** test representative 320–390px/tablet/desktop flows, long text, keyboard/focus/dialogs and screen-reader names. Semantic tables/grid headers, labeled controls, expanded-state semantics, reachable primary actions, deliberate nested scrolling, and a scan-first field flow.
- **Affected files/modules:** shared UI table/filter/dialog primitives, app shell, affected catalog/kanban/detail/location/scan forms.
- **Database changes:** none for responsive/accessibility fixes.
- **UX changes:** stacked/overflow actions, touch-appropriate targets, accessible rows and field task summaries.
- **Complexity:** Medium. **Dependencies:** authenticated browser/devices; R25. **Regression risk:** Medium across many shared consumers; no blanket WCAG conformance claim.

### R27 — Complete localized terminology and feedback

- **Problem/evidence:** five locales are registered but many insurance, billing, selector, validation and toast strings are English literals; compile parity does not find literals. D insurance/settings; C selectors; locales.
- **Why it matters:** staff get mixed-language workflows and inconsistent procedural terms.
- **Proposed solution:** glossary-led translation, dictionary coverage for labels/errors/empty/loading/toasts, locale/date/number/currency policy and long-string review. Add literal/namespace coverage checks appropriate to the project rather than a test duplicating each string.
- **Affected files/modules:** `apps/app/src/locales/`, affected D/C/UI messages, locale tooling and public pages as in scope.
- **Database changes:** none; store procedure facts independently of translated labels.
- **UX changes:** complete translated task journeys, consistent terminology and explicit fallback behavior.
- **Complexity:** Medium. **Dependencies:** R20; translation reviewer and R26 layout checks. **Regression risk:** Low–Medium for interpolation and missing keys.

### R28 — Add documentation planning and data-quality review

- **Problem:** catalog fields exist but institution-wide completeness, duplicate identifiers, orphan references, source gaps and legacy unknowns are not a complete reviewed workflow.
- **Why it matters:** historic backlogs require manageable evidence-based work, not a form that demands invented values.
- **Proposed solution:** configurable completeness profiles by object type/stage; read-only quality checks and reviewed remediation tasks. Support unknown/uncertain values and partial dates. Validate site deletion against active descendants/references; inventory is an explicit verification procedure rather than only a dashboard total.
- **Affected files/modules:** B catalog/schema/sites/search/reporting/assignments and reconciliation jobs; D catalog/reports/work queues/settings.
- **Database changes:** quality-review runs/findings, profile configuration, inventory verification events.
- **UX changes:** completeness reasons, duplicates/orphans review and backlog prioritization with safe merge/repair controls.
- **Complexity:** Medium. **Dependencies:** R04, R07, R18, R20; R14 bounded scans. **Regression risk:** Medium; never auto-renumber or merge permanent identifiers.

### R29 — Build trustworthy reports and interoperable exports

- **Problem/evidence:** reports rely on current-state reconstructions; format conversion guesses timestamps from header substrings; formula-like CSV text is not neutralized by the inspected serializer. Spectrum mapper tests are not procedural certification. B format/Spectrum/report helpers; `apps/app/src/lib/format-converters.ts`.
- **Why it matters:** exported evidence can have wrong types, misleading as-of totals or unsafe spreadsheet interpretation.
- **Proposed solution:** typed export column schemas, reversible encoding and documented safe CSV text handling; reproducible as-of snapshots, clear filter/provenance/version/currency metadata, count/checksum reconciliation and file-access controls. Implement board, insurance, movement, conservation and inventory reports end-to-end. Document named Spectrum/interchange profile and validate representative fixtures, without advertising unverified compliance.
- **Affected files/modules:** B `reporting.ts`, `imports.ts`, `utils/formatConverters.ts`, `spectrum.ts`, `dublinCore.ts`; app format/export controls and analytics.
- **Database changes:** artifact/run snapshot and filter/generator metadata; historical projections as needed.
- **UX changes:** format/scope/as-of preview, safe complete download, real output/status and report definitions.
- **Complexity:** Large. **Dependencies:** R12–R15, R19; export consumer requirements. **Regression risk:** High for existing CSV/XML consumers; preserve documented compatibility with versioned formats.

### R30 — Rehearse recovery and migration operations

- **Problem:** no backup-restore or production migration rehearsal was executed or evidenced during this audit; green tests do not establish recovery of records plus files.
- **Why it matters:** permanent institutional evidence must survive mistakes, corruption and service disruption.
- **Proposed solution:** documented ownership, snapshot/restore rehearsal on disposable environment, file/reference verification, additive migration checkpoints and rollback plan. Monitor invariant/usage drift and job failures. Agree recovery objectives with institutions; do not assume a particular service plan provides them.
- **Affected files/modules:** Convex deployment/backup configuration, B migrations/usage/invariant checks, CI/release docs, operational alerting.
- **Database changes:** migration/reconciliation checkpoints where necessary; no production changes during this audit.
- **UX changes:** admin health/reconciliation status and actionable recovery guidance.
- **Complexity:** Medium. **Dependencies:** R05, R06, deployment access and approved recovery objectives. **Regression risk:** High if restore targets are confused; rehearsal must use isolated nonproduction targets.

### R31 — Make external delivery observable and retry-safe

- **Problem/evidence:** webhook delivery signs and attempts requests but has no inspected durable per-event delivery ledger/retry path; non-OK replies may be dropped. B `webhooksActions.ts:117`, `utils/webhookEvents.ts`; email integrations.
- **Why it matters:** partner systems silently miss object/workflow updates and retries can duplicate side effects.
- **Proposed solution:** stable event/delivery IDs, bounded timeout, durable attempts/status, retry/backoff with receiver idempotency guidance and dead-letter review. Reauthorize subscriptions/recipients; validate approved endpoints and redirect policy. Domain commands schedule external effects after transactional evidence is written.
- **Affected files/modules:** B webhook/integration/email actions, emitters, schema/crons or job worker; D developer/integration delivery logs.
- **Database changes:** outbound events/delivery attempts and bounded retention; scoped replay controls.
- **UX changes:** success/failure/retry status, endpoint tests and authorized replay.
- **Complexity:** Medium. **Dependencies:** R10, R23; partner payload/version contract. **Regression risk:** Medium for event ordering and duplicate deliveries.

### R32 — Reduce account-existence disclosure

- **Problem/evidence:** public `authLookup.hasPasswordAccountForEmail` reveals password-account existence; [authLookup.ts:4](/Users/marius/Developer/museumlite/packages/backend/convex/authLookup.ts:4).
- **Why it matters:** supports targeted enumeration; no account takeover was demonstrated.
- **Proposed solution:** generic account-recovery/provider flow without durable existence signal; enforce abuse controls on surrounding auth endpoints and preserve legitimate recovery UX.
- **Affected files/modules:** B `authLookup.ts`, authentication flow/provider configuration; `apps/app/src/auth/` and login/recovery components/tests.
- **Database changes:** none expected; abuse-control state only if needed.
- **UX changes:** neutral response and reliable recovery instructions.
- **Complexity:** Small. **Dependencies:** reviewed sign-in/provider behavior. **Regression risk:** Medium because current client branching may rely on the boolean.

## P3 — nice-to-have enhancements

### R33 — Extend verified field inventory and resilient capture

- **Problem:** scan route exists, but batch inventory sessions, container hierarchies and interrupted/offline field capture are not established end-to-end.
- **Why it matters:** periodic stocktaking and storage work become faster and more reliable.
- **Proposed solution:** inventory sessions with expected versus observed object/location, scanned verification, exception review and label/reprint workflow. Add offline drafts only with explicit encrypted storage, conflict and sync policy; a scan is evidence of observation, not automatic custody transfer.
- **Affected files/modules:** B QR/location/catalog/schema/inventory handlers; D scan/locations/inventory UI.
- **Database changes:** session/observation/exception rows and sync identity if offline mode is chosen.
- **UX changes:** guided scan checklist, mismatch handling and reviewed reconciliation.
- **Complexity:** Large. **Dependencies:** R10, R26, R28; supported device/connectivity policy. **Regression risk:** Medium–High for sync and accidental duplicate movements.

### R34 — Add incident and emergency collection workflows

- **Problem:** claims and conservation alerts cover parts of damage/loss, but a complete incident/emergency procedure with affected objects, response ownership and evidence was not found.
- **Why it matters:** staff need coordinated action during damage, loss or evacuation.
- **Proposed solution:** incident case links objects/locations/condition/photos/custody/insurance; emergency priorities and response tasks, recovery and after-action record. Institution-approved plans remain the authority.
- **Affected files/modules:** B schema/conservation/insurance/movement/assignment/notification modules; D incidents/locations/object cases.
- **Database changes:** incident/response/evidence relationships.
- **UX changes:** rapid incident intake, affected-item triage and accountable response board.
- **Complexity:** Large. **Dependencies:** R10, R17, R19, R22; institutional response policies. **Regression risk:** Medium; sensitive incident visibility must be scoped.

### R35 — Expand approved rights, reproduction and research requests

- **Problem:** media rights/download fields exist, but approved reproduction/research-use requests, acknowledgment terms and delivered derivative evidence are not complete workflows.
- **Why it matters:** institutions can reuse collections safely and respond consistently to researchers/public requests.
- **Proposed solution:** rights/evidence review, purpose-specific approval, derivative delivery and recorded terms/expiry. Integrate research/collections review with documentation backlog. Optional metadata/OCR assistance proposes reviewable drafts and never changes authoritative history automatically.
- **Affected files/modules:** B media/rights/download/account/document/workflow modules and schema; D media/portal/request/research UI; public-site request pages.
- **Database changes:** use/request/approval/delivery records, terms versions and evidence links.
- **UX changes:** request-to-decision-to-delivery journey, citations/acknowledgments and curator review.
- **Complexity:** Large. **Dependencies:** R02, R18, R23, R28, R31; rights policy and demand validation. **Regression risk:** Medium–High for licensing and external delivery scope.
