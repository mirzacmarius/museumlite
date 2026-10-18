import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { accessionReviewErrorFromError } from "../convex/utils/accessionReview";
import { capabilityUnavailableFromError } from "../convex/utils/capabilities";
import {
  COLLECTION_MANAGER_ROLE_NAME,
  LEGACY_REGISTRAR_ROLE_NAME,
} from "../convex/utils/systemRoles";
import { workflowApprovalErrorFromError } from "../convex/utils/workflowApprovalErrors";
import {
  authedForUser,
  type ConvexTest,
  createConvexTest,
} from "./testHarness";
import { workColumn } from "./workBoardHarness";

const REVIEWER_PERMISSIONS = [
  "collections.create",
  "collections.read",
  "collections.update",
  "collections.approve_accession",
  "media.read",
  "media.upload",
];

type MemberKey =
  | "administrator"
  | "collectionManager"
  | "curator"
  | "cataloger"
  | "reviewer";

/**
 * A museum created as staff create one, so its system roles and its default
 * accession workflow (Registrar Review for the Collection Manager, then
 * Curator Approval) are the real ones. `reviewer` holds a custom role with
 * the approver permission.
 */
async function createMuseum() {
  const t = createConvexTest();
  const ownerId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Museum Owner",
      email: `owner-${Math.random().toString(36).slice(2, 8)}@example.com`,
    }),
  );
  const organizationId = await authedForUser(t, ownerId).mutation(
    api.organizations.create,
    {
      name: "St. Magnus",
      slug: `st-magnus-${Math.random().toString(36).slice(2, 8)}`,
      type: "museum",
    },
  );
  const fixture = await t.run(async (ctx) => {
    const roles = await ctx.db
      .query("roles")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .collect();
    const systemRole = (name: string) => {
      const role = roles.find(
        (candidate) => candidate.name === name && candidate.isSystemRole,
      );
      if (!role) throw new Error(`System role ${name} missing`);
      return role._id;
    };
    const reviewerRoleId = await ctx.db.insert("roles", {
      organizationId,
      name: "Reviewer",
      isSystemRole: false,
    });
    for (const name of REVIEWER_PERMISSIONS) {
      const permission = (
        await ctx.db
          .query("permissions")
          .withIndex("by_category", (q) =>
            q.eq("category", name.split(".")[0] as "collections"),
          )
          .collect()
      ).find((candidate) => candidate.name === name);
      if (!permission) throw new Error(`Permission ${name} missing`);
      await ctx.db.insert("rolePermissions", {
        roleId: reviewerRoleId,
        permissionId: permission._id,
      });
    }
    const roleIds: Record<MemberKey, Id<"roles">> = {
      administrator: systemRole("admin"),
      collectionManager: systemRole(COLLECTION_MANAGER_ROLE_NAME),
      curator: systemRole("curator"),
      cataloger: systemRole("cataloger"),
      reviewer: reviewerRoleId,
    };
    const userIds = {} as Record<MemberKey, Id<"users">>;
    for (const [key, roleId] of Object.entries(roleIds) as Array<
      [MemberKey, Id<"roles">]
    >) {
      userIds[key] = await ctx.db.insert("users", {
        name: `${key} user`,
        email: `${key}-${Math.random().toString(36).slice(2, 8)}@example.com`,
      });
      await ctx.db.insert("userOrganizations", {
        userId: userIds[key],
        organizationId,
        roleId,
        joinedAt: Date.now(),
      });
    }
    return { roleIds, userIds };
  });
  const as = (member: MemberKey) => authedForUser(t, fixture.userIds[member]);

  /** An accession case recorded on the case form, as /accessions/new does. */
  async function createCase(by: MemberKey = "administrator") {
    return await as(by).mutation(api.accessions.create, {
      organizationId,
      dateReceived: Date.UTC(2025, 4, 2),
      source: "James Morrison Gallery",
      method: "bequest",
      notes: "Bequest from the Morrison estate",
    });
  }

  /** A case submitted for review and approved up to `step`. */
  async function caseAtStep(step: 1 | 2, by: MemberKey = "administrator") {
    const accessionId = await createCase(by);
    await as(by).mutation(api.accessions.submitForApproval, {
      accessionId,
    });
    if (step === 2) {
      await as("collectionManager").mutation(api.accessions.approve, {
        accessionId,
      });
    }
    expect(await workflowStepOf(t, accessionId)).toBe(step);
    return accessionId;
  }

  return { t, organizationId, ...fixture, as, createCase, caseAtStep };
}

async function workflowStepOf(t: ConvexTest, accessionId: Id<"accessions">) {
  return await t.run(async (ctx) => {
    const accession = await ctx.db.get(accessionId);
    return accession?.status === "pending" ? accession.workflowStep : null;
  });
}

