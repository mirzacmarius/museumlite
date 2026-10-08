import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";
import { modules } from "./testSetup";

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const organizationId = await ctx.db.insert("organizations", {
      name: "Museum",
      slug: "history",
      type: "museum",
      subscriptionTier: "enterprise",
    });
    const foreignOrganizationId = await ctx.db.insert("organizations", {
      name: "Other",
      slug: "other",
      type: "museum",
    });
    const userId = await ctx.db.insert("users", {
      name: "Original registrar",
      email: "registrar@example.test",
    });
    const roleId = await ctx.db.insert("roles", {
      organizationId,
      name: "Registrar",
      isSystemRole: false,
    });
    await ctx.db.insert("userOrganizations", {
      organizationId,
      userId,
      roleId,
      joinedAt: 1,
    });
    for (const name of [
      "collections.read",
      "collections.update",
      "organization.view_analytics",
      "organization.manage_settings",
    ]) {
      const permissionId = await ctx.db.insert("permissions", {
        name,
        category: "collections",
      });
      await ctx.db.insert("rolePermissions", { roleId, permissionId });
    }
    return { organizationId, foreignOrganizationId, userId };
  });
  return {
    t,
    ...ids,
    staff: t.withIdentity({
      subject: `${ids.userId}|session-1`,
      issuer: "https://example.test",
    }),
  };
}

test("auditor reaches old events beyond a thousand with stable cursor and indexed dates", async () => {
  const { t, staff, organizationId, userId } = await setup();
  await t.run(async (ctx) => {
    for (let i = 0; i < 1105; i++)
      await ctx.db.insert("auditLog", {
        organizationId,
        userId,
        action: "updated",
        entityType: "collection",
        entityId: "object-1",
        timestamp: i,
      });
  });
  const seen = new Set<string>();
  let cursor: string | undefined;
  do {
    const result = await staff.query(api.auditLog.list, {
      organizationId,
      limit: 100,
      cursor,
    });
    for (const entry of result.entries) {
      expect(seen.has(entry._id)).toBe(false);
      seen.add(entry._id);
    }
    cursor = result.nextCursor;
  } while (cursor);
  expect(seen.size).toBe(1105);
  const dated = await staff.query(api.auditLog.list, {
    organizationId,
    fromDate: 0,
    toDate: 4,
  });
  expect(dated.entries.map((entry) => entry.timestamp)).toEqual([
    4, 3, 2, 1, 0,
  ]);
});

test("entity history never discloses a foreign tenant's events and activity cursors advance", async () => {
  const { t, staff, organizationId, foreignOrganizationId, userId } =
    await setup();
  await t.run(async (ctx) => {
    for (const org of [organizationId, foreignOrganizationId])
      for (let i = 0; i < 3; i++)
        await ctx.db.insert("auditLog", {
          organizationId: org,
          userId,
          action: "updated",
          entityType: "collection",
          entityId: "same-id",
          timestamp: i,
        });
  });
  const entity = await staff.query(api.auditLog.getByEntity, {
    organizationId,
    entityType: "collection",
    entityId: "same-id",
  });
  expect(entity).toHaveLength(3);
  const first = await staff.query(api.audit.listOrganizationActivity, {
    organizationId,
    limit: 2,
  });
  const second = await staff.query(api.audit.listOrganizationActivity, {
    organizationId,
    limit: 2,
    cursor: first.continueCursor,
  });
  expect(second.activities).toHaveLength(1);
  expect(second.activities[0]?._id).not.toBe(first.activities[0]?._id);
  await expect(
    t.query(api.auditLog.list, { organizationId }),
  ).rejects.toThrow();
  await expect(
    staff.query(api.auditLog.list, { organizationId: foreignOrganizationId }),
  ).rejects.toThrow();
});

