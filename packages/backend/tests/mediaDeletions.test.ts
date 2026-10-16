import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { capabilityUnavailableFromError } from "../convex/utils/capabilities";
import {
  type ImageDeletionErrorCode,
  imageDeletionErrorFromError,
} from "../convex/utils/imageDeletionErrors";
import { workflowApprovalErrorFromError } from "../convex/utils/workflowApprovalErrors";
import {
  authedForUser,
  createConvexTest,
  useSequentialScheduledJobs,
} from "./testHarness";

let restoreTimers = () => {};
beforeEach(() => {
  restoreTimers = useSequentialScheduledJobs();
  vi.spyOn(globalThis, "fetch").mockRejectedValue(
    new Error("no network in tests"),
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  restoreTimers();
});

const ROLE_PERMISSIONS = {
  administrator: [
    "organization.manage_settings",
    "collections.read",
    "collections.approve_accession",
    "media.read",
    "media.upload",
    "media.delete",
  ],
  collectionManager: [
    "collections.read",
    "collections.approve_accession",
    "media.read",
    "media.upload",
  ],
  curator: [
    "collections.read",
    "collections.approve_accession",
    "media.read",
    "media.upload",
    "media.delete",
  ],
  cataloger: ["collections.read", "media.read", "media.upload", "media.delete"],
  viewer: ["collections.read", "media.read"],
} as const;

type RoleKey = keyof typeof ROLE_PERMISSIONS;

async function photo(width: number) {
  return await sharp({
    create: { width, height: width / 2, channels: 3, background: "#336699" },
  })
    .jpeg()
    .toBuffer();
}

/**
 * A museum whose accession workflow sends step 1 to the Collection Manager and
 * step 2 to the Curator, as new organizations get by default.
 */
async function createMuseum({
  approvalWorkflow,
}: {
  approvalWorkflow: boolean;
}) {
  const t = createConvexTest();
  const fixture = await t.run(async ({ db }) => {
    const organizationId = await db.insert("organizations", {
      name: "Deletion Museum",
      slug: `deletion-museum-${Math.random().toString(36).slice(2, 8)}`,
      type: "museum",
      settings: {
        accessionWorkflowEnabled: approvalWorkflow,
        portalSettings: { isEnabled: true, portalSlug: "gallery" },
      },
    });
    const permissionIds = new Map<string, Id<"permissions">>();
    for (const names of Object.values(ROLE_PERMISSIONS)) {
      for (const name of names) {
        if (permissionIds.has(name)) continue;
        permissionIds.set(
          name,
          await db.insert("permissions", {
            name,
            category: name.split(".")[0] ?? "collections",
          }),
        );
      }
    }
    const users = {} as Record<RoleKey, Id<"users">>;
    const roles = {} as Record<RoleKey, Id<"roles">>;
    for (const [key, names] of Object.entries(ROLE_PERMISSIONS) as Array<
      [RoleKey, readonly string[]]
    >) {
      roles[key] = await db.insert("roles", {
        organizationId,
        name: key,
        isSystemRole: false,
      });
      for (const name of names) {
        const permissionId = permissionIds.get(name);
        if (permissionId) {
          await db.insert("rolePermissions", {
            roleId: roles[key],
            permissionId,
          });
        }
      }
      users[key] = await db.insert("users", {
        name: `${key} user`,
        email: `${key}-${Math.random().toString(36).slice(2, 8)}@example.com`,
      });
      await db.insert("userOrganizations", {
        userId: users[key],
        organizationId,
        roleId: roles[key],
        joinedAt: Date.now(),
      });
    }
    await db.insert("workflowConfigs", {
      organizationId,
      workflowType: "accession",
      steps: [
        { stepNumber: 1, roleId: roles.collectionManager, name: "Registrar" },
        { stepNumber: 2, roleId: roles.curator, name: "Curator" },
      ],
      canInitiateRoles: [roles.administrator],
    });
    const collectionId = await db.insert("collections", {
      organizationId,
      accessionNumber: "DEL-1",
      title: "Painted chest",
      status: "active",
      catalogedBy: users.cataloger,
      catalogedAt: Date.now(),
      isPubliclyVisible: true,
    });
    await db.patch(organizationId, { slug: "deletion-museum" });
    return { organizationId, collectionId, users };
  });
  const as = (role: RoleKey) => authedForUser(t, fixture.users[role]);
  const cataloger = as("cataloger");

  async function upload(
    fileName: string,
    options: {
      isPrimary?: boolean;
      mediaCategory?: "image" | "document";
      mimeType?: string;
    } = {},
  ) {
    const mimeType = options.mimeType ?? "image/jpeg";
    const bytes =
      mimeType === "image/jpeg"
        ? new Uint8Array(await photo(64))
        : new TextEncoder().encode("%PDF-1.4 condition report");
    const { uploadUrl } = await cataloger.mutation(
      api.media.generateUploadUrl,
      {
        organizationId: fixture.organizationId,
        collectionId: fixture.collectionId,
        fileName,
        fileSize: bytes.length,
        mimeType,
      },
    );
    const url = new URL(uploadUrl);
    const response = await t.fetch(url.pathname + url.search, {
      method: "POST",
      body: new Blob([bytes], { type: mimeType }),
    });
    const { storageId }: { storageId: Id<"_storage"> } = await response.json();
    return await cataloger.mutation(api.media.create, {
      organizationId: fixture.organizationId,
      collectionId: fixture.collectionId,
      storageId,
      fileName,
      fileSize: bytes.length,
      mimeType,
      isPrimary: options.isPrimary,
      mediaCategory: options.mediaCategory,
    });
  }

  const drain = () =>
    t.finishAllScheduledFunctions(() => vi.advanceTimersToNextTimer());

  return {
    t,
    ...fixture,
    as,
    upload,
    drain,
    media: () =>
      cataloger.query(api.media.list, { collectionId: fixture.collectionId }),
    portalImages: async () =>
      (
        await t.query(api.collections.getPublic, {
          organizationSlug: "deletion-museum",
          portalSlug: "gallery",
          accessionNumber: "DEL-1",
        })
      )?.images ?? [],
    pendingApprovals: async (role: RoleKey) =>
      (
        await as(role).query(api.assignments.listMyAssignments, {
          organizationId: fixture.organizationId,
        })
      ).stats.pendingApprovalsByType.imageDeletion,
  };
}

type Museum = Awaited<ReturnType<typeof createMuseum>>;

async function refusalOf(call: Promise<unknown>) {
  try {
    await call;
  } catch (error) {
    return {
      deletion: imageDeletionErrorFromError(error)?.code ?? null,
      approval: workflowApprovalErrorFromError(error)?.code ?? null,
      capability: capabilityUnavailableFromError(error)?.reason ?? null,
    };
  }
  throw new Error("Expected the call to be rejected");
}

async function deletionRefusal(call: Promise<unknown>) {
  return (await refusalOf(call)).deletion as ImageDeletionErrorCode | null;
}

/** Every blob the image and its derivatives occupy, with their ownership rows. */
async function storedFilesOf(museum: Museum, mediaId: Id<"mediaFiles">) {
  return await museum.t.run(async (ctx) => {
    const media = await ctx.db.get(mediaId);
    if (!media) return null;
    const versions = await ctx.db
      .query("mediaVersions")
      .withIndex("by_original_media", (q) => q.eq("originalMediaId", mediaId))
      .collect();
    return [
      media.storageId,
      ...(media.thumbnailStorageId ? [media.thumbnailStorageId] : []),
      ...(media.publicRendition?.status === "ready"
        ? [media.publicRendition.renditionStorageId]
        : []),
      ...versions.map((version) => version.storageId),
    ];
  });
}

async function storageState(museum: Museum, storageIds: Id<"_storage">[]) {
  return await museum.t.run(async (ctx) =>
    Promise.all(
      storageIds.map(async (storageId) => ({
        blob: (await ctx.storage.get(storageId)) !== null,
        ownership:
          (await ctx.db
            .query("storageOwnership")
            .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
            .unique()) !== null,
      })),
    ),
  );
}

async function addVersion(museum: Museum, mediaId: Id<"mediaFiles">) {
  const editor = museum.as("cataloger");
  const bytes = new Uint8Array(await photo(48));
  const { uploadUrl } = await editor.mutation(api.media.generateUploadUrl, {
    organizationId: museum.organizationId,
    collectionId: museum.collectionId,
    fileName: "edited.jpg",
    fileSize: bytes.length,
    mimeType: "image/jpeg",
  });
  const url = new URL(uploadUrl);
  const response = await museum.t.fetch(url.pathname + url.search, {
    method: "POST",
    body: new Blob([bytes], { type: "image/jpeg" }),
  });
  const { storageId }: { storageId: Id<"_storage"> } = await response.json();
  const versionId = await editor.mutation(api.mediaVersions.createVersion, {
    mediaId,
    storageId,
    editType: "rotate",
  });
  await editor.mutation(api.mediaEdits.trackEdit, {
    mediaId,
    versionId,
    operation: "rotate",
    parameters: { degrees: 90 },
  });
}

describe("with the accessions approval workflow off", () => {
  test("deleting an image removes its files, versions and portal rendition and promotes the next image", async () => {
    const museum = await createMuseum({ approvalWorkflow: false });
    const front = await museum.upload("front.jpg", { isPrimary: true });
    const back = await museum.upload("back.jpg", { isPrimary: false });
    await museum.drain();
    await addVersion(museum, front);
    await museum.drain();
    expect((await museum.portalImages()).length).toBe(2);
    const frontFiles = await storedFilesOf(museum, front);
    expect(frontFiles?.length).toBe(3);
    const usageBefore = await museum.t.run((ctx) =>
      ctx.db
        .query("organizationUsageCounters")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", museum.organizationId),
        )
        .unique(),
    );

    await museum
      .as("cataloger")
      .mutation(api.mediaDeletions.deleteImage, { mediaId: front });
    await museum.drain();

    const remaining = await museum.media();
    expect(remaining.map((file) => [file.fileName, file.isPrimary])).toEqual([
      ["back.jpg", true],
    ]);
    expect(await storageState(museum, frontFiles ?? [])).toEqual(
      (frontFiles ?? []).map(() => ({ blob: false, ownership: false })),
    );
    const portal = await museum.portalImages();
    expect(portal.map((image) => [image._id, image.isPrimary])).toEqual([
      [back, true],
    ]);
    const leftovers = await museum.t.run(async (ctx) => ({
      versions: await ctx.db
        .query("mediaVersions")
        .withIndex("by_original_media", (q) => q.eq("originalMediaId", front))
        .collect(),
      edits: await ctx.db
        .query("mediaEditHistory")
        .withIndex("by_media", (q) => q.eq("mediaId", front))
        .collect(),
      usage: await ctx.db
        .query("organizationUsageCounters")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", museum.organizationId),
        )
        .unique(),
      audit: await ctx.db
        .query("auditLog")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", museum.organizationId),
        )
        .collect(),
    }));
    expect(leftovers.versions).toEqual([]);
    expect(leftovers.edits).toEqual([]);
    expect(leftovers.usage?.mediaFileCount).toBe(
      (usageBefore?.mediaFileCount ?? 0) - 1,
    );
    expect(leftovers.usage?.mediaVersionCount).toBe(
      (usageBefore?.mediaVersionCount ?? 0) - 1,
    );
    expect(leftovers.usage?.storageBytes).toBeLessThan(
      usageBefore?.storageBytes ?? 0,
    );
    expect(
      leftovers.audit.flatMap((entry) =>
        entry.action === "deleted_media"
          ? [[entry.entityId, entry.userId]]
          : [],
      ),
    ).toEqual([[front, museum.users.cataloger]]);
  });

  test("asking for approval is refused because deletion needs none", async () => {
    const museum = await createMuseum({ approvalWorkflow: false });
    const mediaId = await museum.upload("front.jpg");
    expect(
      await deletionRefusal(
        museum
          .as("cataloger")
          .mutation(api.mediaDeletions.requestImageDeletion, { mediaId }),
      ),
    ).toBe("APPROVAL_SETTING_CHANGED");
    expect((await museum.media()).map((file) => file._id)).toEqual([mediaId]);
  });

  test("staff without media delete permission cannot delete an image", async () => {
    const museum = await createMuseum({ approvalWorkflow: false });
    const mediaId = await museum.upload("front.jpg");
    for (const role of ["viewer", "collectionManager"] as const) {
      expect(
        (
          await refusalOf(
            museum
              .as(role)
              .mutation(api.mediaDeletions.deleteImage, { mediaId }),
          )
        ).capability,
      ).toBe("permission_missing");
    }
    expect((await museum.media()).map((file) => file._id)).toEqual([mediaId]);
  });

  test("documents filed with the object stay permanent", async () => {
    const museum = await createMuseum({ approvalWorkflow: false });
    const mediaId = await museum.upload("report.pdf", {
      mimeType: "application/pdf",
      mediaCategory: "document",
    });
    expect(
      await deletionRefusal(
        museum.as("cataloger").mutation(api.mediaDeletions.deleteImage, {
          mediaId,
        }),
      ),
    ).toBe("NOT_AN_IMAGE");
    expect((await museum.media()).map((file) => file._id)).toEqual([mediaId]);
  });

  test("an image cited by a condition assessment or a case task stays", async () => {
    const museum = await createMuseum({ approvalWorkflow: false });
    const assessed = await museum.upload("assessed.jpg");
    const cited = await museum.upload("cited.jpg");
    await museum.t.run(async (ctx) => {
      const assessedMedia = await ctx.db.get(assessed);
      if (!assessedMedia) throw new Error("missing media");
      await ctx.db.insert("conditionAssessments", {
        organizationId: museum.organizationId,
        collectionId: museum.collectionId,
        assessedBy: museum.users.curator,
        assessedAt: 1,
        recordedAt: 1,
        condition: "fair",
        summary: "Scratch on lid",
        observations: [],
        photos: [
          {
            mediaId: assessed,
            storageId: assessedMedia.storageId,
            fileName: assessedMedia.fileName,
          },
        ],
        status: "accepted",
      });
      const taskId = await ctx.db.insert("caseTasks", {
        organizationId: museum.organizationId,
        caseType: "accession",
        caseId: "case-1",
        title: "Photograph object",
        ownerId: museum.users.cataloger,
        queueDueAt: Number.MAX_SAFE_INTEGER,
        status: "done",
        open: false,
        dependsOnTaskIds: [],
        createdBy: museum.users.cataloger,
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("caseTaskEvidence", {
        organizationId: museum.organizationId,
        taskId,
        reference: { kind: "media", id: cited },
        label: "cited.jpg",
        linkedBy: museum.users.cataloger,
        linkedAt: 1,
      });
    });
    for (const mediaId of [assessed, cited]) {
      expect(
        await deletionRefusal(
          museum.as("cataloger").mutation(api.mediaDeletions.deleteImage, {
            mediaId,
          }),
        ),
      ).toBe("IMAGE_CITED_AS_EVIDENCE");
    }
    expect((await museum.media()).length).toBe(2);
  });

  test("a published intake no longer lists the deleted image among its draft files", async () => {
    const museum = await createMuseum({ approvalWorkflow: false });
    const mediaId = await museum.upload("intake.jpg");
    const accessionId = await museum.t.run(async (ctx) => {
      const media = await ctx.db.get(mediaId);
      if (!media) throw new Error("missing media");
      return await ctx.db.insert("accessions", {
        organizationId: museum.organizationId,
        collectionId: museum.collectionId,
        accessionNumber: "DEL-1",
        dateReceived: 1,
        source: "Donor",
        method: "gift",
        status: "approved",
        draftMedia: [
          {
            storageId: media.storageId,
            fileName: media.fileName,
            fileSize: media.fileSize,
            mimeType: media.mimeType,
            mediaCategory: "image",
            isPrimary: true,
          },
        ],
      });
    });
    await museum
      .as("cataloger")
      .mutation(api.mediaDeletions.deleteImage, { mediaId });
    const accession = await museum.t.run((ctx) => ctx.db.get(accessionId));
    expect(accession?.draftMedia).toEqual([]);
  });
});