async function statusOf(t: ConvexTest, accessionId: Id<"accessions">) {
  return await t.run(
    async (ctx) => (await ctx.db.get(accessionId))?.status ?? null,
  );
}

async function refusalOf(call: Promise<unknown>) {
  try {
    await call;
  } catch (error) {
    return (
      workflowApprovalErrorFromError(error)?.code ??
      accessionReviewErrorFromError(error)?.code ??
      capabilityUnavailableFromError(error)?.reason ??
      String(error)
    );
  }
  throw new Error("Expected the call to be rejected");
}

describe("accession rights of Administrators, Collection Managers and Curators", () => {
  test("Curators approve Registrar Review and Collection Managers approve Curator Approval", async () => {
    const museum = await createMuseum();
    const accessionId = await museum.caseAtStep(1);

    const asCurator = await museum
      .as("curator")
      .query(api.accessions.get, { accessionId });
    expect(asCurator?.canCurrentUserApprove).toBe(true);
    await museum.as("curator").mutation(api.accessions.approve, {
      accessionId,
    });
    expect(await workflowStepOf(museum.t, accessionId)).toBe(2);

    const asManager = await museum
      .as("collectionManager")
      .query(api.accessions.get, { accessionId });
    expect(asManager?.canCurrentUserApprove).toBe(true);
    await museum.as("collectionManager").mutation(api.accessions.approve, {
      accessionId,
    });
    expect(await statusOf(museum.t, accessionId)).toBe("approved");
  });

  test("Collection Managers and Curators return, withdraw and restore at any step", async () => {
    const museum = await createMuseum();

    // convex-test cannot run the submitter's notification beside the nested
    // history mutations once the submitter's role has many permissions, so
    // the reviewers decide on cases they submitted themselves.
    const atCuratorStep = await museum.caseAtStep(2, "collectionManager");
    await museum.as("collectionManager").mutation(api.accessions.reject, {
      accessionId: atCuratorStep,
      decision: "returnToDraft",
      reason: "Add the bequest letter",
    });
    expect(await workflowStepOf(museum.t, atCuratorStep)).toBe(0);

    const atManagerStep = await museum.caseAtStep(1, "curator");
    await museum.as("curator").mutation(api.accessions.reject, {
      accessionId: atManagerStep,
      decision: "withdraw",
      reason: "Duplicate of an earlier bequest",
    });
    expect(await statusOf(museum.t, atManagerStep)).toBe("withdrawn");
    const withdrawn = await museum
      .as("curator")
      .query(api.accessions.get, { accessionId: atManagerStep });
    expect(withdrawn?.canCurrentUserRestore).toBe(true);
    await museum.as("curator").mutation(api.accessions.restoreWithdrawn, {
      accessionId: atManagerStep,
      reason: "Not a duplicate after all",
    });
    expect(await workflowStepOf(museum.t, atManagerStep)).toBe(0);
  });

  test("Curators submit drafts for review and record accessions", async () => {
    const museum = await createMuseum();
    const { accessionId } = await museum
      .as("curator")
      .mutation(api.accessions.saveObjectDraft, {
        organizationId: museum.organizationId,
        saveMode: "submit",
        objectData: { title: "Small cool object" },
      });
    expect(await workflowStepOf(museum.t, accessionId)).toBe(1);

    const caseId = await museum.as("curator").mutation(api.accessions.create, {
      organizationId: museum.organizationId,
      dateReceived: Date.UTC(2025, 4, 2),
      source: "Field collection",
      method: "gift",
    });
    expect(await workflowStepOf(museum.t, caseId)).toBe(0);
  });

  test("the legacy registrar role keeps the Collection Manager's rights", async () => {
    const museum = await createMuseum();
    await museum.t.run((ctx) =>
      ctx.db.patch(museum.roleIds.collectionManager, {
        name: LEGACY_REGISTRAR_ROLE_NAME,
      }),
    );
    const accessionId = await museum.caseAtStep(2);
    await museum.as("collectionManager").mutation(api.accessions.approve, {
      accessionId,
    });
    expect(await statusOf(museum.t, accessionId)).toBe("approved");
  });

  test("the Work board lists accessions at every step for Collection Managers and Curators", async () => {
    const museum = await createMuseum();
    await museum.caseAtStep(1);
    await museum.caseAtStep(2);

    const accessionApprovals = async (member: MemberKey) =>
      (await workColumn(museum.as(member), museum.organizationId, "approvals"))
        ?.byType.accession ?? 0;
    expect(await accessionApprovals("collectionManager")).toBe(2);
    expect(await accessionApprovals("curator")).toBe(2);
    expect(await accessionApprovals("reviewer")).toBe(0);
  });

  test("workflow steps name their roles as Role Management does", async () => {
    const museum = await createMuseum();
    await museum.t.run((ctx) =>
      ctx.db.patch(museum.roleIds.collectionManager, {
        name: LEGACY_REGISTRAR_ROLE_NAME,
      }),
    );
    const { steps } = await museum
      .as("collectionManager")
      .query(api.accessions.getWorkflowSteps, {
        organizationId: museum.organizationId,
      });
    expect(
      steps.map((step) => [
        step.name,
        "roleName" in step ? step.roleName : undefined,
      ]),
    ).toEqual([
      ["Draft", undefined],
      ["Registrar Review", "Collection Manager"],
      ["Curator Approval", "Curator"],
      ["Approved", undefined],
    ]);
  });
});