test("recorded actor and subject evidence survives renames and corrections append without rewriting", async () => {
  const { t, staff, organizationId, userId } = await setup();
  const optionId = await staff.mutation(api.conditionOptions.create, {
    organizationId,
    name: "Stable condition",
    description: "Original",
  });
  const first = (await staff.query(api.auditLog.list, { organizationId }))
    .entries[0]!;
  await t.run(async (ctx) => {
    await ctx.db.patch(userId, { name: "Renamed registrar" });
    await ctx.db.patch(optionId, { name: "Renamed condition" });
  });
  const retained = (await staff.query(api.auditLog.list, { organizationId }))
    .entries[0]!;
  expect(retained.userName).toBe("Original registrar");
  expect(retained.subjectSnapshot?.label).toBe("Stable condition");
  const correctionId = await staff.mutation(api.auditLog.correct, {
    organizationId,
    eventId: first._id,
    reason: "Transcription error",
    statement: "The observation was received the following day",
    requestId: "correction-1",
  });
  expect(
    await staff.mutation(api.auditLog.correct, {
      organizationId,
      eventId: first._id,
      reason: "Transcription error",
      statement: "The observation was received the following day",
      requestId: "correction-1",
    }),
  ).toBe(correctionId);
  expect(
    await staff.query(api.auditLog.getEntry, {
      organizationId,
      eventId: first._id,
    }),
  ).toEqual(retained);
  const correction = await staff.query(api.auditLog.getEntry, {
    organizationId,
    eventId: correctionId,
  });
  expect(correction?.correctionOf).toBe(first._id);
  expect(correction?.userName).toBe("Renamed registrar");
});

test("case history preserves legacy order during bounded normalization and cursor retries", async () => {
  const { t, staff, organizationId, userId } = await setup();
  const entityId = await t.run(async (ctx) =>
    ctx.db.insert("accessions", {
      organizationId,
      accessionNumber: "A-001",
      dateReceived: 1,
      source: "Donor",
      method: "gift",
      status: "pending",
      workflowHistory: Array.from({ length: 205 }, (_, step) => ({
        step,
        approvedBy: userId,
        approvedAt: step + 1,
        comment: `Original ${step}`,
      })),
    }),
  );
  const first = await staff.query(api.auditLog.listCaseHistory, {
    organizationId,
    caseType: "accession",
    entityId,
    limit: 100,
  });
  const migration = await staff.mutation(api.auditLog.normalizeCaseHistory, {
    organizationId,
    caseType: "accession",
    entityId,
  });
  expect(migration.migratedThrough).toBe(100);
  expect(
    await staff.query(api.auditLog.listCaseHistory, {
      organizationId,
      caseType: "accession",
      entityId,
      limit: 100,
    }),
  ).toEqual(first);
  const second = await staff.query(api.auditLog.listCaseHistory, {
    organizationId,
    caseType: "accession",
    entityId,
    limit: 100,
    cursor: first.nextCursor,
  });
  expect(second.entries[0]?.entry.comment).toBe("Original 100");
  const last = await staff.query(api.auditLog.listCaseHistory, {
    organizationId,
    caseType: "accession",
    entityId,
    limit: 100,
    cursor: second.nextCursor,
  });
  expect(last.entries.map((row) => row.entry.step)).toEqual([
    200, 201, 202, 203, 204,
  ]);
  await staff.mutation(api.auditLog.normalizeCaseHistory, {
    organizationId,
    caseType: "accession",
    entityId,
  });
  expect(
    (
      await staff.mutation(api.auditLog.normalizeCaseHistory, {
        organizationId,
        caseType: "accession",
        entityId,
      })
    ).isDone,
  ).toBe(true);
  expect(
    (
      await staff.mutation(api.auditLog.normalizeCaseHistory, {
        organizationId,
        caseType: "accession",
        entityId,
      })
    ).migratedThrough,
  ).toBe(205);
});

