import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import {
  authedForUser,
  createConvexTest,
  createOrgUserWithPermissions,
} from "./testHarness";

test("organization administrators can start workflows outside the configured initiator roles", async () => {
  const t = createConvexTest();
  const setup = await createOrgUserWithPermissions(t, [
    "collections.read",
    "collections.create",
    "collections.delete",
    "collections.update",
    "organization.manage_settings",
  ]);
  const otherRole = await t.run((ctx) =>
    ctx.db.insert("roles", {
      organizationId: setup.organizationId,
      name: "curator",
      isSystemRole: false,
    }),
  );
  await t.run(async (ctx) => {
    for (const workflowType of ["accession", "deaccession"] as const) {
      await ctx.db.insert("workflowConfigs", {
        organizationId: setup.organizationId,
        workflowType,
        steps: [{ stepNumber: 1, roleId: otherRole, name: "Review" }],
        canInitiateRoles: [otherRole],
      });
    }
  });
  const user = authedForUser(t, setup.userId);

  const accessionId = await user.mutation(api.accessions.create, {
    organizationId: setup.organizationId,
    accessionNumber: "ADMIN-START-1",
    dateReceived: Date.now(),
    source: "Donor",
    method: "gift",
  });
  await user.mutation(api.accessions.submitForApproval, { accessionId });
  const collectionId = await user.mutation(api.collections.create, {
    organizationId: setup.organizationId,
    accessionNumber: "ADMIN-START-OBJ",
    title: "Duplicate print",
  });
  const deaccession = await user.mutation(api.deaccessions.create, {
    organizationId: setup.organizationId,
    collectionId,
    dateDeaccessioned: Date.now(),
    reason: "Duplicate",
    method: "transfer",
    disposition: "Regional museum",
  });

  expect(deaccession).toBeTruthy();
});

test("members outside the initiator roles without administrator rights still cannot start a workflow", async () => {
  const t = createConvexTest();
  const setup = await createOrgUserWithPermissions(t, [
    "collections.read",
    "collections.create",
    "collections.delete",
  ]);
  const otherRole = await t.run((ctx) =>
    ctx.db.insert("roles", {
      organizationId: setup.organizationId,
      name: "curator",
      isSystemRole: false,
    }),
  );
  await t.run((ctx) =>
    ctx.db.insert("workflowConfigs", {
      organizationId: setup.organizationId,
      workflowType: "deaccession",
      steps: [{ stepNumber: 1, roleId: otherRole, name: "Review" }],
      canInitiateRoles: [otherRole],
    }),
  );
  const user = authedForUser(t, setup.userId);
  const collectionId = await user.mutation(api.collections.create, {
    organizationId: setup.organizationId,
    accessionNumber: "MEMBER-OBJ",
    title: "Print",
  });

  await expect(
    user.mutation(api.deaccessions.create, {
      organizationId: setup.organizationId,
      collectionId,
      dateDeaccessioned: Date.now(),
      reason: "Duplicate",
      method: "transfer",
      disposition: "Regional museum",
    }),
  ).rejects.toThrow(/cannot initiate deaccession workflow/);
});
