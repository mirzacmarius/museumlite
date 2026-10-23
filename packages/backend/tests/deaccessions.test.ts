import { anyApi } from "convex/server";
import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { workflowApprovalErrorFromError } from "../convex/utils/workflowApprovalErrors";
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
  const refusal = await authed.mutation(api.deaccessions.create, request).then(
    () => null,
    (error) => workflowApprovalErrorFromError(error)?.code,
  );
  expect(refusal).toBe("ALREADY_PENDING");
  // Bulk removal leaves the waiting one as it is.
  expect(
    await authed.mutation(api.collections.bulkDeaccession, {
      collectionIds: [collectionId],
      reason: "Duplicate object",
    }),
  ).toMatchObject({ skipped: 1, failed: 0, awaitingDecision: 0 });

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

describe("the Object's actions match what the mutations allow", () => {
  const initiator = [
    "collections.create",
    "collections.read",
    "collections.delete",
  ];

  async function setup(permissions = initiator) {
    const t = createConvexTest();
    const ids = await createOrgUserCollectionWithPermissions(t, permissions);
    return { t, ...ids, authed: authedForUser(t, ids.userId) };
  }

  const request = (
    organizationId: Id<"organizations">,
    collectionId: Id<"collections">,
  ) => ({
    organizationId,
    collectionId,
    dateDeaccessioned: Date.now(),
    reason: "Duplicate object",
    method: "destruction" as const,
    targetCollectionStatus: "deleted" as const,
  });

  test("an accessioned object off loan offers both, without approval", async () => {
    const { authed, organizationId, collectionId } = await setup();

    expect(await authed.query(api.objectActions.get, { collectionId })).toEqual(
      {
        deaccession: { state: "available", approvalSteps: 0 },
        remove: { state: "available" },
      },
    );
    await expect(
      authed.mutation(
        api.deaccessions.create,
        request(organizationId, collectionId),
      ),
    ).resolves.toBeDefined();
  });

  test("an approval workflow reports its steps", async () => {
    const { t, authed, organizationId, roleId, collectionId } = await setup();
    await t.run((ctx) =>
      ctx.db.insert("workflowConfigs", {
        organizationId,
        workflowType: "deaccession",
        steps: [
          { stepNumber: 1, roleId, name: "Curator Review" },
          { stepNumber: 2, roleId, name: "Director Approval" },
        ],
        canInitiateRoles: [roleId],
      }),
    );

    expect(
      (await authed.query(api.objectActions.get, { collectionId }))
        ?.deaccession,
    ).toEqual({ state: "available", approvalSteps: 2 });
  });

  test("an object on loan is blocked for both", async () => {
    const { t, authed, organizationId, collectionId } = await setup();
    await t.run(async (ctx) => {
      const loanId = await ctx.db.insert("loans", {
        organizationId,
        loanNumber: "L-1",
        lenderBorrowerName: "Partner",
        type: "outgoing",
        status: "active",
        startDate: Date.now(),
      });
      await ctx.db.insert("loanItems", { loanId, collectionId });
    });

    expect(await authed.query(api.objectActions.get, { collectionId })).toEqual(
      {
        deaccession: { state: "blocked", reason: "on_loan" },
        remove: { state: "blocked", reason: "on_loan" },
      },
    );
    await expect(
      authed.mutation(
        api.deaccessions.create,
        request(organizationId, collectionId),
      ),
    ).rejects.toThrow(/on loan/);
    await expect(
      authed.mutation(api.collections.archiveCollection, {
        collectionId,
        reason: "Duplicate",
      }),
    ).rejects.toThrow(/on loan/);
  });

  test("an object held under an open entry is blocked as not yet accessioned", async () => {
    const { t, authed, organizationId, userId, collectionId } = await setup();
    await t.run(async (ctx) => {
      const locationId = await ctx.db.insert("locations", {
        organizationId,
        name: "Receiving room",
        type: "room",
        sortOrder: 0,
        isActive: true,
      });
      await ctx.db.insert("objectEntries", {
        organizationId,
        entryNumber: "E-2026-1",
        normalizedEntryNumber: "e-2026-1",
        collectionId,
        purpose: "identification",
        depositorName: "Walk-in visitor",
        receivedAt: 1,
        receivedBy: userId,
        receivedLocationId: locationId,
        conditionAtEntry: "Unknown",
        responsibleUserId: userId,
        status: "in_custody",
      });
    });

    expect(await authed.query(api.objectActions.get, { collectionId })).toEqual(
      {
        deaccession: { state: "blocked", reason: "not_accessioned" },
        remove: { state: "blocked", reason: "not_accessioned" },
      },
    );
    await expect(
      authed.mutation(
        api.deaccessions.create,
        request(organizationId, collectionId),
      ),
    ).rejects.toThrow(/not part of the collection/);
    await expect(
      authed.mutation(api.collections.archiveCollection, {
        collectionId,
        reason: "Duplicate",
      }),
    ).rejects.toThrow(/Record the exit/);
  });

  test("staff without access see neither", async () => {
    const { authed, organizationId, collectionId } = await setup([
      "collections.read",
    ]);

    expect(await authed.query(api.objectActions.get, { collectionId })).toEqual(
      {
        deaccession: { state: "hidden" },
        remove: { state: "hidden" },
      },
    );
    await expect(
      authed.mutation(
        api.deaccessions.create,
        request(organizationId, collectionId),
      ),
    ).rejects.toThrow();
    await expect(
      authed.mutation(api.collections.archiveCollection, {
        collectionId,
        reason: "Duplicate",
      }),
    ).rejects.toThrow();
  });

  test("an open Deaccession is reported in place of a new one", async () => {
    const { t, authed, organizationId, roleId, collectionId } = await setup();
    await t.run((ctx) =>
      ctx.db.insert("workflowConfigs", {
        organizationId,
        workflowType: "deaccession",
        steps: [{ stepNumber: 1, roleId, name: "Curator Review" }],
        canInitiateRoles: [roleId],
      }),
    );
    const deaccessionId = await authed.mutation(
      api.deaccessions.create,
      request(organizationId, collectionId),
    );

    expect(
      (await authed.query(api.objectActions.get, { collectionId }))
        ?.deaccession,
    ).toEqual({ state: "in_progress", deaccessionId });
    const refusal = await authed
      .mutation(api.deaccessions.create, request(organizationId, collectionId))
      .then(
        () => null,
        (error) => workflowApprovalErrorFromError(error)?.code,
      );
    expect(refusal).toBe("ALREADY_PENDING");
  });

  test("a withdrawn object offers neither", async () => {
    const { t, authed, collectionId } = await setup();
    await t.run((ctx) => ctx.db.patch(collectionId, { status: "archived" }));

    expect(await authed.query(api.objectActions.get, { collectionId })).toEqual(
      {
        deaccession: { state: "hidden" },
        remove: { state: "hidden" },
      },
    );
  });

  test("another organization's object is not answered", async () => {
    const { t, collectionId } = await setup();
    const outsider = await createOrgUserWithPermissions(t, initiator);

    expect(
      await authedForUser(t, outsider.userId).query(api.objectActions.get, {
        collectionId,
      }),
    ).toBeNull();
  });
});

test("a signed-out caller cannot record a regulatory approval", async () => {
  const t = createConvexTest();
  const { organizationId, collectionId } =
    await createOrgUserCollectionWithPermissions(t, ["collections.update"]);
  const deaccessionId = await t.run((ctx) =>
    ctx.db.insert("deaccessions", {
      organizationId,
      collectionId,
      deaccessionNumber: "DEA-1",
      dateDeaccessioned: Date.now(),
      reason: "Duplicate object",
      method: "sale",
      status: "pending",
      regulatoryApprovalRequired: true,
      regulatoryApprovalStatus: "requested",
      regulatoryApprovalToken: "regulatory-token",
    }),
  );

  await expect(
    t.mutation(anyApi.deaccessions?.recordRegulatoryApproval, {
      token: "regulatory-token",
      approved: true,
    }),
  ).rejects.toThrow();
  expect(
    (await t.run((ctx) => ctx.db.get(deaccessionId)))?.regulatoryApprovalStatus,
  ).toBe("requested");
});