describe("accession rights stay with workflow roles for everyone else", () => {
  test("a custom approver role acts only on the steps assigned to it", async () => {
    const museum = await createMuseum();
    const atManagerStep = await museum.caseAtStep(1);
    expect(
      await refusalOf(
        museum.as("reviewer").mutation(api.accessions.approve, {
          accessionId: atManagerStep,
        }),
      ),
    ).toBe("APPROVAL_NOT_PERMITTED");
    expect(
      await refusalOf(
        museum.as("reviewer").mutation(api.accessions.reject, {
          accessionId: atManagerStep,
          decision: "withdraw",
          reason: "Not mine to decide",
        }),
      ),
    ).toBe("NOT_PERMITTED");
    const asReviewer = await museum
      .as("reviewer")
      .query(api.accessions.get, { accessionId: atManagerStep });
    expect(asReviewer?.canCurrentUserApprove).toBe(false);

    // Assigned to a step, the custom role decides it, and so do the reviewer
    // system roles.
    await museum.t.run(async (ctx) => {
      const config = await ctx.db
        .query("workflowConfigs")
        .withIndex("by_organization_and_workflowType", (q) =>
          q
            .eq("organizationId", museum.organizationId)
            .eq("workflowType", "accession"),
        )
        .unique();
      if (!config) throw new Error("Accession workflow missing");
      await ctx.db.patch(config._id, {
        steps: config.steps.map((step) =>
          step.stepNumber === 2
            ? { ...step, roleId: museum.roleIds.reviewer }
            : step,
        ),
      });
    });
    const first = await museum.caseAtStep(2);
    await museum.as("reviewer").mutation(api.accessions.approve, {
      accessionId: first,
    });
    expect(await statusOf(museum.t, first)).toBe("approved");
    const second = await museum.caseAtStep(2);
    await museum.as("curator").mutation(api.accessions.approve, {
      accessionId: second,
    });
    expect(await statusOf(museum.t, second)).toBe("approved");
  });

  test("Catalogers can neither approve nor start review", async () => {
    const museum = await createMuseum();
    const accessionId = await museum.caseAtStep(1);
    expect(
      await refusalOf(
        museum.as("cataloger").mutation(api.accessions.approve, {
          accessionId,
        }),
      ),
    ).not.toBe(null);
    expect(await workflowStepOf(museum.t, accessionId)).toBe(1);
    expect(
      await refusalOf(
        museum.as("cataloger").mutation(api.accessions.saveObjectDraft, {
          organizationId: museum.organizationId,
          saveMode: "submit",
          objectData: { title: "Cataloger's object" },
        }),
      ),
    ).toBe("permission_missing");
  });

  test("only staff who may start review submit a draft recorded on the accession form", async () => {
    const museum = await createMuseum();
    const accessionId = await museum.createCase();
    const canSubmit = async (member: MemberKey) =>
      (await museum.as(member).query(api.accessions.get, { accessionId }))
        ?.canCurrentUserSubmit;

    expect(await canSubmit("cataloger")).toBe(false);
    expect(await canSubmit("reviewer")).toBe(false);
    expect(await canSubmit("curator")).toBe(true);
    expect(await canSubmit("collectionManager")).toBe(true);
    expect(
      await refusalOf(
        museum.as("cataloger").mutation(api.accessions.submitForApproval, {
          accessionId,
        }),
      ),
    ).toBe("permission_missing");
    expect(await workflowStepOf(museum.t, accessionId)).toBe(0);

    await museum.as("curator").mutation(api.accessions.submitForApproval, {
      accessionId,
    });
    expect(await workflowStepOf(museum.t, accessionId)).toBe(1);
    expect(await canSubmit("curator")).toBe(false);

    const second = await museum.createCase();
    await museum
      .as("collectionManager")
      .mutation(api.accessions.submitForApproval, { accessionId: second });
    expect(await workflowStepOf(museum.t, second)).toBe(1);
  });

  test("Curators still do not decide image deletions", async () => {
    const museum = await createMuseum();
    const canDecide = async (member: MemberKey) =>
      (
        await museum.as(member).query(api.mediaDeletions.listPending, {
          organizationId: museum.organizationId,
        })
      ).canDecide;
    expect(await canDecide("collectionManager")).toBe(true);
    expect(await canDecide("curator")).toBe(false);
  });
});

