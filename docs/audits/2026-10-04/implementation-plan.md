# Implementation plan

Application implementation has not started. Each batch requires the user's explicit approval. Approval of this audit or answering its scope questions does not approve code changes. The recommendations are numbered in [recommendations.md](recommendations.md); accepted constraints and proposed domain definitions are in [domain-and-workflows.md](domain-and-workflows.md).

Complexity estimates are relative engineering scope, not calendar promises. Every batch is complete only when its backend, schema/migration, UI, validation, permissions, failure/recovery behavior and applicable workflow tests work together. A database field or button alone is not a delivered feature.

## Batch 1 — security and permanent-record protection

**Recommended first batch.** Covers R01–R06. Overall complexity: **Large** because it combines several Medium changes and migration/integration boundaries. Breaking-change risk: **High**, chiefly publication, retention and device authentication. Those behavior changes are intentional and already decided; sender details remain to be established before live cutover.

The outcome is a tenant-safe application that retains institutional evidence, publishes only approved files, and has a working authenticated environmental receiver and truthful compiler gate. Existing live readings must continue through a verified authenticated sender before production cutover; planned Tuya devices must not be presented as connected until their gateway/adapter is tested.

### Ordered work

1. **Establish the backend compiler gate (R06).** Add a finite backend typecheck script to the workspace/CI contract and resolve the 34 observed diagnostics without reducing strictness. Inspect actual affected production, seed and test contracts. Run root and standalone backend checks freshly. This provides a dependable gate for the remaining work.
2. **Close tenant-read boundaries (R01).** Validate every media/loan batch member and import job against the actor's organization/permission; cap inputs and apply a consistent failure contract. Inspect all batch lookup callers and similar public endpoints. Preserve valid same-tenant results and usable job-error UI.
3. **Protect related-record writes (R04).** Inventory public handlers receiving entity/storage references. Validate each actual record's organization and access at execution, bind uploaded files to authorized ownership, and make existing bulk/exhibition internal location changes record observed-source movement history. Produce an actionable report for legacy invalid links. The later custody redesign expands loan/transit semantics; this step must already stop corruption and history bypass.
4. **Implement explicit public file approval (R02).** Add file/version approval and a public-rendition reference; create/reuse a functioning derivative pipeline. Add rights-aware approve/unpublish/preview controls and permissions. Every public object/list/thumbnail/download path uses the same projection. Migrate legacy files to private pending review while preserving originals, existing attachments and evidence. Rights/version changes invalidate an unsafe approved projection. Never fall back to the original URL when a rendition is missing.
5. **Implement archival withdrawal and restore (R05).** Replace museum object purge controls and guard direct/indirect destruction of accession, disposal, conservation, condition, movement and linked documentary evidence, including organization cleanup paths. Preserve IDs, timestamps, files and relationships. Provide reason, archived register access, restore permission and dependency/conflict handling. Distinguish reversible catalog withdrawal from approved physical disposal. Any legacy record whose evidence is already missing needs a review result, not invented history.
6. **Implement authenticated environmental ingestion (R03).** Register device/gateway bindings, issue one-time credentials, hash stored credentials, rotate/revoke, validate units/timestamps/identity and bound input/rate limits. The HTTP receiver invokes an internal transactional write; manual readings require staff permissions. Stable reading identity makes retry acknowledgement safe. Device status shows last accepted observation and errors. Confirm Tuya model/cloud service/gateway before choosing vendor transport. Where a current sender exists, map its contract, provision its binding, verify forwarding and uninterrupted readings, then remove the anonymous path at cutover. Do not deploy anonymous compatibility mode.

### Affected modules and schema

Backend: `packages/backend/convex/{media,collections,loans,imports,batchOperations,locations,conservationTreatments,http,schema}.ts`; related authorization, upload ownership, exhibition location, archive/cleanup and media-rendition helpers; backend tests. Compiler work also affects backend package/config, seeds/tests, root task graph and CI.

UI: object/media publication controls and public consumers, archive/trash/detail/filter/restore controls, device integration/status pages, invalid-reference and import-polling errors. Shared labels/controls must use the existing localization/form patterns. `apps/web` public object/catalog consumers are part of the security surface.

Database additions: media approval/version/rendition metadata; retained archive metadata; device credentials/bindings and reading deduplication; upload ownership binding where needed. Indexes must support bounded organization-scoped reads. No historical record/blob deletion, identifier reassignment or guessed location backfill.

### Acceptance criteria