test("new case approvals append child evidence and remain in the public case timeline", async () => {
  const { t, staff, organizationId, userId } = await setup();
  const exhibitionId = await t.run(async (ctx) =>
    ctx.db.insert("exhibitions", {
      organizationId,
      title: "Original exhibition",
      startDate: 1,
      isCurrent: false,
      status: "proposed",
      workflowHistory: [
        { step: 0, approvedBy: userId, approvedAt: 1, comment: "Created" },
      ],
    }),
  );
  await staff.mutation(api.exhibitions.reject, {
    exhibitionId,
    comment: "Not ready",
  });
  const page = await staff.query(api.auditLog.listCaseHistory, {
    organizationId,
    caseType: "exhibition",
    entityId: exhibitionId,
  });
  expect(page.entries.map((row) => row.entry.comment)).toEqual([
    "Created",
    "Rejected: Not ready",
  ]);
  expect(
    (
      await staff.mutation(api.auditLog.normalizeCaseHistory, {
        organizationId,
        caseType: "exhibition",
        entityId: exhibitionId,
      })
    ).sourceLength,
  ).toBe(1);
  await t.run(async (ctx) => {
    await ctx.db.patch(userId, { name: "Changed" });
  });
  expect(
    (
      await staff.query(api.auditLog.listCaseHistory, {
        organizationId,
        caseType: "exhibition",
        entityId: exhibitionId,
      })
    ).entries[1]?.entry.approverName,
  ).toBe("Original registrar");
});

test("history export freezes creation membership, retains legacy evidence and traverses empty filtered pages", async () => {
  const { t, staff, organizationId, userId } = await setup();
  const asOf = Date.now() + 100_000;
  const clock = vi.spyOn(Date, "now").mockReturnValue(asOf - 10_000);
  try {
    await t.run(async (ctx) => {
      await ctx.db.insert("auditLog", {
        organizationId,
        userId,
        action: "rare_action",
        entityType: "collection",
        entityId: "old",
        timestamp: 1,
      });
      for (let i = 0; i < 120; i++)
        await ctx.db.insert("auditLog", {
          organizationId,
          userId,
          action: "updated",
          entityType: "collection",
          entityId: "recent",
          timestamp: 2,
        });
    });
    clock.mockReturnValue(asOf + 1000);
    await t.run(async (ctx) => {
      await ctx.db.insert("auditLog", {
        organizationId,
        userId,
        action: "rare_action",
        entityType: "collection",
        entityId: "backdated-after-export",
        timestamp: 0,
      });
    });
    const events: string[] = [];
    let cursor: string | null = null;
    do {
      const result = await staff.query(api.auditLog.exportPage, {
        organizationId,
        asOf,
        action: "rare",
        paginationOpts: { numItems: 50, cursor },
      });
      events.push(...result.entries.map((entry) => entry.entityId));
      cursor = result.nextCursor ?? null;
    } while (cursor);
    expect(events).toEqual(["old"]);
  } finally {
    clock.mockRestore();
  }
  await expect(
    staff.query(api.auditLog.list, { organizationId, fromDate: 2, toDate: 1 }),
  ).rejects.toThrow("Invalid history date range");
  await expect(
    staff.query(api.auditLog.list, { organizationId, limit: 101 }),
  ).rejects.toThrow("History page size");
});

