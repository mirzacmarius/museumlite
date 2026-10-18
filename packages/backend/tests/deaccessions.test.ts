import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import {
  authedForUser,
  createConvexTest,
  createOrgUserCollectionWithPermissions,
  createOrgUserWithPermissions,
} from "./testHarness";

test("delete requests create pending deaccessions instead of deleting immediately", async () => {
  const t = createConvexTest();
  const { organizationId, userId, roleId, collectionId } =
    await createOrgUserCollectionWithPermissions(
      t,
      [
        "collections.create",
        "collections.read",
        "collections.approve_deaccession",
      ],
      { roleName: "Collections Admin" },
    );

  await t.run(async (ctx) => {
    await ctx.db.insert("workflowConfigs", {
      organizationId,
      workflowType: "deaccession",
      steps: [{ stepNumber: 1, roleId, name: "Approve delete" }],
      canInitiateRoles: [roleId],
    });
  });

  const authed = authedForUser(t, userId);
  const deaccessionId = await authed.mutation(api.deaccessions.create, {
    organizationId,
    collectionId,
    dateDeaccessioned: Date.now(),
    reason: "Duplicate object",
    method: "destruction",
    targetCollectionStatus: "deleted",
  });

  const deaccession = await authed.query(api.deaccessions.get, {
    deaccessionId,
  });

  expect(deaccession).not.toBeNull();
  expect(deaccession?.status).toBe("pending");
  expect(deaccession?.targetCollectionStatus).toBe("deleted");

  const collection = await authed.query(api.collections.get, {
    collectionId,
  });
  expect(collection?.status).toBe("active");
});

test("an object with a deaccession waiting for approval cannot get a second one", async () => {
  const t = createConvexTest();
  const { organizationId, userId, roleId, collectionId } =
    await createOrgUserCollectionWithPermissions(
      t,
      [
        "collections.create",
        "collections.read",
        "collections.approve_deaccession",
      ],
      { roleName: "Collections Admin" },
    );
  await t.run(async (ctx) => {
    await ctx.db.insert("workflowConfigs", {
      organizationId,
      workflowType: "deaccession",
      steps: [{ stepNumber: 1, roleId, name: "Approve delete" }],
      canInitiateRoles: [roleId],
    });
  });
  const authed = authedForUser(t, userId);
  const request = {
    organizationId,
    collectionId,
    dateDeaccessioned: Date.now(),
    reason: "Duplicate object",
    method: "destruction" as const,
    targetCollectionStatus: "deleted" as const,
  };

  const first = await authed.mutation(api.deaccessions.create, request);
  await expect(
    authed.mutation(api.deaccessions.create, request),
  ).rejects.toThrow("already has a deaccession waiting for approval");

  await authed.mutation(api.deaccessions.reject, {
    deaccessionId: first,
    comment: "Keep it",
  });
  await expect(
    authed.mutation(api.deaccessions.create, request),
  ).resolves.toBeDefined();
});

test("approving an archive request marks the collection as archived", async () => {
  const t = createConvexTest();
  const { organizationId, userId, roleId, collectionId } =
    await createOrgUserCollectionWithPermissions(
      t,
      [
        "collections.create",
        "collections.read",
        "collections.approve_deaccession",
      ],
      { roleName: "Collections Admin" },
    );

  await t.run(async (ctx) => {
    await ctx.db.insert("workflowConfigs", {
      organizationId,
      workflowType: "deaccession",
      steps: [{ stepNumber: 1, roleId, name: "Approve archive" }],
      canInitiateRoles: [roleId],
    });
  });

  const authed = authedForUser(t, userId);
  const deaccessionId = await authed.mutation(api.deaccessions.create, {
    organizationId,
    collectionId,
    dateDeaccessioned: Date.now(),
    reason: "Moved out of active catalog",
    method: "destruction",
    targetCollectionStatus: "archived",
  });

  await authed.mutation(api.deaccessions.approve, {
    deaccessionId,
  });

  const collection = await authed.query(api.collections.get, {
    collectionId,
  });

  expect(collection?.status).toBe("archived");
  expect(collection?.archivedReason).toBe("Moved out of active catalog");
});

