import type { FunctionArgs } from "convex/server";
import { expect, test, vi } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { bulkEditErrorFromError } from "../convex/utils/bulkFieldEditErrors";
import {
  authedForUser,
  createConvexTest,
  createOrgUserWithPermissions,
} from "./testHarness";

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

  return { t, user, organizationId, create, run, field, auditEntries };
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
  ).toEqual({ matching: 3, changing: 2, overwriting: 1, capped: false });

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
  expect((await s.auditEntries(greek))[0]?.changes).toMatchObject({
    culture: "Roman",
    previous: { culture: "Greek" },
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
