import { convexTest } from "convex-test";
import { expect, test } from "vitest";

import { modules } from "../tests/testSetup";
import { api } from "./_generated/api";
import schema from "./schema";

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { name: "Assessor" });
    const organizationId = await ctx.db.insert("organizations", {
      name: "Museum",
      slug: "museum",
      type: "museum",
    });
    const roleId = await ctx.db.insert("roles", {
      organizationId,
      name: "Registrar",
      description: "Assessment role",
      isSystemRole: false,
    });
    for (const name of ["collections.read", "collections.update", "collections.accept_condition", "media.read"] as const) {
      const permissionId = await ctx.db.insert("permissions", {
        name,
        category: "collections",
        description: name,
      });
      await ctx.db.insert("rolePermissions", { roleId, permissionId });
    }
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId,
      joinedAt: Date.now(),
    });
    const collectionId = await ctx.db.insert("collections", {
      organizationId,
      accessionNumber: "A-1",
      title: "Vase",
      condition: "Fair",
      status: "active",
      catalogedBy: userId,
      catalogedAt: Date.now(),
    });
    return { userId, collectionId };
  });
  return { t, ...ids };
}

test("accepted assessment becomes current while legacy condition remains visible", async () => {
  const { t, userId, collectionId } = await setup();
  const asUser = t.withIdentity({ subject: userId });

  const assessmentId = await asUser.mutation(api.conditionAssessments.create, {
    collectionId,
    assessedAt: Date.UTC(2026, 9, 1),
    condition: "Poor",
    summary: "Crack at base",
    observations: [{ area: "Base", description: "Fine crack", severity: "moderate" }],
    photos: [],
  });
  expect((await asUser.query(api.conditionAssessments.getForObject, { collectionId })).current).toMatchObject({
    source: "legacy",
    condition: "Fair",
  });

  await asUser.mutation(api.conditionAssessments.accept, { assessmentId });
  const detail = await asUser.query(api.conditionAssessments.getForObject, { collectionId });
  expect(detail.current).toMatchObject({ source: "assessment", condition: "Poor", assessmentId });
  const history = await asUser.query(api.conditionAssessments.listForObject, {
    collectionId,
    paginationOpts: { numItems: 10, cursor: null },
  });
  expect(history.page).toMatchObject([{ _id: assessmentId, status: "accepted" }]);
  expect(detail.legacy).toMatchObject({ condition: "Fair", provenance: "uncertain" });
});

test("assessment history pages without losing earlier accepted evidence", async () => {
  const { t, userId, collectionId } = await setup();
  const asUser = t.withIdentity({ subject: userId });
  for (const condition of ["First", "Second", "Third"]) {
    const assessmentId = await asUser.mutation(api.conditionAssessments.create, {
      collectionId,
      assessedAt: Date.UTC(2026, 9, 1),
      condition,
      summary: `${condition} check`,
      observations: [{ area: "Base", description: "Inspected", severity: "minor" }],
      photos: [],
    });
    await asUser.mutation(api.conditionAssessments.accept, { assessmentId });
  }
  const firstPage = await asUser.query(api.conditionAssessments.listForObject, {
    collectionId,
    paginationOpts: { numItems: 2, cursor: null },
  });
  const secondPage = await asUser.query(api.conditionAssessments.listForObject, {
    collectionId,
    paginationOpts: { numItems: 2, cursor: firstPage.continueCursor },
  });
  expect([...firstPage.page, ...secondPage.page].map((item) => item.condition)).toEqual(["Third", "Second", "First"]);
});

test("capture and acceptance require separate permissions", async () => {
  const { t, userId, collectionId } = await setup();
  const asUser = t.withIdentity({ subject: userId });
  const assessmentId = await asUser.mutation(api.conditionAssessments.create, {
    collectionId,
    assessedAt: Date.UTC(2026, 9, 1),
    condition: "Good",
    summary: "No visible damage",
    observations: [],
    photos: [],
  });
  await t.run(async (ctx) => {
    const role = await ctx.db.query("userOrganizations")
      .withIndex("by_user_and_organization", (q) => q.eq("userId", userId))
      .first();
    if (!role) throw new Error("Missing test role");
    const permissions = await ctx.db.query("rolePermissions")
      .withIndex("by_role", (q) => q.eq("roleId", role.roleId)).collect();
    for (const item of permissions) {
      const permission = await ctx.db.get(item.permissionId);
      if (permission?.name === "collections.accept_condition") await ctx.db.delete(item._id);
    }
  });
  await expect(asUser.mutation(api.conditionAssessments.accept, { assessmentId })).rejects.toThrow();
  expect((await asUser.query(api.conditionAssessments.getForObject, { collectionId })).current.condition).toBe("Fair");
});

