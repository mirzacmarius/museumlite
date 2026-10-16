#!/usr/bin/env node
/**
 *   node scripts/perf/seed-perf-data.mjs
 */
import {
  readQaCredentials,
  readState,
  signInQaUser,
} from "../local-qa/lib.mjs";
import {
  PERF_ACCESSION_SOURCE,
  PERF_GROUP_NAME,
  PERF_OBJECT_PREFIX,
} from "./fixtures.mjs";

const OBJECT_COUNT = 40;
const ACCESSION_COUNT = 5;

const { state } = readState();
const { email, password, organizationId } = readQaCredentials();
const { client, api } = await signInQaUser(state.url, email, password);

async function listAll(query, args) {
  const items = [];
  let cursor = null;
  do {
    const page = await client.query(query, {
      ...args,
      paginationOpts: { numItems: 200, cursor },
    });
    items.push(...page.page);
    cursor = page.isDone ? null : page.continueCursor;
  } while (cursor !== null);
  return items;
}

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

const existing = await listAll(api.collections.list, {
  organizationId,
  collectionGroupId: group._id,
});
const existingTitles = new Set(existing.map((item) => item.title));
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

const accessions = await listAll(api.accessions.list, { organizationId });
const existingSources = new Set(accessions.map((item) => item.source));
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
