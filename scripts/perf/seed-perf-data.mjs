#!/usr/bin/env node
/**
 * Give the seeded QA organization enough records for the navigation benchmark:
 * one collection group, a page of objects and a few accessions. Idempotent:
 * records are tagged with a fixed prefix and skipped when they already exist.
 *
 *   node scripts/perf/seed-perf-data.mjs
 *
 * Needs `bun run qa:seed` to have run first. Nothing here touches a cloud
 * deployment.
 */
import { readFileSync } from "node:fs";
import { credentialsPath, readState, signInQaUser } from "../local-qa/lib.mjs";

export const PERF_GROUP_NAME = "Perf group";
export const PERF_OBJECT_PREFIX = "Perf object";
export const PERF_ACCESSION_SOURCE = "Perf donor";
const OBJECT_COUNT = 40;
const ACCESSION_COUNT = 5;

const { state } = readState();
const { email, password, organizationId } = JSON.parse(
  readFileSync(credentialsPath, "utf8"),
);
const { client, api } = await signInQaUser(state.url, email, password);

const groups = await client.query(api.collectionGroups.list, {
  organizationId,
});
let group = groups.find((candidate) => candidate.name === PERF_GROUP_NAME);
if (!group) {
  const groupId = await client.mutation(api.collectionGroups.create, {
    organizationId,
    name: PERF_GROUP_NAME,
    description: "Objects used by scripts/perf/measure-navigation.mjs",
  });
  group = { _id: groupId, name: PERF_GROUP_NAME };
}

const paginationOpts = { numItems: 200, cursor: null };
const existing = await client.query(api.collections.list, {
  organizationId,
  paginationOpts,
});
const existingTitles = new Set(existing.page.map((item) => item.title));
let created = 0;
for (let index = 1; index <= OBJECT_COUNT; index++) {
  const title = `${PERF_OBJECT_PREFIX} ${String(index).padStart(2, "0")}`;
  if (existingTitles.has(title)) continue;
  await client.mutation(api.collections.create, {
    organizationId,
    collectionGroupId: group._id,
    title,
    creator: "Benchmark workshop",
    objectType: "painting",
    description: `Synthetic object ${index} for the navigation benchmark.`,
  });
  created += 1;
}

const accessions = await client.query(api.accessions.list, {
  organizationId,
  paginationOpts,
});
const existingSources = new Set(accessions.page.map((item) => item.source));
let accessionsCreated = 0;
for (let index = 1; index <= ACCESSION_COUNT; index++) {
  const source = `${PERF_ACCESSION_SOURCE} ${index}`;
  if (existingSources.has(source)) continue;
  await client.mutation(api.accessions.create, {
    organizationId,
    dateReceived: Date.UTC(2026, 0, index),
    source,
    method: "gift",
    notes: "Synthetic accession for the navigation benchmark.",
  });
  accessionsCreated += 1;
}

console.log(
  `✓ Perf data ready: group "${PERF_GROUP_NAME}", ${created} objects created (${OBJECT_COUNT} total), ${accessionsCreated} accessions created (${ACCESSION_COUNT} total)`,
);
process.exit(0);
