import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";
import { modules } from "./testSetup";

async function fixture(
  tier: "free" | "pro" | "enterprise" = "free",
  extraPermissions: string[] = [],
) {
  const t = convexTest(schema, modules);
  const f = await t.run(async (ctx) => {
    const organizationId = await ctx.db.insert("organizations", {
      name: "Museum",
      slug: "exports",
      type: "museum",
      subscriptionTier: tier,
    });
    const userId = await ctx.db.insert("users", {
      email: "export@example.test",
    });
    const roleId = await ctx.db.insert("roles", {
      organizationId,
      name: "Reader",
      isSystemRole: false,
    });
    const permissionId = await ctx.db.insert("permissions", {
      name: "collections.read",
      category: "collections",
    });
    await ctx.db.insert("rolePermissions", { roleId, permissionId });
    const updatePermissionId = await ctx.db.insert("permissions", {
      name: "collections.update",
      category: "collections",
    });
    await ctx.db.insert("rolePermissions", {
      roleId,
      permissionId: updatePermissionId,
    });
    const deletePermissionId = await ctx.db.insert("permissions", {
      name: "collections.delete",
      category: "collections",
    });
    await ctx.db.insert("rolePermissions", {
      roleId,
      permissionId: deletePermissionId,
    });
    for (const name of extraPermissions) {
      const extraPermissionId = await ctx.db.insert("permissions", {
        name,
        category: "collections",
      });
      await ctx.db.insert("rolePermissions", {
        roleId,
        permissionId: extraPermissionId,
      });
    }
    const membershipId = await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId,
      joinedAt: Date.now(),
    });
    return { organizationId, userId, membershipId };
  });
  return { t, ...f, user: t.withIdentity({ subject: `${f.userId}|test` }) };
}