describe("describing the object of an accession case", () => {
  test("keeps the case's source and notes, then publishes the described object", async () => {
    const museum = await createMuseum();
    const accessionId = await museum.createCase();
    const curator = museum.as("curator");

    const saved = await curator.mutation(api.accessions.saveObjectDraft, {
      organizationId: museum.organizationId,
      accessionId,
      saveMode: "draft",
      objectData: {
        title: "Portrait of a lady",
        creator: "Unknown artist",
        description: "Oil on canvas in a gilt frame",
      },
    });
    await curator.mutation(api.accessions.saveObjectDraft, {
      organizationId: museum.organizationId,
      accessionId,
      saveMode: "submit",
      expectedEditVersion: saved.editVersion,
      objectData: {
        title: "Portrait of a lady",
        creator: "Circle of Raeburn",
        description: "Oil on canvas in a gilt frame",
      },
    });

    const submitted = await curator.query(api.accessions.get, { accessionId });
    expect(submitted?.source).toBe("James Morrison Gallery");
    expect(submitted?.notes).toBe("Bequest from the Morrison estate");
    expect(submitted?.workflowStep).toBe(1);

    await curator.mutation(api.accessions.approve, { accessionId });
    await museum
      .as("collectionManager")
      .mutation(api.accessions.approve, { accessionId });
    const object = await museum.t.run(async (ctx) => {
      const accession = await ctx.db.get(accessionId);
      return accession?.collectionId
        ? await ctx.db.get(accession.collectionId)
        : null;
    });
    expect(object?.title).toBe("Portrait of a lady");
  });

  test("a source and notes that match the object are still never overwritten", async () => {
    const museum = await createMuseum();
    const accessionId = await museum
      .as("administrator")
      .mutation(api.accessions.create, {
        organizationId: museum.organizationId,
        dateReceived: Date.UTC(2025, 1, 1),
        source: "Anna Berg",
        method: "gift",
        notes: "Self-portrait",
      });
    const curator = museum.as("curator");
    const saved = await curator.mutation(api.accessions.saveObjectDraft, {
      organizationId: museum.organizationId,
      accessionId,
      saveMode: "draft",
      objectData: {
        title: "Self-portrait",
        creator: "Anna Berg",
        description: "Self-portrait",
      },
    });
    await curator.mutation(api.accessions.saveObjectDraft, {
      organizationId: museum.organizationId,
      accessionId,
      saveMode: "draft",
      expectedEditVersion: saved.editVersion,
      objectData: {
        title: "Self-portrait",
        creator: "",
        description: "Oil on board",
      },
    });

    const accession = await curator.query(api.accessions.get, {
      accessionId,
    });
    expect(accession?.startedInObjectForm).toBe(false);
    expect(accession?.source).toBe("Anna Berg");
    expect(accession?.notes).toBe("Self-portrait");
  });

  test.each([
    ["draft", "Saved object draft"],
    ["submit", "Submitted object request"],
  ] as const)("an object-form %s records the creation comment that marks it", async (saveMode, comment) => {
    // Stored accessions are recognized by these exact words, so they must
    // never change.
    const museum = await createMuseum();
    const { accessionId } = await museum
      .as("collectionManager")
      .mutation(api.accessions.saveObjectDraft, {
        organizationId: museum.organizationId,
        saveMode,
        objectData: { title: "Carved spoon" },
      });
    const creation = await museum.t.run(
      async (ctx) => (await ctx.db.get(accessionId))?.workflowHistory?.[0],
    );
    expect(creation).toMatchObject({ step: 0, comment });
  });

  test("an intake-form draft's source still follows its object", async () => {
    const museum = await createMuseum();
    const manager = museum.as("collectionManager");
    const { accessionId } = await manager.mutation(
      api.accessions.saveObjectDraft,
      {
        organizationId: museum.organizationId,
        saveMode: "draft",
        objectData: { title: "Carved spoon", creator: "Ann Smith" },
      },
    );
    await manager.mutation(api.accessions.saveObjectDraft, {
      organizationId: museum.organizationId,
      accessionId,
      saveMode: "draft",
      objectData: {
        title: "Carved spoon",
        creator: "Bob Jones",
        description: "Birch, with a twisted handle",
      },
    });
    const draft = await manager.query(api.accessions.get, { accessionId });
    expect(draft?.startedInObjectForm).toBe(true);
    expect(draft?.source).toBe("Bob Jones");
    expect(draft?.notes).toBe("Birch, with a twisted handle");
  });
});