| Complete scenario | Required evidence |
| --- | --- |
| Authorized member reads its files, loan metadata and import diagnostics | Same-tenant behavior works; anonymous/nonmember/wrong role fails; foreign ID in every batch position/order cannot reveal a URL or metadata |
| Staff changes a location through ordinary, bulk or exhibition paths | Destination belongs to permitted organization; invalid/restricted/deleted destination fails before write; history records observed source and actor; valid existing flow still works |
| Staff uploads/attaches a file | File ownership/context is validated; a foreign blob/reference cannot be attached; supported upload/edit/version workflows remain functional |
| Public visitor opens a published object and public list | Only approved eligible image renditions appear; internal/restricted/unknown-rights documents/originals stay inaccessible through public projections; missing rendition never exposes original |
| Staff approves, changes rights/version, then unpublishes a file | Correct role required; preview matches public output; unsafe changes invalidate publication; withdrawal removes all public projections and cache references |
| Staff withdraws/restores a museum record with accession, disposal, movement, loan, condition and treatment evidence | IDs/files/history remain; routine/archive views are clear; unauthorized restore/purge fails; indirect organization/register cleanup cannot destroy permanent evidence |
| Registered sender submits a valid reading and retries it | One retained reading with correct organization/location/units/observation time; one logical alert contribution; replay gives safe acknowledgement |
| Anonymous, wrong-device/location, revoked or malformed sensor submission | Rejected before data/alert write; credential not logged/returned; manual staff path retains permissions |
| Sensor integration rollout | Generic receiver tested with fixture sender; any real sender tested through authenticated path before cutover; device online state reflects evidence; no unsupported Tuya setup button |
| Migration of legacy records | Rehearsed on isolated fixtures/snapshot where authorized; counts/IDs/relationships retained; public files conservative; ambiguous links reported; rerun is safe |
| Verification gate | Fresh lint, all workspace types plus standalone backend compiler, complete existing suites and new regression cases pass; affected UI/public/device/archive workflows inspected |

The temporary audit probes must become negative regression tests asserting the corrected behavior. They currently prove that defects exist; a green copy of those assertions would not demonstrate a fix.

### Dependencies and rollout limits

Public-file approval and archival decisions are settled. No new approval question is needed to design these within an approved batch. The remaining integration dependency is the actual Tuya device/gateway/cloud project and supported payload/transport. Implementing a generic receiver is a complete capability; advertising a Tuya-specific connector requires a complete vendor adapter and verified device flow.

For any live sender, do not infer it can set a Bearer header. Use the supported authenticated upstream transport and a trusted adapter if required. Preserve the user's continuity requirement; if sender access is unavailable, report that production cutover is not yet verified rather than claim completion of live connectivity. Do not ask for secrets in chat or commit them.

Approval to implement code does not itself prove a deployment/migration is safe. Before any deployment, identify the actual target, inspect the concrete diff, rehearse relevant additive data changes, and report the cutover/rollback procedure. A rollback must never re-enable confidential publication, anonymous writes or destructive purging.

## Batch 2 — intake, identifiers and complete queues

**Recommendations:** R07, R09, R11; intake portion of R24. **Complexity:** Large. **Risk:** High for existing approvals/duplicates, Medium for search and jobs. **Dependencies:** Batch 1; institution-approved numbering and stage-specific accession/disposal policy. Search correctness can be localized first, while the shared identifier contract precedes its backfill.

Deliver a complete intake journey: capture a shared draft, validate and review source evidence, approve an accession under organization policy, create/link one object, and find it in a complete paginated queue. Imports use stable job/row identity and truthful attempted/accepted/failed counts. Replaying a batch cannot create duplicate register rows. Disposal approval respects the correct stage instead of requiring future sale evidence before authorization.

Affected modules: imports/import validation/media imports, accession/deaccession approval and numbering helpers, global search, accession board, import mapper/progress and shared draft forms. Add durable import outcomes, normalized search/identifier fields and policy-stage metadata with additive migrations. Review historical duplicates; preserve original identifiers and decisions. UI shows row errors/resume, blocking requirements, unsaved draft and total/loaded counts.

Acceptance: new and existing-object accession obey the same controls; permitted exceptions are audited; retry/interruption resumes without duplicate objects/register rows; failed rows reach a truthful terminal job state; more than 100 queue records and more than 5,000 selectable objects remain reachable; identifier search excludes unrelated lexical matches; foreign-party/reference access remains denied. Run the import-to-approval-to-catalog workflow and unchanged direct catalog/library paths.

## Batch 3 — custody, returns and condition evidence

**Recommendations:** R08, R10, R16, R17. The incoming-return correction establishes the minimum custody-versus-deaccession distinction from R21; extended entry/exit is Batch 5. **Complexity:** Large. **Risk:** High across loans, exhibitions, transport and location. **Dependencies:** Batches 1–2; accepted custody, membership and assessment definitions. Define these contracts together before moving any writer; retain legacy histories and ambiguous states.

Deliver per-item loan dispatch/partial/full return with confirmed destination and condition, exhibition multi-object participation/installation/deinstallation, and a guarded movement command shared with transit, installations and transfers. Each physical handoff writes evidence and projections transactionally. A parent case reconciles its actual item states; closing an exhibition cannot invent a return. Incoming borrowed objects exit to lender without generating new synthetic deaccessions.