describe("authorized durable exports", () => {
  test("request is idempotent and cancelled jobs resume with a frozen scope", async () => {
    vi.useFakeTimers();
    const f = await fixture();
    const args = {
      organizationId: f.organizationId,
      requestKey: "request-1",
      format: "jsonl" as const,
      source: {
        kind: "objects" as const,
        mode: "filtered" as const,
        filters: {},
      },
    };
    const jobId = await f.user.mutation(api.exports.create, args);
    expect(await f.user.mutation(api.exports.create, args)).toBe(jobId);
    await f.user.mutation(api.exports.cancel, { jobId });
    const cancelled = await f.user.query(api.exports.status, { jobId });
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.rows).toBe(0);
    await f.user.mutation(api.exports.resume, { jobId });
    expect((await f.user.query(api.exports.status, { jobId })).asOf).toBe(
      cancelled.asOf,
    );
    await f.user.mutation(api.exports.cancel, { jobId });
    await f.t.finishAllScheduledFunctions(vi.runAllTimers);
    vi.useRealTimers();
  });
  test("complete filtered JSONL preserves typed rows and reauthorizes HTTP downloads", async () => {
    vi.useFakeTimers();
    const f = await fixture("free", ["organization.view_analytics"]);
    await f.t.run(async (ctx) => {
      for (let i = 0; i < 125; i++)
        await ctx.db.insert("collections", {
          organizationId: f.organizationId,
          title: i === 0 ? "=SUM(A1)" : `Object ${i}`,
          accessionNumber: `001-${i}`,
          status: "active",
          catalogedBy: f.userId,
          catalogedAt: 1700000000000,
          dimensionHeight: -12.5,
        });
    });
    vi.advanceTimersByTime(1000);
    const jobId = await f.user.mutation(api.exports.create, {
      organizationId: f.organizationId,
      requestKey: "typed",
      format: "jsonl",
      source: {
        kind: "objects",
        mode: "filtered",
        filters: { status: "active" },
      },
    });
    await f.t.finishInProgressScheduledFunctions();
    await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1));
    const job = await f.user.query(api.exports.status, { jobId });
    expect(job.status).toBe("completed");
    expect(job.rows).toBe(125);
    expect(job.sha256).toMatch(/^[a-f0-9]{64}$/);
    const response = await f.user.fetch(`/exports/download?jobId=${jobId}`);
    expect(response.status).toBe(200);
    const rows = (await response.text())
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(rows).toHaveLength(125);
    expect(rows[0]).toMatchObject({
      title: "=SUM(A1)",
      accessionNumber: "001-0",
      dimensionHeight: -12.5,
      catalogedAt: 1700000000000,
    });
    const evidence = await f.user.query(api.auditLog.list, {
      organizationId: f.organizationId,
      action: "export.completed",
      actionMatch: "exact",
      entityType: "exportJob",
      entityId: jobId,
    });
    expect(evidence.entries).toHaveLength(1);
    expect(evidence.entries[0]?.changes).toMatchObject({
      rows: 125,
      sha256: job.sha256,
      schemaVersion: 1,
      asOf: job.asOf,
    });
    expect(
      (await f.user.fetch(`/exports/download?jobId=not-an-id`)).status,
    ).toBe(400);
    await f.t.run((ctx) => ctx.db.delete(f.membershipId));
    expect(
      (await f.user.fetch(`/exports/download?jobId=${jobId}`)).status,
    ).toBe(403);
    await expect(f.user.query(api.exports.status, { jobId })).rejects.toThrow();
    vi.useRealTimers();
  });

  test("selected CSV keeps text safe, numbers numeric and duplicate upload idempotent", async () => {
    vi.useFakeTimers();
    const f = await fixture();
    const objectId = await f.t.run((ctx) =>
      ctx.db.insert("collections", {
        organizationId: f.organizationId,
        title: '  =HYPERLINK("https://bad")',
        accessionNumber: "000123",
        creator: "+cmd",
        status: "active",
        catalogedBy: f.userId,
        catalogedAt: 1700000000000,
        dimensionHeight: -12.5,
      }),
    );
    vi.advanceTimersByTime(100);
    const jobId = await f.user.mutation(api.exports.create, {
      organizationId: f.organizationId,
      requestKey: "csv",
      format: "csv",
      selectedCount: 1,
      source: { kind: "objects", mode: "selected", filters: {} },
    });
    await f.user.mutation(api.exports.appendSelection, {
      jobId,
      objectIds: [objectId, objectId],
    });
    await f.user.mutation(api.exports.appendSelection, {
      jobId,
      objectIds: [objectId],
    });
    expect((await f.user.query(api.exports.status, { jobId })).selected).toBe(
      1,
    );
    await f.user.mutation(api.exports.start, { jobId });
    await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1));
    expect((await f.user.query(api.exports.status, { jobId })).rows).toBe(1);
    const csv = await (
      await f.user.fetch(`/exports/download?jobId=${jobId}`)
    ).text();
    expect(csv).toContain('"000123"');
    expect(csv).toContain('"\'  =HYPERLINK(""https://bad"")"');
    expect(csv).toContain('"\'+cmd"');
    expect(csv).toContain(",-12.5,");
    const metadata = await (
      await f.user.fetch(`/exports/manifest?jobId=${jobId}`)
    ).json();
    expect(metadata.columns).toContainEqual({
      name: "dimensionHeight",
      type: "number",
    });
    expect(metadata.columns).toContainEqual({
      name: "accessionNumber",
      type: "text",
    });
    expect(metadata.compatibility).toContain(
      "CSV does not encode spreadsheet cell types",
    );
    vi.useRealTimers();
  });
  test("missing selected rows fail visibly; retry preserves filters and checkpoint", async () => {
    vi.useFakeTimers();
    const f = await fixture();
    const objectId = await f.t.run((ctx) =>
      ctx.db.insert("collections", {
        organizationId: f.organizationId,
        title: "Selected",
        accessionNumber: "S",
        status: "active",
        catalogedBy: f.userId,
        catalogedAt: Date.now(),
      }),
    );
    vi.advanceTimersByTime(100);
    const jobId = await f.user.mutation(api.exports.create, {
      organizationId: f.organizationId,
      requestKey: "missing",
      format: "jsonl",
      selectedCount: 1,
      source: { kind: "objects", mode: "selected", filters: {} },
    });
    await f.user.mutation(api.exports.appendSelection, {
      jobId,
      objectIds: [objectId],
    });
    await f.t.run((ctx) => ctx.db.delete(objectId));
    await f.user.mutation(api.exports.start, { jobId });
    await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1));
    const failed = await f.user.query(api.exports.status, { jobId });
    expect(failed.status).toBe("failed");
    expect(failed.error).toContain("Selected object missing");
    expect(failed.rows).toBe(0);
    expect(
      (await f.user.fetch(`/exports/download?jobId=${jobId}`)).status,
    ).toBe(403);
    await f.user.mutation(api.exports.resume, { jobId });
    await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1));
    expect(
      (await f.user.query(api.exports.status, { jobId })).attempts,
    ).toBeGreaterThan(failed.attempts);
    vi.useRealTimers();
  });

  test("selected uploads cannot silently complete an interrupted requested selection", async () => {
    vi.useFakeTimers();
    const f = await fixture();
    const objectId = await f.t.run((ctx) =>
      ctx.db.insert("collections", {
        organizationId: f.organizationId,
        title: "One",
        accessionNumber: "1",
        status: "active",
        catalogedBy: f.userId,
        catalogedAt: Date.now(),
      }),
    );
    vi.advanceTimersByTime(100);
    const jobId = await f.user.mutation(api.exports.create, {
      organizationId: f.organizationId,
      requestKey: "partial",
      format: "jsonl",
      selectedCount: 2,
      source: { kind: "objects", mode: "selected", filters: {} },
    });
    await f.user.mutation(api.exports.appendSelection, {
      jobId,
      objectIds: [objectId],
    });
    await expect(f.user.mutation(api.exports.start, { jobId })).rejects.toThrow(
      "Selection upload incomplete",
    );
    await f.user.mutation(api.exports.cancel, { jobId });
    await f.user.mutation(api.exports.resume, { jobId });
    expect((await f.user.query(api.exports.status, { jobId })).status).toBe(
      "selecting",
    );
    vi.useRealTimers();
  });

  test("exports more than 5,000 filtered objects and more than 1,000 immutable audit entries completely", async () => {
    vi.useFakeTimers();
    const f = await fixture("enterprise", ["organization.view_analytics"]);
    await f.t.run(async (ctx) => {
      for (let i = 0; i < 5003; i++)
        await ctx.db.insert("collections", {
          organizationId: f.organizationId,
          title: `Object ${i}`,
          accessionNumber: `L-${i}`,
          status: i % 2 ? "loaned" : "active",
          catalogedBy: f.userId,
          catalogedAt: 1700000000000,
        });
      for (let i = 0; i < 1103; i++)
        await ctx.db.insert("auditLog", {
          organizationId: f.organizationId,
          userId: f.userId,
          action: "created",
          entityType: "collection",
          entityId: `object-${i}`,
          timestamp: 1700000000000,
          actorSnapshot: { name: "Original curator" },
          subjectSnapshot: { label: `Evidence ${i}` },
        });
    });
    vi.advanceTimersByTime(20000);
    const objects = await f.user.mutation(api.exports.create, {
      organizationId: f.organizationId,
      requestKey: "large-objects",
      format: "jsonl",
      source: { kind: "objects", mode: "filtered", filters: {} },
    });
    const audit = await f.user.mutation(api.exports.create, {
      organizationId: f.organizationId,
      requestKey: "large-audit",
      format: "jsonl",
      source: { kind: "audit", filters: { action: "created" } },
    });
    await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1));
    expect(
      (await f.user.query(api.exports.status, { jobId: objects })).rows,
    ).toBe(5003);
    expect(
      (await f.user.query(api.exports.status, { jobId: audit })).rows,
    ).toBe(1103);
    for (const [jobId, expected] of [
      [objects, 5003],
      [audit, 1103],
    ] as const) {
      const job = await f.user.query(api.exports.status, { jobId });
      expect(job.status).toBe("completed");
      expect(job.sourceDone).toBe(true);
      const response = await f.user.fetch(`/exports/download?jobId=${jobId}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      const lines = new TextDecoder()
        .decode(bytes)
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      expect(lines).toHaveLength(expected);
      expect(new Set(lines.map((row) => row._id)).size).toBe(expected);
      if (jobId === audit)
        expect(lines[0].actorSnapshot.name).toBe("Original curator");
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      expect(
        Array.from(new Uint8Array(digest), (b) =>
          b.toString(16).padStart(2, "0"),
        ).join(""),
      ).toBe(job.sha256);
      expect(bytes.byteLength).toBe(job.bytes);
    }
    vi.useRealTimers();
  }, 20000);
  test("cancel/resume reconciles checkpoint rows during concurrent catalog changes and excludes later inserts", async () => {
    vi.useFakeTimers();
    const f = await fixture();
    const ids = await f.t.run(async (ctx) => {
      const ids = [];
      for (let i = 0; i < 130; i++)
        ids.push(
          await ctx.db.insert("collections", {
            organizationId: f.organizationId,
            title: `Original ${i}`,
            accessionNumber: `C-${i}`,
            status: "active",
            catalogedBy: f.userId,
            catalogedAt: 1700000000000,
          }),
        );
      return ids;
    });
    vi.advanceTimersByTime(1000);
    const jobId = await f.user.mutation(api.exports.create, {
      organizationId: f.organizationId,
      requestKey: "concurrent",
      format: "jsonl",
      source: { kind: "objects", mode: "filtered", filters: {} },
    });
    vi.advanceTimersByTime(1);
    await f.t.finishInProgressScheduledFunctions();
    const checkpoint = await f.user.query(api.exports.status, { jobId });
    expect(checkpoint.rows).toBe(100);
    await f.user.mutation(api.exports.cancel, { jobId });
    await f.user.mutation(api.collections.update, {
      collectionId: ids[0] as (typeof ids)[number],
      title: "After capture",
    });
    await f.user.mutation(api.collections.update, {
      collectionId: ids[129] as (typeof ids)[number],
      title: "Before capture",
    });
    await f.user.mutation(api.collections.archiveCollection, {
      collectionId: ids[128] as (typeof ids)[number],
      reason: "Removed during capture",
    });
    vi.advanceTimersByTime(100);
    await f.t.run((ctx) =>
      ctx.db.insert("collections", {
        organizationId: f.organizationId,
        title: "Late insert",
        accessionNumber: "C-late",
        status: "active",
        catalogedBy: f.userId,
        catalogedAt: 1700000000000,
      }),
    );
    await f.user.mutation(api.exports.resume, { jobId });
    await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1));
    const job = await f.user.query(api.exports.status, { jobId });
    expect(job.status).toBe("completed");
    expect(job.rows).toBe(129);
    expect(job.asOf).toBe(checkpoint.asOf);
    const rows = (
      await (await f.user.fetch(`/exports/download?jobId=${jobId}`)).text()
    )
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(new Set(rows.map((row) => row._id)).size).toBe(129);
    expect(rows.find((row) => row._id === ids[0]).title).toBe("Original 0");
    expect(rows.find((row) => row._id === ids[129]).title).toBe(
      "Before capture",
    );
    expect(rows.some((row) => row.title === "Late insert")).toBe(false);
    expect(rows.some((row) => row._id === ids[128])).toBe(false);
    vi.useRealTimers();
  });

  test("revoked continuations fail and authorized retry resumes the same checkpoint without spending quota again", async () => {
    vi.useFakeTimers();
    const f = await fixture();
    const member = await f.t.run((ctx) => ctx.db.get(f.membershipId));
    if (!member) throw new Error("Fixture member missing");
    await f.t.run(async (ctx) => {
      for (let i = 0; i < 130; i++)
        await ctx.db.insert("collections", {
          organizationId: f.organizationId,
          title: `Row ${i}`,
          accessionNumber: `R-${i}`,
          status: "active",
          catalogedBy: f.userId,
          catalogedAt: 1,
        });
    });
    vi.advanceTimersByTime(1000);
    const args = {
      organizationId: f.organizationId,
      requestKey: "reauth",
      format: "jsonl" as const,
      source: {
        kind: "objects" as const,
        mode: "filtered" as const,
        filters: {},
      },
    };
    const jobId = await f.user.mutation(api.exports.create, args);
    vi.advanceTimersByTime(1);
    await f.t.finishInProgressScheduledFunctions();
    await f.t.run((ctx) => ctx.db.delete(f.membershipId));
    await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1));
    expect(
      (await f.user.fetch(`/exports/download?jobId=${jobId}`)).status,
    ).toBe(403);
    await f.t.run((ctx) =>
      ctx.db.insert("userOrganizations", {
        userId: f.userId,
        organizationId: f.organizationId,
        roleId: member.roleId,
        joinedAt: 1,
      }),
    );
    const failed = await f.user.query(api.exports.status, { jobId });
    expect(failed.status).toBe("failed");
    expect(failed.rows).toBe(100);
    await f.user.mutation(api.exports.resume, { jobId });
    await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1));
    expect((await f.user.query(api.exports.status, { jobId })).rows).toBe(130);
    expect(await f.user.mutation(api.exports.create, args)).toBe(jobId);
    for (let i = 0; i < 9; i++) {
      const extra = await f.user.mutation(api.exports.create, {
        ...args,
        requestKey: `quota-${i}`,
      });
      await f.user.mutation(api.exports.cancel, { jobId: extra });
    }
    await expect(
      f.user.mutation(api.exports.create, { ...args, requestKey: "quota-11" }),
    ).rejects.toThrow("Export limit reached");
    const foreign = await f.t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        email: "other@example.test",
      });
      await ctx.db.insert("userOrganizations", {
        userId,
        organizationId: f.organizationId,
        roleId: member.roleId,
        joinedAt: 1,
      });
      return userId;
    });
    const other = f.t.withIdentity({ subject: `${foreign}|test` });
    await expect(other.query(api.exports.status, { jobId })).rejects.toThrow(
      "Export unavailable",
    );
    expect((await other.fetch(`/exports/download?jobId=${jobId}`)).status).toBe(
      403,
    );
    expect((await f.t.fetch(`/exports/download?jobId=${jobId}`)).status).toBe(
      403,
    );
    await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1));
    vi.advanceTimersByTime(7 * 24 * 60 * 60 * 1000);
    await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1));
    expect((await f.user.query(api.exports.status, { jobId })).status).toBe(
      "expired",
    );
    expect(
      (await f.user.fetch(`/exports/download?jobId=${jobId}`)).status,
    ).toBe(403);
    vi.useRealTimers();
  });
  test("expired exports leave no captured selection, chunk or part records behind", async () => {
    vi.useFakeTimers();
    const f = await fixture();
    const objectIds = await f.t.run(async (ctx) =>
      Promise.all(
        Array.from({ length: 3 }, (_, i) =>
          ctx.db.insert("collections", {
            organizationId: f.organizationId,
            title: `Expiring ${i}`,
            accessionNumber: `EXP-${i}`,
            status: "active",
            catalogedBy: f.userId,
            catalogedAt: 1,
          }),
        ),
      ),
    );
    vi.advanceTimersByTime(100);
    const jobId = await f.user.mutation(api.exports.create, {
      organizationId: f.organizationId,
      requestKey: "expiring",
      format: "jsonl",
      selectedCount: objectIds.length,
      source: { kind: "objects", mode: "selected", filters: {} },
    });
    await f.user.mutation(api.exports.appendSelection, { jobId, objectIds });
    await f.user.mutation(api.exports.start, { jobId });
    await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1));
    expect((await f.user.query(api.exports.status, { jobId })).status).toBe(
      "completed",
    );
    vi.advanceTimersByTime(7 * 24 * 60 * 60 * 1000);
    await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1));
    expect((await f.user.query(api.exports.status, { jobId })).status).toBe(
      "expired",
    );
    const remaining = await f.t.run(async (ctx) => ({
      selections: (
        await ctx.db
          .query("exportSelections")
          .withIndex("by_jobId", (q) => q.eq("jobId", jobId))
          .take(1)
      ).length,
      chunks: (
        await ctx.db
          .query("exportChunks")
          .withIndex("by_jobId_and_sequence", (q) => q.eq("jobId", jobId))
          .take(1)
      ).length,
      parts: (
        await ctx.db
          .query("exportParts")
          .withIndex("by_jobId_and_level_and_sequence", (q) =>
            q.eq("jobId", jobId),
          )
          .take(1)
      ).length,
    }));
    expect(remaining).toEqual({ selections: 0, chunks: 0, parts: 0 });
    vi.useRealTimers();
  });
  test("cancellation during artifact consolidation resumes without losing or duplicating chunks", async () => {
    vi.useFakeTimers();
    const f = await fixture();
    await f.t.run(async (ctx) => {
      for (let i = 0; i < 1701; i++)
        await ctx.db.insert("collections", {
          organizationId: f.organizationId,
          title: `Part ${i}`,
          accessionNumber: `P-${i}`,
          status: "active",
          catalogedBy: f.userId,
          catalogedAt: 1,
        });
    });
    vi.advanceTimersByTime(5000);
    const jobId = await f.user.mutation(api.exports.create, {
      organizationId: f.organizationId,
      requestKey: "parts",
      format: "jsonl",
      source: { kind: "objects", mode: "filtered", filters: {} },
    });
    let sourceDone = false;
    for (let i = 0; i < 20 && !sourceDone; i++) {
      vi.advanceTimersByTime(1);
      await f.t.finishInProgressScheduledFunctions();
      ({ sourceDone } = await f.user.query(api.exports.status, { jobId }));
    }
    expect((await f.user.query(api.exports.status, { jobId })).status).toBe(
      "finalizing",
    );
    vi.advanceTimersByTime(1);
    await f.t.finishInProgressScheduledFunctions();
    expect((await f.user.query(api.exports.status, { jobId })).status).toBe(
      "finalizing",
    );
    await f.user.mutation(api.exports.cancel, { jobId });
    await f.user.mutation(api.exports.resume, { jobId });
    await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1));
    const job = await f.user.query(api.exports.status, { jobId });
    expect(job.status).toBe("completed");
    expect(job.rows).toBe(1701);
    expect(job.completedAt).toBeGreaterThanOrEqual(job.captureCompletedAt ?? 0);
    const bytes = await (
      await f.user.fetch(`/exports/download?jobId=${jobId}`)
    ).arrayBuffer();
    const rows = new TextDecoder()
      .decode(bytes)
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(new Set(rows.map((row) => row._id)).size).toBe(1701);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    expect(
      Array.from(new Uint8Array(digest), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join(""),
    ).toBe(job.sha256);
    vi.useRealTimers();
  }, 10000);
  test("Pro readers cannot create compliance audit exports or access an Enterprise artifact after downgrade", async () => {
    vi.useFakeTimers();
    const f = await fixture("pro", ["organization.view_analytics"]);
    const args = {
      organizationId: f.organizationId,
      requestKey: "compliance",
      format: "jsonl" as const,
      source: { kind: "audit" as const, filters: {} },
    };
    await expect(f.user.mutation(api.exports.create, args)).rejects.toThrow(
      "enterprise tier",
    );
    await f.t.run((ctx) =>
      ctx.db.patch(f.organizationId, { subscriptionTier: "enterprise" }),
    );
    const jobId = await f.user.mutation(api.exports.create, args);
    await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1));
    expect((await f.user.query(api.exports.status, { jobId })).status).toBe(
      "completed",
    );
    expect(
      (await f.user.fetch(`/exports/download?jobId=${jobId}`)).status,
    ).toBe(200);
    await f.t.run((ctx) =>
      ctx.db.patch(f.organizationId, { subscriptionTier: "pro" }),
    );
    expect(
      (await f.user.fetch(`/exports/download?jobId=${jobId}`)).status,
    ).toBe(403);
    await expect(f.user.query(api.exports.status, { jobId })).rejects.toThrow(
      "enterprise tier",
    );
    expect(
      await f.user.query(api.exports.list, {
        organizationId: f.organizationId,
      }),
    ).toEqual([]);
    vi.useRealTimers();
  });
  test("audit exports require audit-read access and the case filter's own permission", async () => {
    vi.useFakeTimers();
    const f = await fixture("enterprise");
    const audit = (requestKey: string, caseId?: string) => ({
      organizationId: f.organizationId,
      requestKey,
      format: "jsonl" as const,
      source: { kind: "audit" as const, filters: { caseId } },
    });
    await expect(
      f.user.mutation(api.exports.create, audit("no-analytics")),
    ).rejects.toThrow("Permission denied: organization.view_analytics");
    await f.t.run(async (ctx) => {
      const membership = await ctx.db.get(f.membershipId);
      const permissionId = await ctx.db.insert("permissions", {
        name: "organization.view_analytics",
        category: "organization",
      });
      await ctx.db.insert("rolePermissions", {
        roleId: membership!.roleId,
        permissionId,
      });
    });
    const loanCaseJob = await f.user.mutation(
      api.exports.create,
      audit("loan-case", "loan:any"),
    );
    await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1));
    const loanCase = await f.user.query(api.exports.status, {
      jobId: loanCaseJob,
    });
    expect(loanCase.status).toBe("failed");
    expect(loanCase.error).toContain("loans.read");
    vi.useRealTimers();
  });
  test("inventory drilldown exports freeze and apply the same incoming-loan classification filter", async () => {
    vi.useFakeTimers();
    const f = await fixture();
    await f.t.run(async (ctx) => {
      const owned = await ctx.db.insert("collections", {
        organizationId: f.organizationId,
        title: "Owned",
        accessionNumber: "owned",
        status: "active",
        catalogedBy: f.userId,
        catalogedAt: 1,
      });
      const incoming = await ctx.db.insert("collections", {
        organizationId: f.organizationId,
        title: "Borrowed",
        accessionNumber: "borrowed",
        status: "active",
        catalogedBy: f.userId,
        catalogedAt: 1,
      });
      const loanId = await ctx.db.insert("loans", {
        organizationId: f.organizationId,
        loanNumber: "incoming",
        type: "incoming",
        lenderBorrowerName: "Lender",
        startDate: 1,
        status: "returned",
      });
      await ctx.db.insert("loanItems", { loanId, collectionId: incoming });
      return owned;
    });
    vi.advanceTimersByTime(1000);
    const jobId = await f.user.mutation(api.exports.create, {
      organizationId: f.organizationId,
      requestKey: "inventory-scope",
      format: "jsonl",
      source: {
        kind: "objects",
        mode: "filtered",
        filters: { inventoryMetricScope: "incoming" },
      },
    });
    await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1));
    const job = await f.user.query(api.exports.status, { jobId });
    expect(job.status).toBe("completed");
    expect(job.rows).toBe(1);
    expect(
      JSON.parse(
        (
          await (await f.user.fetch(`/exports/download?jobId=${jobId}`)).text()
        ).trim(),
      ).title,
    ).toBe("Borrowed");
    vi.useRealTimers();
  });
});
