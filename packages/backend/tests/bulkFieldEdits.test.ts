import type { FunctionArgs } from "convex/server";
import { expect, test, vi } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { bulkEditErrorFromError } from "../convex/utils/bulkFieldEditErrors";
import {
  BULK_EDIT_STALE_AFTER_MS,
  BULK_EDIT_VALUE_LIMIT,
} from "../convex/utils/bulkFieldEdits";
import {
  authedForUser,
  createConvexTest,
  createOrgUserWithPermissions,
} from "./testHarness";

// Objects whose option usage write fails, to make an edit page fail for real.
const failingWrites = vi.hoisted(() => new Set<string>());
vi.mock("../convex/utils/collectionOptionUsages", async (importOriginal) => {
  const real =
    await importOriginal<
      typeof import("../convex/utils/collectionOptionUsages")
    >();
  return {
    ...real,
    syncCollectionOptionUsages: async (
      ...args: Parameters<typeof real.syncCollectionOptionUsages>
    ) => {
      if (failingWrites.has(args[1])) throw new Error("Write failed");
      return await real.syncCollectionOptionUsages(...args);
    },
  };
});

async function setup() {
  const t = createConvexTest();
  const owner = await createOrgUserWithPermissions(t, [
    "collections.read",
    "collections.create",
    "collections.update",
  ]);
  const user = authedForUser(t, owner.userId);
  const { organizationId } = owner;

  async function create(
    fields: Omit<FunctionArgs<typeof api.collections.create>, "organizationId">,
  ) {
    return await user.mutation(api.collections.create, {
      organizationId,
      ...fields,
    });
  }

  async function run(
    args: Omit<FunctionArgs<typeof api.bulkFieldEdits.start>, "organizationId">,
  ) {
    vi.useFakeTimers();
    const jobId = await user.mutation(api.bulkFieldEdits.start, {
      organizationId,
      ...args,
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    vi.useRealTimers();
    const job = await user.query(api.bulkFieldEdits.get, { jobId });
    if (!job) throw new Error("Job missing");
    return job;
  }

  async function field(
    id: Id<"collections">,
    name: "culture" | "title" | "materials" | "period" | "objectType",
  ) {
    const row = await t.run((ctx) => ctx.db.get(id));
    return row?.[name];
  }

  async function auditEntries(id: Id<"collections">) {
    return await t.run(async (ctx) =>
      (
        await ctx.db
          .query("auditLog")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organizationId),
          )
          .collect()
      ).filter(
        (entry) =>
          entry.entityId === id && entry.action === "updated_collection",
      ),
    );
  }

  return {
    t,
    user,
    organizationId,
    userId: owner.userId,
    create,
    run,
    field,
    auditEntries,
  };
}

function refusalCode(promise: Promise<unknown>) {
  return promise.then(
    () => "no refusal",
    (error) => bulkEditErrorFromError(error)?.code,
  );
}

test("a selection has one field set, with a preview of what the edit writes over and one audit entry per changed Object", async () => {
  const s = await setup();
  const plain = await s.create({ accessionNumber: "1", title: "Bowl" });
  const roman = await s.create({
    accessionNumber: "2",
    title: "Lamp",
    culture: "Roman",
  });
  const greek = await s.create({
    accessionNumber: "3",
    title: "Cup",
    culture: "Greek",
  });
  const untouched = await s.create({ accessionNumber: "4", title: "Jar" });
  const scope = {
    kind: "selection" as const,
    collectionIds: [plain, roman, greek, greek],
  };
  const edit = {
    field: "culture" as const,
    operation: "set" as const,
    value: " Roman ",
  };

  expect(
    await s.user.query(api.bulkFieldEdits.preview, {
      organizationId: s.organizationId,
      scope,
      edit,
    }),
  ).toEqual({
    kind: "preview",
    matching: 3,
    changing: 2,
    overwriting: 1,
    capped: false,
  });

  const job = await s.run({ scope, edit });
  expect(job).toMatchObject({
    status: "completed",
    scope: { kind: "selection", count: 3 },
    checked: 3,
    changed: 2,
    skipped: 0,
  });
  expect(await s.field(plain, "culture")).toBe("Roman");
  expect(await s.field(greek, "culture")).toBe("Roman");
  expect(await s.field(untouched, "culture")).toBeUndefined();
  expect(await s.auditEntries(greek)).toHaveLength(1);
  // The field, previous and new values the Object's history shows.
  expect((await s.auditEntries(greek))[0]?.changes).toEqual({
    field: "culture",
    previous: "Greek",
    new: "Roman",
    bulkFieldEditId: job._id,
  });
  expect((await s.auditEntries(plain))[0]?.changes).toEqual({
    field: "culture",
    new: "Roman",
    bulkFieldEditId: job._id,
  });
  // Unchanged Objects are not audited as changed.
  expect(await s.auditEntries(roman)).toHaveLength(0);
});