test("only authorized administrators append corrections and retry conflicts keep originals unchanged", async () => {
  const { t, staff, organizationId, foreignOrganizationId, userId } =
    await setup();
  const ids = await t.run(async (ctx) => {
    const eventId = await ctx.db.insert("auditLog", {
      organizationId,
      userId,
      action: "created",
      entityType: "collection",
      entityId: "old",
      timestamp: 1,
      changes: { original: "evidence" },
    });
    const readerId = await ctx.db.insert("users", { name: "Reader" });
    const roleId = await ctx.db.insert("roles", {
      organizationId,
      name: "Reader",
      isSystemRole: false,
    });
    await ctx.db.insert("userOrganizations", {
      organizationId,
      userId: readerId,
      roleId,
      joinedAt: 1,
    });
    const permissionId = await ctx.db
      .query("permissions")
      .withIndex("by_category", (q) => q.eq("category", "collections"))
      .filter((q) => q.eq(q.field("name"), "collections.read"))
      .unique();
    await ctx.db.insert("rolePermissions", {
      roleId,
      permissionId: permissionId!._id,
    });
    return { eventId, readerId };
  });
  const request = {
    organizationId,
    eventId: ids.eventId,
    reason: "Documented correction",
    statement: "Additional evidence",
    requestId: "retry-2",
  };
  const reader = t.withIdentity({
    subject: `${ids.readerId}|session-1`,
    issuer: "https://example.test",
  });
  await expect(reader.mutation(api.auditLog.correct, request)).rejects.toThrow(
    "Permission denied",
  );
  await expect(
    staff.query(api.auditLog.getEntry, {
      organizationId: foreignOrganizationId,
      eventId: ids.eventId,
    }),
  ).rejects.toThrow();
  await staff.mutation(api.auditLog.correct, request);
  await expect(
    staff.mutation(api.auditLog.correct, {
      ...request,
      statement: "Changed retry",
    }),
  ).rejects.toThrow("conflicts");
  expect(
    (
      await staff.query(api.auditLog.getEntry, {
        organizationId,
        eventId: ids.eventId,
      })
    )?.changes,
  ).toEqual({ original: "evidence" });
});

test("native audit cursors preserve tied timestamp order without repeating events", async () => {
  const { t, staff, organizationId, userId } = await setup();
  await t.run(async (ctx) => {
    for (let i = 0; i < 155; i++)
      await ctx.db.insert("auditLog", {
        organizationId,
        userId,
        action: "updated",
        entityType: "collection",
        entityId: `tied-${i}`,
        timestamp: 1,
      });
  });
  const seen: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await staff.query(api.auditLog.list, {
      organizationId,
      action: "updated",
      actionMatch: "exact",
      cursor,
      limit: 50,
    });
    seen.push(...page.entries.map((entry) => entry._id));
    cursor = page.nextCursor;
  } while (cursor);
  expect(seen).toHaveLength(155);
  expect(new Set(seen).size).toBe(155);
});

test("public workflow history retrieves every approval across partial migration and cutover without duplicated legacy entries", async () => {
  const { t, staff, organizationId, userId } = await setup();
  const exhibitionId = await t.run(async (ctx) =>
    ctx.db.insert("exhibitions", {
      organizationId,
      title: "Long-lived case",
      startDate: 1,
      isCurrent: false,
      status: "proposed",
      workflowHistory: Array.from({ length: 1105 }, (_, step) => ({
        step,
        approvedBy: userId,
        approvedAt: step + 1,
        comment: `Approval ${step}`,
      })),
    }),
  );
  await staff.mutation(api.exhibitions.reject, {
    exhibitionId,
    comment: "Recorded after cutover",
  });
  async function readAll() {
    const approvals: string[] = [];
    let cursor: number | undefined;
    do {
      const page = await staff.query(api.exhibitions.getWorkflowHistory, {
        exhibitionId,
        cursor,
        limit: 100,
      });
      approvals.push(...page.entries.map((entry) => entry.comment!));
      cursor = page.nextCursor;
    } while (cursor !== undefined);
    return approvals;
  }
  const expected = [
    ...Array.from({ length: 1105 }, (_, i) => `Approval ${i}`),
    "Rejected: Recorded after cutover",
  ];
  expect(await readAll()).toEqual(expected);
  await staff.mutation(api.auditLog.normalizeCaseHistory, {
    organizationId,
    caseType: "exhibition",
    entityId: exhibitionId,
  });
  expect(await readAll()).toEqual(expected);
  let isDone = false;
  while (!isDone) {
    const result = await staff.mutation(api.auditLog.normalizeCaseHistory, {
      organizationId,
      caseType: "exhibition",
      entityId: exhibitionId,
    });
    isDone = result.isDone;
  }
  expect(await readAll()).toEqual(expected);
  await expect(
    t.query(api.exhibitions.getWorkflowHistory, { exhibitionId }),
  ).rejects.toThrow();
});