test("deaccession workflows with config step 0 still complete on the last real approval step", async () => {
  const t = createConvexTest();
  const { organizationId, userId, roleId, collectionId } =
    await createOrgUserCollectionWithPermissions(
      t,
      [
        "collections.create",
        "collections.read",
        "collections.approve_deaccession",
      ],
      { roleName: "Collections Admin" },
    );

  await t.run(async (ctx) => {
    await ctx.db.insert("workflowConfigs", {
      organizationId,
      workflowType: "deaccession",
      steps: [
        { stepNumber: 0, roleId, name: "Initial Review" },
        { stepNumber: 1, roleId, name: "Registrar Review" },
        { stepNumber: 2, roleId, name: "Final Approval" },
      ],
      canInitiateRoles: [roleId],
    });
  });

  const authed = authedForUser(t, userId);
  const deaccessionId = await authed.mutation(api.deaccessions.create, {
    organizationId,
    collectionId,
    dateDeaccessioned: Date.now(),
    reason: "Duplicate object",
    method: "destruction",
    targetCollectionStatus: "deleted",
  });

  let deaccession = await authed.query(api.deaccessions.get, {
    deaccessionId,
  });

  expect(deaccession).not.toBeNull();
  expect(deaccession?.workflowStep).toBe(1);

  await authed.mutation(api.deaccessions.approve, {
    deaccessionId,
  });

  deaccession = await authed.query(api.deaccessions.get, {
    deaccessionId,
  });

  expect(deaccession).not.toBeNull();
  expect(deaccession?.status).toBe("pending");
  expect(deaccession?.workflowStep).toBe(2);

  await authed.mutation(api.deaccessions.approve, {
    deaccessionId,
  });

  deaccession = await authed.query(api.deaccessions.get, {
    deaccessionId,
  });

  expect(deaccession).not.toBeNull();
  expect(deaccession?.status).toBe("approved");
});

test("getWorkflowSteps returns deaccessions terminal column without rejected column", async () => {
  const t = createConvexTest();
  const { organizationId, userId, roleId } = await createOrgUserWithPermissions(
    t,
    ["collections.create", "collections.read"],
    { roleName: "Collections Admin" },
  );

  await t.run(async (ctx) => {
    await ctx.db.insert("workflowConfigs", {
      organizationId,
      workflowType: "deaccession",
      steps: [
        { stepNumber: 1, roleId, name: "Curator Review" },
        { stepNumber: 2, roleId, name: "Director Approval" },
      ],
      canInitiateRoles: [roleId],
    });
  });

  const authed = authedForUser(t, userId);
  const workflow = await authed.query(api.deaccessions.getWorkflowSteps, {
    organizationId,
  });

  expect(workflow.steps.map((step) => step.name)).toEqual([
    "Curator Review",
    "Director Approval",
    "Deaccessions",
  ]);
  expect(workflow.steps.map((step) => step.name)).not.toContain("Rejected");
});

test("rejecting a deaccession restores prematurely removed objects to active catalog", async () => {
  const t = createConvexTest();
  const { organizationId, userId, roleId, collectionId } =
    await createOrgUserCollectionWithPermissions(
      t,
      [
        "collections.create",
        "collections.read",
        "collections.approve_deaccession",
      ],
      { roleName: "Collections Admin" },
    );

  await t.run(async (ctx) => {
    await ctx.db.insert("workflowConfigs", {
      organizationId,
      workflowType: "deaccession",
      steps: [{ stepNumber: 1, roleId, name: "Curator Review" }],
      canInitiateRoles: [roleId],
    });
  });

  const authed = authedForUser(t, userId);
  const deaccessionId = await authed.mutation(api.deaccessions.create, {
    organizationId,
    collectionId,
    dateDeaccessioned: Date.now(),
    reason: "Duplicate object",
    method: "destruction",
    targetCollectionStatus: "deleted",
  });

  await t.run(async (ctx) => {
    await ctx.db.patch(collectionId, {
      status: "deleted",
      deletedAt: Date.now(),
      deletedBy: userId,
      deletedReason: "Premature deletion",
    });
  });

  await authed.mutation(api.deaccessions.reject, {
    deaccessionId,
    comment: "Keep object",
  });

  const collection = await authed.query(api.collections.get, {
    collectionId,
  });

  expect(collection?.status).toBe("active");
  expect(collection?.deletedAt).toBeUndefined();
  expect(collection?.deletedBy).toBeUndefined();
  expect(collection?.deletedReason).toBeUndefined();
});