describe("with the accessions approval workflow on", () => {
  async function requestDeletion(museum: Museum, mediaId: Id<"mediaFiles">) {
    return await museum
      .as("cataloger")
      .mutation(api.mediaDeletions.requestImageDeletion, { mediaId });
  }

  test("deleting asks for approval and keeps the image, marked as waiting", async () => {
    const museum = await createMuseum({ approvalWorkflow: true });
    const mediaId = await museum.upload("front.jpg");
    expect(
      await deletionRefusal(
        museum.as("cataloger").mutation(api.mediaDeletions.deleteImage, {
          mediaId,
        }),
      ),
    ).toBe("APPROVAL_SETTING_CHANGED");

    await requestDeletion(museum, mediaId);

    expect((await museum.media()).map((file) => file._id)).toEqual([mediaId]);
    const cataloger = museum.as("cataloger");
    expect(
      await cataloger.query(api.mediaDeletions.listPendingForObject, {
        collectionId: museum.collectionId,
      }),
    ).toEqual([mediaId]);
    expect(
      (await cataloger.query(api.mediaDeletions.getDeletionState, { mediaId }))
        ?.pendingRequestedAt,
    ).toEqual(expect.any(Number));
    expect(await deletionRefusal(requestDeletion(museum, mediaId))).toBe(
      "DELETION_ALREADY_PENDING",
    );
  });

  test("only the first step's approver and administrators see and decide the request", async () => {
    const museum = await createMuseum({ approvalWorkflow: true });
    const mediaId = await museum.upload("front.jpg");
    const requestId = await requestDeletion(museum, mediaId);

    expect(await museum.pendingApprovals("collectionManager")).toBe(1);
    expect(await museum.pendingApprovals("administrator")).toBe(1);
    expect(await museum.pendingApprovals("curator")).toBe(0);
    expect(await museum.pendingApprovals("cataloger")).toBe(0);
    const curatorRefusal = await refusalOf(
      museum.as("curator").mutation(api.mediaDeletions.approve, { requestId }),
    );
    expect(curatorRefusal.approval).toBe("APPROVAL_NOT_PERMITTED");
    const catalogerRefusal = await refusalOf(
      museum.as("cataloger").mutation(api.mediaDeletions.reject, { requestId }),
    );
    expect(catalogerRefusal.capability).toBe("permission_missing");
    expect(
      (
        await museum.as("curator").query(api.mediaDeletions.listPending, {
          organizationId: museum.organizationId,
        })
      ).canDecide,
    ).toBe(false);
    const managerView = await museum
      .as("collectionManager")
      .query(api.mediaDeletions.listPending, {
        organizationId: museum.organizationId,
      });
    expect(managerView.canDecide).toBe(true);
    expect(
      managerView.requests.map((request) => [
        request._id,
        request.fileName,
        request.objectTitle,
        request.requestedByName,
      ]),
    ).toEqual([[requestId, "front.jpg", "Painted chest", "cataloger user"]]);
  });

  test("approving deletes the image and clears the pending approval", async () => {
    const museum = await createMuseum({ approvalWorkflow: true });
    const mediaId = await museum.upload("front.jpg");
    await museum.drain();
    const files = await storedFilesOf(museum, mediaId);
    const requestId = await requestDeletion(museum, mediaId);

    await museum
      .as("collectionManager")
      .mutation(api.mediaDeletions.approve, { requestId });
    await museum.drain();

    expect(await museum.media()).toEqual([]);
    expect(await museum.portalImages()).toEqual([]);
    expect(await storageState(museum, files ?? [])).toEqual(
      (files ?? []).map(() => ({ blob: false, ownership: false })),
    );
    expect(await museum.pendingApprovals("collectionManager")).toBe(0);
    const request = await museum.t.run((ctx) => ctx.db.get(requestId));
    expect([request?.status, request?.decidedBy]).toEqual([
      "approved",
      museum.users.collectionManager,
    ]);
    expect(
      await deletionRefusal(
        museum
          .as("collectionManager")
          .mutation(api.mediaDeletions.reject, { requestId }),
      ),
    ).toBe("DELETION_REQUEST_CLOSED");
    expect(await deletionRefusal(requestDeletion(museum, mediaId))).toBe(
      "IMAGE_NOT_FOUND",
    );
  });

  test("an administrator off the workflow step may approve", async () => {
    const museum = await createMuseum({ approvalWorkflow: true });
    const mediaId = await museum.upload("front.jpg");
    const requestId = await requestDeletion(museum, mediaId);
    await museum
      .as("administrator")
      .mutation(api.mediaDeletions.approve, { requestId });
    expect(await museum.media()).toEqual([]);
  });

  test("without a configured accession workflow, only administrators and collection managers decide", async () => {
    const museum = await createMuseum({ approvalWorkflow: true });
    await museum.t.run(async (ctx) => {
      const config = await ctx.db
        .query("workflowConfigs")
        .withIndex("by_organization_and_workflowType", (q) =>
          q
            .eq("organizationId", museum.organizationId)
            .eq("workflowType", "accession"),
        )
        .unique();
      if (config) await ctx.db.delete(config._id);
      const membership = await ctx.db
        .query("userOrganizations")
        .withIndex("by_user_and_organization", (q) =>
          q
            .eq("userId", museum.users.collectionManager)
            .eq("organizationId", museum.organizationId),
        )
        .unique();
      if (membership) {
        await ctx.db.patch(membership.roleId, {
          name: "Collection Manager",
          isSystemRole: true,
        });
      }
    });
    const front = await museum.upload("front.jpg");
    const back = await museum.upload("back.jpg");
    const frontRequest = await requestDeletion(museum, front);
    const backRequest = await requestDeletion(museum, back);

    expect(
      (
        await refusalOf(
          museum
            .as("curator")
            .mutation(api.mediaDeletions.approve, { requestId: frontRequest }),
        )
      ).approval,
    ).toBe("APPROVAL_NOT_PERMITTED");
    expect(await museum.pendingApprovals("curator")).toBe(0);
    expect(await museum.pendingApprovals("collectionManager")).toBe(2);
    await museum
      .as("collectionManager")
      .mutation(api.mediaDeletions.approve, { requestId: frontRequest });
    await museum
      .as("administrator")
      .mutation(api.mediaDeletions.reject, { requestId: backRequest });
    expect((await museum.media()).map((file) => file._id)).toEqual([back]);
  });

  test("staff who cannot see media get no pending badges instead of an error", async () => {
    const museum = await createMuseum({ approvalWorkflow: true });
    const mediaId = await museum.upload("front.jpg");
    await requestDeletion(museum, mediaId);
    const outsiderId = await museum.t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { name: "No media" });
      const roleId = await ctx.db.insert("roles", {
        organizationId: museum.organizationId,
        name: "No media",
        isSystemRole: false,
      });
      await ctx.db.insert("userOrganizations", {
        userId,
        organizationId: museum.organizationId,
        roleId,
        joinedAt: Date.now(),
      });
      return userId;
    });
    expect(
      await authedForUser(museum.t, outsiderId).query(
        api.mediaDeletions.listPendingForObject,
        { collectionId: museum.collectionId },
      ),
    ).toEqual([]);
  });

  test("rejecting keeps the image and lets staff ask again later", async () => {
    const museum = await createMuseum({ approvalWorkflow: true });
    const mediaId = await museum.upload("front.jpg");
    const requestId = await requestDeletion(museum, mediaId);

    await museum
      .as("collectionManager")
      .mutation(api.mediaDeletions.reject, { requestId });

    expect((await museum.media()).map((file) => file._id)).toEqual([mediaId]);
    expect(
      await museum
        .as("cataloger")
        .query(api.mediaDeletions.listPendingForObject, {
          collectionId: museum.collectionId,
        }),
    ).toEqual([]);
    expect(await museum.pendingApprovals("collectionManager")).toBe(0);
    const request = await museum.t.run((ctx) => ctx.db.get(requestId));
    expect(request?.status).toBe("rejected");
    expect(
      await deletionRefusal(
        museum
          .as("collectionManager")
          .mutation(api.mediaDeletions.approve, { requestId }),
      ),
    ).toBe("DELETION_REQUEST_CLOSED");
    await requestDeletion(museum, mediaId);
    expect(await museum.pendingApprovals("collectionManager")).toBe(1);
  });
});