Affected modules: loan lifecycle/movement, location move requests/execution, exhibition CRUD/workflow/member location helpers, transit/installation/transfer, condition/conservation handlers and corresponding detail/action forms. Add item state/origin/destination, canonical membership, custody events, first-class assessments and separate directional links. Preserve old deaccessions as legacy assertions; unknown origin/condition needs explicit staff review.

Implement in dependency order within the approved batch: canonical relations and assessment/event contracts; one guarded handoff command; migrate each writer/reader with parity fixtures; reconcile parents and expose the unified timeline. Each migrated workflow must already be complete. Remove contradictory legacy writers after parity is proven.

Acceptance: one object can be received, located, assessed, dispatched, shipped, received/installed, deinstalled/returned and stored with a reconstructable timeline. Test partial loan returns, stale move source, competing loan/exhibition occupancy, wrong tenant/role, new damage, unknown historical origin, incoming lender return and closure with outstanding items. No condition overwrite, duplicate membership or inferred physical receipt. Inventory unchanged IDs/evidence before/after migration.

## Batch 4 — reliable history, bounded jobs and honest metrics

**Recommendations:** R12–R15, R30. R15's definitions precede R14's projections; R13 uses Batch 3's event contract. **Complexity:** Large. **Risk:** Medium–High for historic views, metrics and schedules. **Dependencies:** Batches 1–3; target-volume/query budgets and metric definitions.

Deliver complete searchable audit history, bounded long-running jobs with durable artifacts/progress, reconciled dashboard/KPI projections, truthful supported scheduled reports, timezone-aware scheduling and rehearsed recovery. Existing unsupported report configurations become explicit unavailable records; no metadata-only success or advertised undelivered email. R31's delivery infrastructure later enables channels not yet supported.

Affected modules: audit/history, dashboard/KPI/reporting, organization usage, export jobs/counters, crons, analytics/job-status/history UI, migration/backup runbooks. Add cursor/filter indexes and actor snapshots, normalized growing histories, projection buckets and rebuild checkpoints, job artifacts/run results and schedule relationships. Use exact totals only where actually maintained; distinguish snapshot, file generation and delivery states.

Acceptance: old date ranges beyond the latest 1,000 events remain accessible; actor/subject evidence survives profile changes; interrupted/replayed/rebuilt jobs retain progress and produce complete authorized output; schedule tests cover timezone/DST/month boundaries; metric drill-down matches its count; unsupported output fails truthfully. Use synthetic large institutions to measure query/memory/continuation behavior and rehearse restore/reconciliation in an isolated authorized environment. Do not claim production capacity or recovery without the measurement/drill.

## Batch 5 — parties, provenance, entry/exit and financial records

**Recommendations:** R18, R19, R21, R29. **Complexity:** Large. **Risk:** High for historical interpretation, identity merges, value totals and exchange/export contracts. **Dependencies:** Batches 1–4; accepted party/provenance, acquisition/custody, valuation/currency and export-profile policy.

Deliver one accountable entry-to-acquisition/temporary-custody-to-exit journey, evidence-backed provenance and shared party reuse, purpose-specific valuation/effective coverage and real report/export profiles. A temporary deposit or rejected acquisition can leave without permanent accession or deaccession. Dates/uncertainty and original claims remain visible; no automatic identity merge or retroactive title assertion.

Affected modules: accounts/contacts/donors/relationships/provenance, accessions/loans/deaccessions/entry-exit, insurance/appraisals/specialized detail, reporting/export and associated forms/registers. Add party/provenance/evidence links, entry/exit/acquisition cases, canonical typed coverage and valuation relationships, real report profile/artifact metadata. Backfill with reviewable legacy links/snapshots; never silently merge parties or sum incompatible currencies.

Acceptance: reusing a party propagates current contact data while preserving historical named assertions; uncertain provenance supports evidence and corrections; temporary entry/return and acquisition/accession branches share one object identity; multi-target legacy insurance is reviewed/split without evidence loss; expired/future policies and currencies are handled explicitly; documented export round-trips and institution reports contain actual authorized data and reproducible criteria.

## Batch 6 — daily UX, capability consistency and documentation quality

**Recommendations:** R20, remainder of R24, R25–R28, R32. **Complexity:** Large overall, with separable Medium UX work and a Small auth fix. **Risk:** High if entitlements/roles change; Medium for form/list behavior. **Dependencies:** stable domains from earlier batches, accepted capability matrix and supported field devices/locales. R32 is independent and can be pulled forward into Batch 1 if approved explicitly as additional scope.