test("every Object matching the catalog filters has a value found and replaced, lists keeping their shape", async () => {
  const s = await setup();
  const listed = await s.create({
    accessionNumber: "1",
    title: "Portrait",
    objectType: "Painting",
    materials: '["Oil Paint","Canvas"]',
  });
  const bare = await s.create({
    accessionNumber: "2",
    title: "Sketch",
    objectType: "Painting",
    materials: "oil paint",
  });
  const other = await s.create({
    accessionNumber: "3",
    title: "Lamp",
    objectType: "Lamp",
    materials: "Oil paint",
  });

  const job = await s.run({
    scope: {
      kind: "filters",
      filters: { objectType: "Painting" },
    },
    edit: {
      field: "materials",
      operation: "replace",
      find: "oil paint",
      replaceWith: "Oil on canvas",
    },
  });
  expect(job).toMatchObject({
    status: "completed",
    scope: { kind: "filters" },
    checked: 2,
    changed: 2,
  });
  expect(await s.field(listed, "materials")).toBe('["Oil on canvas","Canvas"]');
  expect(await s.field(bare, "materials")).toBe("Oil on canvas");
  expect(await s.field(other, "materials")).toBe("Oil paint");

  // Materials usage follows the new values, so the option list sees them.
  const usages = await s.t.run((ctx) =>
    ctx.db
      .query("collectionOptionUsages")
      .withIndex("by_organization_kind_and_value", (q) =>
        q.eq("organizationId", s.organizationId).eq("kind", "material"),
      )
      .collect(),
  );
  expect(usages.map((usage) => usage.value).sort()).toEqual([
    "canvas",
    "oil on canvas",
    "oil on canvas",
    "oil paint",
  ]);
});

test("a clear empties the field; the title is never cleared and a replace that would empty it is skipped", async () => {
  const s = await setup();
  const dated = await s.create({
    accessionNumber: "1",
    title: "Draft",
    period: "Unknown",
  });
  const scope = { kind: "selection" as const, collectionIds: [dated] };

  await s.run({ scope, edit: { field: "period", operation: "clear" } });
  expect(await s.field(dated, "period")).toBeUndefined();

  expect(
    await refusalCode(
      s.user.mutation(api.bulkFieldEdits.start, {
        organizationId: s.organizationId,
        scope,
        edit: { field: "title", operation: "clear" },
      }),
    ),
  ).toBe("TITLE_REQUIRED");
  expect(
    await refusalCode(
      s.user.mutation(api.bulkFieldEdits.start, {
        organizationId: s.organizationId,
        scope,
        edit: { field: "culture", operation: "set", value: "  " },
      }),
    ),
  ).toBe("VALUE_REQUIRED");
  expect(
    await refusalCode(
      s.user.mutation(api.bulkFieldEdits.start, {
        organizationId: s.organizationId,
        scope: { kind: "selection", collectionIds: [] },
        edit: { field: "culture", operation: "set", value: "Roman" },
      }),
    ),
  ).toBe("SELECTION_EMPTY");

  const job = await s.run({
    scope,
    edit: {
      field: "title",
      operation: "replace",
      find: "draft",
      replaceWith: "",
    },
  });
  expect(job).toMatchObject({ status: "completed", changed: 0, skipped: 1 });
  expect(await s.field(dated, "title")).toBe("Draft");
});

test("one edit runs at a time per Organization and a selection from another Organization is refused", async () => {
  const s = await setup();
  const own = await s.create({ accessionNumber: "1", title: "Bowl" });
  const other = await createOrgUserWithPermissions(s.t, ["collections.read"]);
  const foreign = await s.t.run((ctx) =>
    ctx.db.insert("collections", {
      organizationId: other.organizationId,
      accessionNumber: "X-1",
      title: "Not ours",
      status: "active",
      catalogedBy: other.userId,
      catalogedAt: 1,
    }),
  );
  expect(
    await refusalCode(
      s.user.mutation(api.bulkFieldEdits.start, {
        organizationId: s.organizationId,
        scope: { kind: "selection", collectionIds: [own, foreign] },
        edit: { field: "culture", operation: "set", value: "Roman" },
      }),
    ),
  ).toBe("SELECTION_OUTSIDE_ORGANIZATION");

  vi.useFakeTimers();
  const jobId = await s.user.mutation(api.bulkFieldEdits.start, {
    organizationId: s.organizationId,
    scope: { kind: "selection", collectionIds: [own] },
    edit: { field: "culture", operation: "set", value: "Roman" },
  });
  expect(
    await refusalCode(
      s.user.mutation(api.bulkFieldEdits.start, {
        organizationId: s.organizationId,
        scope: { kind: "selection", collectionIds: [own] },
        edit: { field: "period", operation: "set", value: "Imperial" },
      }),
    ),
  ).toBe("EDIT_RUNNING");
  await s.user.mutation(api.bulkFieldEdits.cancel, { jobId });
  await s.t.finishAllScheduledFunctions(vi.runAllTimers);
  vi.useRealTimers();
  expect(
    await s.user.query(api.bulkFieldEdits.latest, {
      organizationId: s.organizationId,
    }),
  ).toMatchObject({ _id: jobId, status: "cancelled", changed: 0 });
  expect(await s.field(own, "culture")).toBeUndefined();
});