test("photo evidence belongs to the object and remains linked after acceptance", async () => {
  const { t, userId, collectionId } = await setup();
  const { photoId, otherPhotoId } = await t.run(async (ctx) => {
    const collection = await ctx.db.get(collectionId);
    if (!collection) throw new Error("Missing test object");
    const otherCollectionId = await ctx.db.insert("collections", {
      organizationId: collection.organizationId,
      accessionNumber: "A-2",
      title: "Other vase",
      status: "active",
      catalogedBy: userId,
      catalogedAt: Date.now(),
    });
    const createPhoto = async (targetId: typeof collectionId) => {
      const storageId = await ctx.storage.store(new Blob(["photo"], { type: "image/jpeg" }));
      return await ctx.db.insert("mediaFiles", {
        collectionId: targetId,
        organizationId: collection.organizationId,
        storageId,
        fileName: "base.jpg",
        fileType: "image",
        fileSize: 5,
        mimeType: "image/jpeg",
        isPrimary: false,
        uploadedBy: userId,
        uploadedAt: Date.now(),
        uploadStatus: "completed",
      });
    };
    return { photoId: await createPhoto(collectionId), otherPhotoId: await createPhoto(otherCollectionId) };
  });
  const asUser = t.withIdentity({ subject: userId });
  const input = {
    collectionId,
    assessedAt: Date.UTC(2026, 9, 1),
    condition: "Fair",
    summary: "Base photographed",
    observations: [{ area: "Base", description: "Fine mark", severity: "minor" as const }],
  };
  await expect(asUser.mutation(api.conditionAssessments.create, { ...input, photos: [otherPhotoId] })).rejects.toThrow("photo must belong");
  const assessmentId = await asUser.mutation(api.conditionAssessments.create, { ...input, photos: [photoId] });
  await asUser.mutation(api.conditionAssessments.accept, { assessmentId });
  await asUser.mutation(api.conditionAssessments.accept, { assessmentId });
  const page = await asUser.query(api.conditionAssessments.listForObject, {
    collectionId,
    paginationOpts: { numItems: 10, cursor: null },
  });
  expect(page.page[0]?.photos[0]).toMatchObject({ id: photoId, name: "base.jpg" });
  await expect(asUser.mutation(api.collections.update, { collectionId, condition: "Good", conditionChangeNote: "manual" })).rejects.toThrow("accepted assessment");
});

test("capture requires collections.update permission", async () => {
  const { t, userId, collectionId } = await setup();
  const asUser = t.withIdentity({ subject: userId });
  await t.run(async (ctx) => {
    const membership = await ctx.db.query("userOrganizations")
      .withIndex("by_user_and_organization", (q) => q.eq("userId", userId))
      .first();
    if (!membership) throw new Error("Missing test role");
    const grants = await ctx.db.query("rolePermissions")
      .withIndex("by_role", (q) => q.eq("roleId", membership.roleId)).collect();
    for (const item of grants) {
      const permission = await ctx.db.get(item.permissionId);
      if (permission?.name === "collections.update") await ctx.db.delete(item._id);
    }
  });
  await expect(asUser.mutation(api.conditionAssessments.create, {
    collectionId,
    assessedAt: Date.UTC(2026, 9, 1),
    condition: "Good",
    summary: "Blocked capture",
    observations: [],
    photos: [],
  })).rejects.toThrow();
});

test("rejects unauthenticated capture and future assessment dates", async () => {
  const { t, userId, collectionId } = await setup();
  await expect(t.mutation(api.conditionAssessments.create, {
    collectionId,
    assessedAt: Date.UTC(2026, 9, 1),
    condition: "Good",
    summary: "No auth",
    observations: [],
    photos: [],
  })).rejects.toThrow("Not authenticated");
  const asUser = t.withIdentity({ subject: userId });
  await expect(asUser.mutation(api.conditionAssessments.create, {
    collectionId,
    assessedAt: Date.now() + 86_400_000,
    condition: "Good",
    summary: "Future date",
    observations: [],
    photos: [],
  })).rejects.toThrow("future");
});

test("comparison exposes previous accepted assessment after a second acceptance", async () => {
  const { t, userId, collectionId } = await setup();
  const asUser = t.withIdentity({ subject: userId });
  for (const condition of ["First", "Second"]) {
    const assessmentId = await asUser.mutation(api.conditionAssessments.create, {
      collectionId,
      assessedAt: Date.UTC(2026, 9, 1),
      condition,
      summary: `${condition} check`,
      observations: [],
      photos: [],
    });
    await asUser.mutation(api.conditionAssessments.accept, { assessmentId });
  }
  const detail = await asUser.query(api.conditionAssessments.getForObject, { collectionId });
  expect(detail.comparison).toMatchObject({
    previousAccepted: { condition: "First" },
    currentCondition: "Second",
  });
});