Deliver consistent optional-module navigation and capability reasons, resumable validated forms, URL-persistent complete lists, usable forbidden/not-found/error/no-match recovery, accessible responsive workflows and complete workflow localization. Add actionable catalog/documentation-quality queues and generic account-recovery responses.

Affected modules: sidebar/routes, feature/module/permission/site policy, shared table/form/selectors, dashboard detail/list screens, locale files, quality/search jobs and auth lookup/recovery. Only add draft/quality/access-policy schema when needed by complete workflows. Keep existing commercial entitlements intentional; do not infer billing changes from a UI feature mismatch.

Acceptance: role/page/sidebar/backend matrix agrees, optional library remains isolated and functional, a staff member can filter/open/edit/return without lost list context, unsaved/error/conflict states recover, long forms work on target mobile widths with keyboard/touch, no false empty state for failed data, locale workflows have no literal fallback gaps, documentation exceptions link to repairable records, account-existence behavior does not disclose password users. Repeat real browser tasks by representative roles; source review alone is insufficient for the mobile/accessibility claim.

## Batch 7 — workflow automation, notifications and integration delivery

**Recommendations:** R22, R23, R31. **Complexity:** Large. **Risk:** Medium–High for duplicate tasks/alerts, recipients and downstream delivery. **Dependencies:** canonical events from Batch 3, complete cases from Batch 5, capability/UI contracts from Batch 6; approved notification/digest/escalation semantics.

Deliver case-linked accountable tasks, dependency/blocker visibility, preference-aware notification/digest handling, environmental alert episodes and durable webhook/email delivery with retry/inspection. Preparation tasks are created once from accepted case events; no automation invents a physical movement, legal approval or condition result. Expose only channels with a working backend and traceable delivery state.

Affected modules: assignments/workflows/installations/transit, notification emitters/preferences/crons/email, environmental alerting and outgoing webhook actions/settings. Add typed task/case/dependency links, idempotency identities, alert episode state, delivery attempts and retry/digest checkpoints. Apply organization/recipient permissions to event content and retries.

Acceptance: repeated events create one logical task/alert/delivery intent; disabled categories and daily/weekly choices affect actual sends; retryable failure, permanent failure and revoked endpoint recover correctly; shared-tenant/task visibility is correct; staff can follow acquisition-to-photography or loan-to-packing-to-return tasks without duplicate entry. Test deliveries against local fixture endpoints, not real institutional recipients. External messaging/deployment is separately authorized for rollout.

## Batch 8 — optional field and professional extensions

**Recommendations:** R33–R35, plus institution-validated additions from procedure coverage. **Complexity:** Large per capability. **Risk:** Medium–High for offline conflicts, sensitive incidents and rights delivery. **Dependencies:** earlier domain/security/UX/automation foundations and demonstrated institutional demand. Approve these as separate complete capabilities rather than one speculative release.

- Field inventory: observation sessions, scan/label verification, exceptions/reconciliation, then offline drafts only after a defined encrypted-storage/conflict model. Scanning alone cannot move custody.
- Incident/emergency response: affected objects/locations, condition/evidence, assigned response, insurance/custody links and after-action record under institutional procedures.
- Research/reproduction: request, rights/evidence decision, approved derivative/terms delivery, expiry and retained evidence. Optional metadata assistance only proposes reviewable drafts.

Each needs actual schema, scoped permissions, task-focused UI, interruption/retry handling, migration where applicable and complete end-to-end validation. These are product opportunities, not defects proven by absence of a screen.

## Rules for every approved batch

- Read every affected source and local instructions before editing. Inspect the actual diff and preserve unrelated changes, including the existing `CLAUDE.md` edit.
- Use additive schema/index/migration steps with explicit legacy states, bounded rerunnable backfills and fixture/snapshot validation. Preserve institutional identifiers/history/files. Do not infer missing historical facts.
- Inspect alternate public/internal/bulk/import/job paths, UI/public consumers, form validators and permission checks together.
- Add meaningful regression/workflow tests for the changed invariants, including wrong tenant/role, retries and failure recovery. Run relevant suites plus required root gates and the standalone backend compiler; disclose any remaining failure.
- Perform real browser inspection for affected workflows, loading/error/empty states and supported mobile/keyboard behavior. An unavailable browser is an explicit validation gap, not a passed check.
- Run build/load/restore checks when the change or release requires them. Verify locally/in isolation before any live mutation or deployment.
- No TODO delivery promises, placeholder reports, fake controls, permissive security fallbacks or silently ignored failures. Remove unsupported affordances or implement their backend completely.
- Report exact changed files/behavior, migrations, permissions/UI/validation, deterministic results, workflow evidence and remaining rollout limitations. Do not report an incomplete batch as complete.

READY FOR IMPLEMENTATION

Recommended first batch: **Batch 1 — security and permanent-record protection (R01–R06)**. Wait for explicit user approval before changing application code.