test("a preview the server would refuse says why instead of throwing", async () => {
  const s = await setup();
  const bowl = await s.create({ accessionNumber: "1", title: "Bowl" });
  const scope = { kind: "selection" as const, collectionIds: [bowl] };
  const tooLong = "x".repeat(BULK_EDIT_VALUE_LIMIT + 1);

  expect(
    await s.user.query(api.bulkFieldEdits.preview, {
      organizationId: s.organizationId,
      scope,
      edit: { field: "culture", operation: "set", value: tooLong },
    }),
  ).toEqual({ kind: "refused", code: "VALUE_TOO_LONG" });
  expect(
    await s.user.query(api.bulkFieldEdits.preview, {
      organizationId: s.organizationId,
      scope,
      edit: {
        field: "culture",
        operation: "replace",
        find: "Roman",
        replaceWith: tooLong,
      },
    }),
  ).toEqual({ kind: "refused", code: "VALUE_TOO_LONG" });
  expect(
    await refusalCode(
      s.user.mutation(api.bulkFieldEdits.start, {
        organizationId: s.organizationId,
        scope,
        edit: { field: "culture", operation: "replace", find: tooLong },
      }),
    ),
  ).toBe("VALUE_TOO_LONG");
});

test("replacement text is written as typed, even with dollar signs", async () => {
  const s = await setup();
  const coin = await s.create({ accessionNumber: "1", title: "Coin, 5 cents" });

  await s.run({
    scope: { kind: "selection", collectionIds: [coin] },
    edit: {
      field: "title",
      operation: "replace",
      find: "5 cents",
      replaceWith: "$& and $1",
    },
  });
  expect(await s.field(coin, "title")).toBe("Coin, $& and $1");
});

test("a page that keeps failing stops the edit, which resumes from its last committed page", async () => {
  const s = await setup();
  const coins: Id<"collections">[] = [];
  for (let index = 0; index < 30; index++) {
    coins.push(
      await s.create({
        accessionNumber: `C-${index}`,
        title: `Coin ${index}`,
        objectType: "Coin",
      }),
    );
  }
  const vase = await s.create({
    accessionNumber: "V-1",
    title: "Vase",
    objectType: "Vase",
  });
  // The oldest Coin, on the second page newest first, cannot be written.
  const [oldest] = coins;
  if (!oldest) throw new Error("No Coins created");
  failingWrites.add(oldest);

  vi.useFakeTimers();
  try {
    const jobId = await s.user.mutation(api.bulkFieldEdits.start, {
      organizationId: s.organizationId,
      scope: { kind: "filters", filters: { objectType: "Coin" } },
      edit: { field: "materials", operation: "set", value: "Silver" },
    });
    // A running edit that still reports progress is not resumed twice.
    expect(
      await refusalCode(s.user.mutation(api.bulkFieldEdits.resume, { jobId })),
    ).toBe("EDIT_NOT_RESUMABLE");
    await s.t.finishAllScheduledFunctions(vi.runAllTimers);
    // Every other Coin was written, page by page, before the edit stopped.
    expect(await s.user.query(api.bulkFieldEdits.get, { jobId })).toMatchObject(
      { status: "failed", failure: "Write failed", checked: 29, changed: 29 },
    );
    expect(await s.field(oldest, "materials")).toBeUndefined();

    // While another edit runs, the failed one waits.
    const other = await s.user.mutation(api.bulkFieldEdits.start, {
      organizationId: s.organizationId,
      scope: { kind: "selection", collectionIds: [vase] },
      edit: { field: "culture", operation: "set", value: "Greek" },
    });
    expect(
      await refusalCode(s.user.mutation(api.bulkFieldEdits.resume, { jobId })),
    ).toBe("EDIT_RUNNING");
    await s.t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(
      await s.user.query(api.bulkFieldEdits.get, { jobId: other }),
    ).toMatchObject({ status: "completed" });

    failingWrites.clear();
    await s.user.mutation(api.bulkFieldEdits.resume, { jobId });
    await s.t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await s.user.query(api.bulkFieldEdits.get, { jobId })).toMatchObject(
      { status: "completed", checked: 30, changed: 30 },
    );
  } finally {
    failingWrites.clear();
    vi.useRealTimers();
  }
  for (const coin of coins) {
    expect(await s.field(coin, "materials")).toBe("Silver");
  }
  expect(await s.field(vase, "materials")).toBeUndefined();
  // Pages written before the failure were not written again on resume.
  const newest = coins.at(-1);
  if (!newest) throw new Error("No Coins created");
  expect(await s.auditEntries(newest)).toHaveLength(1);
  expect(await s.auditEntries(oldest)).toHaveLength(1);
});

