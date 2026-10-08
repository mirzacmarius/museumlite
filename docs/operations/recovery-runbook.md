# Migration and recovery runbook

This runbook covers two operations:

- applying the Batch 4 additive migrations (projections and case history), and
- restoring a Convex snapshot with its files into an empty target, then proving the restore is faithful.

The procedure was rehearsed on disposable self-hosted Convex backends bound to `127.0.0.1` with synthetic data (MUS-641). That rehearsal does **not** validate Convex Cloud backups, production restore time or production data volumes. See [Gaps](#gaps-and-limits).

## 1. Recovery objectives

| Objective | Rehearsed (synthetic, loopback) | Production |
| --- | --- | --- |
| Restore target | Empty disposable self-hosted backend on `127.0.0.1:3250` | **Not set.** Needs a separate, empty, non-production Convex deployment owned by the operator. Never the production deployment. |
| RPO (maximum data loss) | Point of the last snapshot export (on demand) | **Not set.** The owner must choose a value and a backup schedule that meets it (Convex Cloud scheduled backups, or scheduled `convex export --include-file-storage`). |
| RTO (time to usable restore) | About 15 s for 655 documents and 1 file (table below) | **Not set and not measured.** Must be measured on a copy of real production volume before it is promised. |
| Fidelity | Same `_id`, `_creationTime` and content for every document, identical file bytes, no new dangling references, projections reconcile with 0 discrepancies | Same requirement. |

What the owner must provide before production recovery can be claimed:

1. An approved RPO and RTO.
2. The backup mechanism and schedule (Convex plan feature or scheduled export), retention period, and who may download a snapshot. Snapshots contain authentication sessions and refresh tokens, so they are secrets.
3. A dedicated non-production restore deployment and its access.
4. Its environment variables (auth signing keys, site URL, mail and billing keys). Snapshots do not include environment variables.
5. A rehearsal on production-sized data, with the measured timings recorded here.

## 2. Safety rules

- Rehearsals use only loopback (`127.0.0.1`) or an explicitly named non-production deployment. Do not pass `--prod`. Do not rely on the default deployment from `.env.local`. Every command must name its target through an explicit env file that contains only `CONVEX_SELF_HOSTED_URL` and `CONVEX_SELF_HOSTED_ADMIN_KEY`, with all other `CONVEX_*` variables removed from the process environment. The rehearsal wrapper refused `--prod`, `--deployment`, `--env-file` overrides and preview flags, and confirmed the URL before every call.
- Never print or commit admin keys, instance secrets or snapshot ZIPs.
- Import a snapshot only into an **empty** target. Never use `convex import --replace` or `--replace-all` against a deployment that holds data you need, including the source of the backup.
- Keep the original pre-migration snapshot read-only (mode `0400`). Record its SHA-256 and recheck it after every rehearsal.

## 3. Status checks

Run these against the target (`bunx convex run --env-file <target.env> ...`).

| Check | Command | Healthy result |
| --- | --- | --- |
| Projection state | `--inline-query 'return await ctx.db.query("organizationProjectionStates").collect()'` | Every organization `availability: "ready"`, current `definitionVersion`, no `buildingGenerationId` |
| Projection jobs | `--inline-query 'return await ctx.db.query("projectionGenerations").collect()'` | No `status: "failed"`; the latest reconcile has `discrepancyCount: 0`, `mismatchCount: 0` |
| Discrepancy rows | `--inline-query 'return await ctx.db.query("projectionDiscrepancies").collect()'` | Empty for the latest reconcile, or only `legacy_counter_mismatch` (evidence only) |
| Health through the public API | `projections:getHealth '{"organizationId":"<org>"}' --identity '<admin identity>'` | `availability: "ready"`, `lastReconciliation.status: "completed"` |
| Case history | `auditLog:listCaseHistory '{"organizationId":"<org>","caseType":"<type>","entityId":"<id>"}' --identity '<reader identity>'` | Pages legacy approvals, then post-cutover approvals, without gaps or duplicates |
| UI | Settings > Metrics health (`/settings/metrics`, needs `organization.manage_settings`) | Ready, last reconciliation without blocking discrepancies |

Calling `getHealth` without an identity must fail with `Permission denied`.

## 4. Batch 4 additive migration

The schema change is additive. Existing documents are not rewritten. Pre-Batch 4 data passed schema validation on push during the rehearsal.

1. **Take and verify a backup first** (section 5, steps 1–2). Keep it read-only.
2. **Deploy** the release: `bunx convex deploy`, through the normal pipeline in production. The push fails closed if the schema is invalid. In the rehearsal, a duplicate index name (`IndexNamesNotUnique`) rejected the whole push and changed nothing. Right after deploy, metrics show "Metrics unavailable" (`not_built`), not zeros.
   - **Index backfill on `auditLog`.** This release adds seven `auditLog` indexes (`by_organization_and_requestId` and six `..._and_timestamp` history indexes). Convex backfills new indexes during the push, and the push does not finish until every backfill does. On a large `auditLog` table that holds the deploy open for minutes, and the old release keeps serving meanwhile.
   - The indexes are not staged. Convex 1.38 supports `staged: true`, but a staged index cannot be queried and is removed from the generated types, and this release's history pages, case filters, export jobs and correction retries query all seven. Staging them would mean shipping those readers disabled.
   - Before deploying, read the `auditLog` document count in the Convex dashboard. If it is large enough that a blocking backfill is unacceptable, split the release: first deploy a preparatory commit that adds only the seven indexes with `staged: true` (no reader changes), wait until the dashboard shows the backfill complete, then deploy this release, which removes the flag. The second push then has nothing to backfill.
3. **Rebuild projections:** `bunx convex run projections:startRebuildForAllOrganizations '{}'`.
   - It walks organizations 20 at a time, in pages of 25 rows, and skips organizations that are already ready or building.
   - Rerunning it is safe. The second run returned `0`.
   - To force a fresh rebuild for one organization, run `projections:startRebuildForOrganization '{"organizationId":"<org>"}'`. The previous generation becomes `superseded`.
4. **Legacy case history needs no migration.** Original `workflowHistory` arrays stay the source for ordinals below their cutover length (`caseHistoryState.sourceLength`). Approvals recorded after cutover are appended to `caseHistoryEntries` from that ordinal on. Readers page the array first, then the child rows. Nothing is copied, so there is no duplicate legacy data.
5. **Reconcile:** `projections:startReconcileForOrganization '{"organizationId":"<org>"}'`. A `counter_mismatch` or `contribution_mismatch` blocks sign-off. Reconcile never repairs data.
6. **Verify additivity** (optional, on a rehearsal copy). Export before and after, then run `compare before.zip after.zip`. Every pre-migration document must remain unchanged.

## 5. Backup and restore

From `packages/backend`:

1. **Back up:** `bunx convex export --env-file <source.env> --path backup.zip --include-file-storage`. Record its SHA-256 and size, then `chmod 0400` it.
2. **Inspect the backup:** `bun scripts/recovery/snapshotVerification.ts manifest backup.zip`.
   - This prints counts per table, the SHA-256 of each stored file and any dangling references. It does not print document bodies.
   - It exits 1 if a stored file is missing or its bytes do not match the checksum Convex recorded.
3. **Prepare an empty target.** Deploy the same code revision as the backup: `bunx convex deploy --env-file <target.env>`. This registers the schema and the components (`metrics`, `polar`, `rateLimiter`) so component data can be imported.
4. **Import:** `bunx convex import --env-file <target.env> -y backup.zip`. Imports bypass mutation triggers.
5. **Prove fidelity:**
   - `bunx convex export --env-file <target.env> --path restored.zip --include-file-storage`
   - `bun scripts/recovery/snapshotVerification.ts compare backup.zip restored.zip`

   This must exit 0 with `"blocking": []`. It checks every document ID and content digest, every file's bytes, and every reference.
6. **Rebuild and reconcile projections.** Projection tables and the `metrics` aggregate are derived state:
   - `projections:startRebuildForOrganization` for each organization (or `startRebuildForAllOrganizations` after the states are reset), then
   - `projections:startReconcileForOrganization`.

   Require 0 blocking discrepancies (section 3).
7. **Spot-check through the public boundary:**
   - fetch a stored file via `ctx.storage.getUrl` and compare its SHA-256 with the manifest;
   - page a case history with `auditLog:listCaseHistory`.

Only after these checks may the restored deployment be used as a source of records.

## 6. Rollback rules

- **Rollback of a rehearsal or restore target:** discard it. Stop that backend, move its directory aside (or delete the non-production deployment), and start a fresh empty target. Never "undo" an import in place.
- **Rollback of the Batch 4 release:** redeploy the previous release.
  - The new tables (`projection*`, `caseHistory*`, `export*`) and the `metrics` component can stay; they are additive.
  - Legacy `organizationUsageCounters` are still maintained, so the old readers stay correct.
  - Original `workflowHistory` arrays were never removed.
- **Prohibited (unsafe rollback):**
  - importing an older snapshot over a live deployment with `--replace` or `--replace-all`. This deletes records and evidence created after the snapshot;
  - deleting `caseHistoryEntries`, retained evidence or legacy arrays to "go back";
  - destructive cleanup of the new tables without a separate reviewed change;
  - any rollback that re-enables purging of permanent records or unsafe publication (spec security rollback rule).

## 7. Rehearsal results (MUS-641, 2026-10-08)

Code: integration `219ab8b8` plus the schema fix `36b53f71`. Pre-Batch 4 baseline: `71b84aa6`.

| Step | Elapsed |
| --- | --- |
| Start a fresh empty loopback target | 0.63 s |
| Deploy code to the empty target | 5.0–5.5 s |
| Import the pre-Batch 4 original snapshot (245 documents + 1 file) | 4.19 s |
| Import the migrated backup (654 documents + 1 file) | 4.92 s |
| Export with file storage | 0.36–0.42 s |
| Offline compare | 0.14 s |
| Projection rebuild, 35–39 source rows, max 25 rows per page | 0.37–0.47 s job, about 1.8 s wall including polling |
| Reconcile, 147–161 rows | 0.45–0.50 s job, about 1.8 s wall |
| End-to-end restore (fresh target to reconciled) | about 15 s |

Outcomes:

- **Original pre-Batch 4 snapshot → empty target:**
  - 246 documents, 142 tables and 1 file matched with 0 blocking discrepancies;
  - the archive SHA-256 stayed `0014632d…11342a`.
- **Additive path:**
  - every pre-migration document was unchanged after deploy and two migration runs (248 documents compared, 0 blocking);
  - the second run left source data identical, and projection totals and contributions were equal by value;
  - 250 history entries with 250 distinct ordinals and no duplicates.
- **Backup of the migrated source → fresh target:**
  - 655 documents, 156 tables and 1 file (68 bytes, SHA-256 `a38a4ff7…c95c58f`) identical;
  - 1,727 references checked, 0 dangling;
  - after rebuild and reconcile: 0 discrepancies and 0 mismatches;
  - the file served by the restored backend had the same SHA-256;
  - the case history paged through the public API as 100 + 100 + 50 entries.

## Gaps and limits

- Production RPO and RTO, the Convex Cloud backup feature and a cloud restore were **not** exercised. The numbers above come from a tiny synthetic dataset on a laptop.
- Snapshots exclude environment variables and `_scheduled_functions`. After a restore:
  - configure auth keys and site URL separately;
  - in-flight rebuild continuations, export jobs and scheduled reports do not resume, so rerun them;
  - sign-in on the restored target was not tested.
- Previously distributed file URLs point at the old deployment. Restored storage IDs are preserved, but URLs are not.
- The rehearsal also ran a per-case legacy-history copy (`normalizeCaseHistory`). That mutation was removed afterwards because readers never used the copied rows. Copies made during a rehearsal are inert; leave them in place.
- The `metrics` aggregate keeps B-tree nodes of superseded generations. Nodes grew from 10 to 20 after a second rebuild, and to 33 on the source after three generations. This does not affect correctness, but storage grows with every rebuild until a cleanup is built.
- The rehearsal checked behavior through the CLI and the public Convex API, not through the browser.