test("an edit stopped by an error can be stopped for good instead of resumed", async () => {
  const s = await setup();
  const coin = await s.create({
    accessionNumber: "C-1",
    title: "Coin",
    objectType: "Coin",
  });
  failingWrites.add(coin);

  vi.useFakeTimers();
  try {
    const jobId = await s.user.mutation(api.bulkFieldEdits.start, {
      organizationId: s.organizationId,
      scope: { kind: "selection", collectionIds: [coin] },
      edit: { field: "materials", operation: "set", value: "Silver" },
    });
    await s.t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await s.user.query(api.bulkFieldEdits.get, { jobId })).toMatchObject(
      { status: "failed" },
    );

    await s.user.mutation(api.bulkFieldEdits.cancel, { jobId });

    // The catalog notice shows only running and failed edits.
    expect(
      await s.user.query(api.bulkFieldEdits.latest, {
        organizationId: s.organizationId,
      }),
    ).toMatchObject({ status: "cancelled" });
    expect(
      await refusalCode(s.user.mutation(api.bulkFieldEdits.resume, { jobId })),
    ).toBe("EDIT_NOT_RESUMABLE");
  } finally {
    failingWrites.clear();
    vi.useRealTimers();
  }
});

test("a filtered preview whose newest page holds no match reports a lower bound", async () => {
  const s = await setup();
  await s.t.run(async (ctx) => {
    const fields = {
      organizationId: s.organizationId,
      status: "active" as const,
      catalogedBy: s.userId,
      catalogedAt: 1,
    };
    for (let index = 0; index < 5; index++) {
      await ctx.db.insert("collections", {
        ...fields,
        accessionNumber: `R-${index}`,
        title: `Lamp ${index}`,
        culture: "Roman",
      });
    }
    for (let index = 0; index < 1100; index++) {
      await ctx.db.insert("collections", {
        ...fields,
        accessionNumber: `N-${index}`,
        title: `Plate ${index}`,
      });
    }
  });

  expect(
    await s.user.query(api.bulkFieldEdits.preview, {
      organizationId: s.organizationId,
      scope: { kind: "filters", filters: { culture: "Roman" } },
      edit: { field: "culture", operation: "set", value: "Greek" },
    }),
  ).toEqual({
    kind: "preview",
    matching: 0,
    changing: 0,
    overwriting: 0,
    capped: true,
  });
});

test("a running edit that stopped reporting resumes without writing a page twice", async () => {
  const s = await setup();
  const coins: Id<"collections">[] = [];
  for (let index = 0; index < 30; index++) {
    coins.push(
      await s.create({ accessionNumber: `C-${index}`, title: `Coin ${index}` }),
    );
  }

  vi.useFakeTimers();
  const jobId = await s.user.mutation(api.bulkFieldEdits.start, {
    organizationId: s.organizationId,
    scope: { kind: "selection", collectionIds: coins },
    edit: {
      field: "title",
      operation: "replace",
      find: "coin",
      replaceWith: "Roman coin",
    },
  });
  await s.t.run((ctx) =>
    ctx.db.patch(jobId, {
      updatedAt: Date.now() - BULK_EDIT_STALE_AFTER_MS - 1,
    }),
  );
  // The original page is still queued; both runs race for the same page.
  await s.user.mutation(api.bulkFieldEdits.resume, { jobId });
  await s.t.finishAllScheduledFunctions(vi.runAllTimers);
  vi.useRealTimers();

  expect(await s.user.query(api.bulkFieldEdits.get, { jobId })).toMatchObject({
    status: "completed",
    checked: 30,
    changed: 30,
  });
  expect(await s.field(coins[0] as Id<"collections">, "title")).toBe(
    "Roman coin 0",
  );
  expect(await s.field(coins[29] as Id<"collections">, "title")).toBe(
    "Roman coin 29",
  );
  expect(await s.auditEntries(coins[29] as Id<"collections">)).toHaveLength(1);
});
